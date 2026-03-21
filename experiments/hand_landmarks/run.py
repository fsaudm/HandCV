"""
Experiment 1 — Hand Landmarks ("The Matrix Vision")

Opens your webcam, runs MediaPipe hand tracking, and draws:
  - The 21 landmark points and connections on each hand
  - Landmark index numbers at each point
  - A live coordinate readout for the index fingertip
  - FPS counter

Controls:
  q / ESC — quit
"""

import cv2
import time
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.camera import create_hand_tracker, open_camera, process_frame, get_landmark_px

# Hand landmark connections (pairs of landmark indices that form the skeleton)
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),        # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),        # index
    (0, 9), (9, 10), (10, 11), (11, 12),   # middle
    (0, 13), (13, 14), (14, 15), (15, 16), # ring
    (0, 17), (17, 18), (18, 19), (19, 20), # pinky
    (5, 9), (9, 13), (13, 17),             # palm
]

# Fingertip landmark indices
INDEX_FINGER_TIP = 8

# --- visual config ---
FONT = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 0.4
FONT_COLOR = (0, 255, 0)
FPS_COLOR = (0, 255, 255)
COORD_COLOR = (255, 200, 0)
LANDMARK_DOT_COLOR = (0, 255, 0)
CONNECTION_COLOR = (200, 200, 200)
LANDMARK_LABELS = True


def draw_landmarks(frame, landmarks):
    """Draw the hand skeleton and optionally label each landmark."""
    h, w, _ = frame.shape
    points = []
    for lm in landmarks:
        x, y, _ = get_landmark_px(lm, w, h)
        points.append((x, y))

    # draw connections
    for start, end in HAND_CONNECTIONS:
        cv2.line(frame, points[start], points[end], CONNECTION_COLOR, 2)

    # draw landmark dots and labels
    for idx, (x, y) in enumerate(points):
        cv2.circle(frame, (x, y), 4, LANDMARK_DOT_COLOR, -1)
        if LANDMARK_LABELS:
            cv2.putText(frame, str(idx), (x + 5, y - 5), FONT, FONT_SCALE, FONT_COLOR, 1)


def draw_fingertip_coords(frame, landmarks, hand_index):
    """Show the index fingertip (landmark 8) coordinates on screen."""
    h, w, _ = frame.shape
    tip = landmarks[INDEX_FINGER_TIP]
    px_x, px_y, z = get_landmark_px(tip, w, h)

    text = f"Hand {hand_index} index tip: px({px_x}, {px_y})  z={z:.3f}"
    y_offset = 60 + hand_index * 30
    cv2.putText(frame, text, (10, y_offset), FONT, 0.6, COORD_COLOR, 1)

    # highlight circle on the fingertip
    cv2.circle(frame, (px_x, px_y), 10, (0, 0, 255), 2)


def run():
    cap = open_camera()
    landmarker = create_hand_tracker()

    prev_time = time.time()
    frame_count = 0
    print("Hand Landmarks running — press 'q' or ESC to quit")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # mirror the frame so it feels natural
        frame = cv2.flip(frame, 1)

        # timestamp in ms for the video-mode landmarker
        timestamp_ms = int(time.time() * 1000)
        results = process_frame(frame, landmarker, timestamp_ms)

        if results.hand_landmarks:
            for i, hand_landmarks in enumerate(results.hand_landmarks):
                draw_landmarks(frame, hand_landmarks)
                draw_fingertip_coords(frame, hand_landmarks, i)

        # FPS counter
        now = time.time()
        fps = 1.0 / (now - prev_time) if (now - prev_time) > 0 else 0
        prev_time = now
        cv2.putText(frame, f"FPS: {int(fps)}", (10, 30), FONT, 0.8, FPS_COLOR, 2)

        cv2.imshow("Hand Landmarks", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q") or key == 27:
            break

    landmarker.close()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run()
