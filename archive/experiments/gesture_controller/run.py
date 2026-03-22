"""
Experiment 3 — Retro Gesture Controller

Uses hand gestures to simulate keyboard inputs:
  - Pinch (thumb + index) → Space bar (jump)
  - Swipe left  → Left arrow
  - Swipe right → Right arrow
  - Swipe up    → Up arrow
  - Swipe down  → Down arrow

Shows a live webcam feed with gesture state overlay.

Controls:
  q / ESC — quit
"""

import cv2
import time
import math
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pyautogui
from shared.camera import create_hand_tracker, open_camera, process_frame, get_landmark_px

# disable pyautogui's safety pause for responsiveness
pyautogui.PAUSE = 0.0

# --- config ---
PINCH_THRESHOLD = 40       # pixels — thumb-to-index distance to register a pinch
SWIPE_THRESHOLD = 60       # pixels — minimum wrist displacement to register a swipe
SWIPE_COOLDOWN = 0.4       # seconds between swipe triggers
PINCH_COOLDOWN = 0.3       # seconds between pinch triggers

# landmark indices
THUMB_TIP = 4
INDEX_TIP = 8
WRIST = 0

FONT = cv2.FONT_HERSHEY_SIMPLEX


class GestureDetector:
    def __init__(self):
        self.prev_wrist = None
        self.last_swipe_time = 0
        self.last_pinch_time = 0
        self.pinch_active = False
        self.last_gesture = ""
        self.last_gesture_time = 0

    def detect(self, landmarks, w, h):
        """Detect gestures and fire keyboard events. Returns gesture name or None."""
        now = time.time()

        thumb_x, thumb_y, _ = get_landmark_px(landmarks[THUMB_TIP], w, h)
        index_x, index_y, _ = get_landmark_px(landmarks[INDEX_TIP], w, h)
        wrist_x, wrist_y, _ = get_landmark_px(landmarks[WRIST], w, h)

        gesture = None

        # --- pinch detection ---
        dist = math.hypot(thumb_x - index_x, thumb_y - index_y)
        if dist < PINCH_THRESHOLD:
            if not self.pinch_active and (now - self.last_pinch_time) > PINCH_COOLDOWN:
                pyautogui.press("space")
                gesture = "PINCH → Space"
                self.last_pinch_time = now
            self.pinch_active = True
        else:
            self.pinch_active = False

        # --- swipe detection ---
        if self.prev_wrist is not None and (now - self.last_swipe_time) > SWIPE_COOLDOWN:
            dx = wrist_x - self.prev_wrist[0]
            dy = wrist_y - self.prev_wrist[1]

            if abs(dx) > SWIPE_THRESHOLD or abs(dy) > SWIPE_THRESHOLD:
                if abs(dx) > abs(dy):
                    if dx > 0:
                        pyautogui.press("right")
                        gesture = "SWIPE RIGHT →"
                    else:
                        pyautogui.press("left")
                        gesture = "← SWIPE LEFT"
                else:
                    if dy > 0:
                        pyautogui.press("down")
                        gesture = "SWIPE DOWN ↓"
                    else:
                        pyautogui.press("up")
                        gesture = "SWIPE UP ↑"
                self.last_swipe_time = now

        self.prev_wrist = (wrist_x, wrist_y)

        if gesture:
            self.last_gesture = gesture
            self.last_gesture_time = now

        return gesture

    def get_display_gesture(self):
        """Return the last gesture if it's recent enough to display."""
        if time.time() - self.last_gesture_time < 1.0:
            return self.last_gesture
        return None


def run():
    cap = open_camera()
    landmarker = create_hand_tracker()
    detector = GestureDetector()

    ret, test_frame = cap.read()
    if not ret:
        raise RuntimeError("Could not read from camera")
    h, w, _ = test_frame.shape

    prev_time = time.time()
    print("Gesture Controller running — press 'q' or ESC to quit")
    print("Pinch thumb+index → Space | Swipe → Arrow keys")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        timestamp_ms = int(time.time() * 1000)
        results = process_frame(frame, landmarker, timestamp_ms)

        if results.hand_landmarks:
            for hand_landmarks in results.hand_landmarks:
                # draw thumb and index fingertips
                thumb = hand_landmarks[THUMB_TIP]
                index = hand_landmarks[INDEX_TIP]
                tx, ty, _ = get_landmark_px(thumb, w, h)
                ix, iy, _ = get_landmark_px(index, w, h)

                # draw line between thumb and index
                dist = math.hypot(tx - ix, ty - iy)
                line_color = (0, 0, 255) if dist < PINCH_THRESHOLD else (0, 255, 0)
                cv2.line(frame, (tx, ty), (ix, iy), line_color, 2)
                cv2.circle(frame, (tx, ty), 8, (255, 100, 0), -1)
                cv2.circle(frame, (ix, iy), 8, (0, 100, 255), -1)

                # show pinch distance
                mid_x, mid_y = (tx + ix) // 2, (ty + iy) // 2
                cv2.putText(frame, f"{int(dist)}px", (mid_x + 10, mid_y),
                            FONT, 0.5, line_color, 1)

                # detect gestures
                detector.detect(hand_landmarks, w, h)

        # show active gesture
        gesture_text = detector.get_display_gesture()
        if gesture_text:
            cv2.putText(frame, gesture_text, (w // 2 - 150, h - 40),
                        FONT, 1.2, (0, 255, 255), 3)

        # FPS
        now = time.time()
        fps = 1.0 / (now - prev_time) if (now - prev_time) > 0 else 0
        prev_time = now
        cv2.putText(frame, f"FPS: {int(fps)}", (10, 30), FONT, 0.7, (0, 255, 255), 2)

        # instructions
        cv2.putText(frame, "Pinch: Space | Swipe: Arrows", (10, h - 15),
                    FONT, 0.5, (200, 200, 200), 1)

        cv2.imshow("Gesture Controller", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q") or key == 27:
            break

    landmarker.close()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run()
