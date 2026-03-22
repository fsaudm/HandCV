"""
Experiment 4 — High-Performance Architecture

Separates the pipeline into threads:
  - Camera thread:   captures frames as fast as possible
  - ML thread:       runs MediaPipe hand detection (async/live-stream mode)
  - Render thread:   composites everything and displays at max FPS

Also includes a gesture state cache so the renderer doesn't need to
recalculate gesture info every frame — it reads the latest state.

Shows per-thread FPS and a combined particle + skeleton visualization
to stress-test the architecture.

Controls:
  q / ESC — quit
"""

import cv2
import time
import math
import sys
import os
import threading
import numpy as np
from collections import deque

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import mediapipe as mp
from shared.camera import get_landmark_px

# --- config ---
NUM_PARTICLES = 1000
REPEL_RADIUS = 100
REPEL_STRENGTH = 6.0
FRICTION = 0.94
PARTICLE_SIZE = 2
CAM_OPACITY = 0.25
FINGERTIPS = [4, 8, 12, 16, 20]
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "shared", "hand_landmarker.task")

FONT = cv2.FONT_HERSHEY_SIMPLEX


# ──────────────────────────────────────────────
# Thread-safe shared state
# ──────────────────────────────────────────────

class SharedState:
    """Lock-protected state shared between threads."""

    def __init__(self):
        self._lock = threading.Lock()
        self.frame = None
        self.hand_landmarks = None
        self.cam_fps = 0
        self.ml_fps = 0
        self.running = True

    def set_frame(self, frame):
        with self._lock:
            self.frame = frame

    def get_frame(self):
        with self._lock:
            return self.frame.copy() if self.frame is not None else None

    def set_landmarks(self, landmarks):
        with self._lock:
            self.hand_landmarks = landmarks

    def get_landmarks(self):
        with self._lock:
            return self.hand_landmarks

    def stop(self):
        with self._lock:
            self.running = False

    def is_running(self):
        with self._lock:
            return self.running


# ──────────────────────────────────────────────
# Camera thread
# ──────────────────────────────────────────────

def camera_thread(state):
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    prev = time.time()
    while state.is_running():
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.flip(frame, 1)
        state.set_frame(frame)

        now = time.time()
        state.cam_fps = 1.0 / (now - prev) if (now - prev) > 0 else 0
        prev = now

    cap.release()


# ──────────────────────────────────────────────
# ML thread (uses MediaPipe LIVE_STREAM mode)
# ──────────────────────────────────────────────

def ml_thread(state):
    BaseOptions = mp.tasks.BaseOptions
    HandLandmarker = mp.tasks.vision.HandLandmarker
    HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
    VisionRunningMode = mp.tasks.vision.RunningMode

    latest_result = [None]  # mutable container for callback

    def on_result(result, output_image, timestamp_ms):
        latest_result[0] = result

    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=VisionRunningMode.LIVE_STREAM,
        num_hands=2,
        min_hand_detection_confidence=0.7,
        min_tracking_confidence=0.5,
        result_callback=on_result,
    )

    landmarker = HandLandmarker.create_from_options(options)
    prev = time.time()
    last_ts = -1

    while state.is_running():
        frame = state.get_frame()
        if frame is None:
            time.sleep(0.001)
            continue

        ts = int(time.time() * 1000)
        if ts <= last_ts:
            ts = last_ts + 1
        last_ts = ts

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        landmarker.detect_async(mp_image, ts)

        # propagate latest result to shared state
        if latest_result[0] is not None:
            r = latest_result[0]
            state.set_landmarks(r.hand_landmarks if r.hand_landmarks else None)
            latest_result[0] = None

        now = time.time()
        state.ml_fps = 1.0 / (now - prev) if (now - prev) > 0 else 0
        prev = now

        time.sleep(0.005)  # don't spin too hard

    landmarker.close()


# ──────────────────────────────────────────────
# Particle system (same as Level 2 but leaner)
# ──────────────────────────────────────────────

