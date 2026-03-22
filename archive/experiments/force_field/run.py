"""
Experiment 2 — Force Field Particle System

Particles float on screen. Your fingertips repel them like force fields.
The webcam feed is shown as a ghosted background so you can see yourself.

Controls:
  q / ESC — quit
  r       — reset particles
  +/-     — increase/decrease particle count
"""

import cv2
import time
import sys
import os
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.camera import create_hand_tracker, open_camera, process_frame, get_landmark_px

# --- config ---
NUM_PARTICLES = 800
REPEL_RADIUS = 120       # pixels — how close before particles flee
REPEL_STRENGTH = 8.0     # how hard they get pushed
FRICTION = 0.95          # velocity damping per frame
PARTICLE_SIZE = 3
CAM_OPACITY = 0.3        # how visible the webcam feed is (0=invisible, 1=full)

# fingertip landmark indices
FINGERTIPS = [4, 8, 12, 16, 20]

FONT = cv2.FONT_HERSHEY_SIMPLEX


class ParticleSystem:
    def __init__(self, width, height, count):
        self.w = width
        self.h = height
        self.count = count
        self.reset()

    def reset(self):
        self.pos = np.random.rand(self.count, 2).astype(np.float32)
        self.pos[:, 0] *= self.w
        self.pos[:, 1] *= self.h
        self.vel = np.zeros((self.count, 2), dtype=np.float32)
        # give each particle a color based on its initial position
        hues = (self.pos[:, 0] / self.w * 180).astype(np.uint8)
        self.colors = np.zeros((self.count, 3), dtype=np.uint8)
        for i in range(self.count):
            hsv = np.uint8([[[hues[i], 200, 255]]])
            bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
            self.colors[i] = bgr[0, 0]

    def repel_from(self, cx, cy):
        """Push particles away from point (cx, cy)."""
        dx = self.pos[:, 0] - cx
        dy = self.pos[:, 1] - cy
        dist_sq = dx * dx + dy * dy
        dist = np.sqrt(dist_sq) + 1e-6  # avoid divide by zero

        mask = dist < REPEL_RADIUS
        if not np.any(mask):
            return

        # force falls off with distance
        force = REPEL_STRENGTH * (1.0 - dist[mask] / REPEL_RADIUS)
        self.vel[mask, 0] += (dx[mask] / dist[mask]) * force
        self.vel[mask, 1] += (dy[mask] / dist[mask]) * force

    def update(self):
        """Step the simulation forward."""
        self.vel *= FRICTION
        self.pos += self.vel

        # bounce off edges
        for axis, limit in [(0, self.w), (1, self.h)]:
            below = self.pos[:, axis] < 0
            above = self.pos[:, axis] > limit
            self.pos[below, axis] = 0
            self.pos[above, axis] = limit
            self.vel[below, axis] *= -0.5
            self.vel[above, axis] *= -0.5

    def draw(self, frame):
        """Draw all particles onto the frame."""
        for i in range(self.count):
            x = int(self.pos[i, 0])
            y = int(self.pos[i, 1])
            color = tuple(int(c) for c in self.colors[i])
            cv2.circle(frame, (x, y), PARTICLE_SIZE, color, -1)


def run():
    cap = open_camera()
    landmarker = create_hand_tracker()

    # get actual frame dimensions
    ret, test_frame = cap.read()
    if not ret:
        raise RuntimeError("Could not read from camera")
    h, w, _ = test_frame.shape

    particles = ParticleSystem(w, h, NUM_PARTICLES)

    prev_time = time.time()
    print("Force Field running — press 'q' or ESC to quit, 'r' to reset particles")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        timestamp_ms = int(time.time() * 1000)
        results = process_frame(frame, landmarker, timestamp_ms)

        # create a dark canvas, blend the camera feed onto it
        canvas = np.zeros_like(frame)
        cv2.addWeighted(frame, CAM_OPACITY, canvas, 1.0 - CAM_OPACITY, 0, canvas)

        # apply forces from all detected fingertips
        if results.hand_landmarks:
            for hand_landmarks in results.hand_landmarks:
                for tip_idx in FINGERTIPS:
                    tip = hand_landmarks[tip_idx]
                    px_x, px_y, _ = get_landmark_px(tip, w, h)
                    particles.repel_from(px_x, px_y)

                    # draw a glow circle around each fingertip
                    cv2.circle(canvas, (px_x, px_y), REPEL_RADIUS, (40, 40, 80), 1)
                    cv2.circle(canvas, (px_x, px_y), 6, (0, 100, 255), -1)

        particles.update()
        particles.draw(canvas)

        # FPS
        now = time.time()
        fps = 1.0 / (now - prev_time) if (now - prev_time) > 0 else 0
        prev_time = now
        cv2.putText(canvas, f"FPS: {int(fps)}  Particles: {particles.count}",
                    (10, 30), FONT, 0.7, (0, 255, 255), 2)

        cv2.imshow("Force Field", canvas)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q") or key == 27:
            break
        elif key == ord("r"):
            particles.reset()
        elif key == ord("+") or key == ord("="):
            particles.count = min(particles.count + 200, 5000)
            particles.reset()
        elif key == ord("-"):
            particles.count = max(particles.count - 200, 100)
            particles.reset()

    landmarker.close()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run()