class ParticleSystem:
    def __init__(self, w, h, count):
        self.w, self.h, self.count = w, h, count
        self.pos = np.random.rand(count, 2).astype(np.float32)
        self.pos[:, 0] *= w
        self.pos[:, 1] *= h
        self.vel = np.zeros((count, 2), dtype=np.float32)
        hues = (self.pos[:, 0] / w * 180).astype(np.uint8)
        self.colors = np.zeros((count, 3), dtype=np.uint8)
        for i in range(count):
            hsv = np.uint8([[[hues[i], 200, 255]]])
            self.colors[i] = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)[0, 0]

    def repel_from(self, cx, cy):
        dx = self.pos[:, 0] - cx
        dy = self.pos[:, 1] - cy
        dist = np.sqrt(dx * dx + dy * dy) + 1e-6
        mask = dist < REPEL_RADIUS
        if not np.any(mask):
            return
        force = REPEL_STRENGTH * (1.0 - dist[mask] / REPEL_RADIUS)
        self.vel[mask, 0] += (dx[mask] / dist[mask]) * force
        self.vel[mask, 1] += (dy[mask] / dist[mask]) * force

    def update(self):
        self.vel *= FRICTION
        self.pos += self.vel
        for axis, limit in [(0, self.w), (1, self.h)]:
            below = self.pos[:, axis] < 0
            above = self.pos[:, axis] > limit
            self.pos[below, axis] = 0
            self.pos[above, axis] = limit
            self.vel[below, axis] *= -0.5
            self.vel[above, axis] *= -0.5

    def draw(self, frame):
        for i in range(self.count):
            x, y = int(self.pos[i, 0]), int(self.pos[i, 1])
            color = tuple(int(c) for c in self.colors[i])
            cv2.circle(frame, (x, y), PARTICLE_SIZE, color, -1)


# ──────────────────────────────────────────────
# Hand skeleton drawing
# ──────────────────────────────────────────────

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (0, 9), (9, 10), (10, 11), (11, 12),
    (0, 13), (13, 14), (14, 15), (15, 16),
    (0, 17), (17, 18), (18, 19), (19, 20),
    (5, 9), (9, 13), (13, 17),
]


def draw_skeleton(canvas, landmarks, w, h):
    pts = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
    for a, b in HAND_CONNECTIONS:
        cv2.line(canvas, pts[a], pts[b], (100, 255, 100), 1)
    for x, y in pts:
        cv2.circle(canvas, (x, y), 3, (0, 255, 0), -1)


# ──────────────────────────────────────────────
# Render loop (main thread)
# ──────────────────────────────────────────────

def run():
    state = SharedState()

    # start worker threads
    cam = threading.Thread(target=camera_thread, args=(state,), daemon=True)
    ml = threading.Thread(target=ml_thread, args=(state,), daemon=True)
    cam.start()
    ml.start()

    # wait for first frame to get dimensions
    while state.get_frame() is None:
        time.sleep(0.01)
    h, w, _ = state.get_frame().shape

    particles = ParticleSystem(w, h, NUM_PARTICLES)
    prev_time = time.time()

    print("Multithreaded Pipeline running — press 'q' or ESC to quit")

    while True:
        frame = state.get_frame()
        if frame is None:
            time.sleep(0.001)
            continue

        # dark canvas with ghosted camera
        canvas = np.zeros_like(frame)
        cv2.addWeighted(frame, CAM_OPACITY, canvas, 1.0 - CAM_OPACITY, 0, canvas)

        # read latest landmarks from ML thread
        landmarks_list = state.get_landmarks()
        if landmarks_list:
            for hand_landmarks in landmarks_list:
                draw_skeleton(canvas, hand_landmarks, w, h)
                for tip_idx in FINGERTIPS:
                    tip = hand_landmarks[tip_idx]
                    px_x, px_y, _ = get_landmark_px(tip, w, h)
                    particles.repel_from(px_x, px_y)
                    cv2.circle(canvas, (px_x, px_y), REPEL_RADIUS, (40, 40, 80), 1)
                    cv2.circle(canvas, (px_x, px_y), 6, (0, 100, 255), -1)

        particles.update()
        particles.draw(canvas)

        # FPS stats
        now = time.time()
        render_fps = 1.0 / (now - prev_time) if (now - prev_time) > 0 else 0
        prev_time = now

        cv2.putText(canvas, f"Render: {int(render_fps)}  |  Cam: {int(state.cam_fps)}  |  ML: {int(state.ml_fps)}",
                    (10, 30), FONT, 0.6, (0, 255, 255), 2)
        cv2.putText(canvas, f"Particles: {particles.count}  |  Threads: 3",
                    (10, 55), FONT, 0.5, (180, 180, 180), 1)

        cv2.imshow("Multithreaded Pipeline", canvas)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q") or key == 27:
            break

    state.stop()
    cam.join(timeout=2)
    ml.join(timeout=2)
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run()
