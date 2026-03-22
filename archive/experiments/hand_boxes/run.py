"""
Experiment 5 — Hand Boxes

Make an L-shape with each hand (thumb out + index up), bring them together
to create a box. Expand your hands apart to resize it. Release to drop it.

Drag boxes from a shelf at the top of the screen. Open them with the
L-gesture to reveal placeholder text inside.

Controls:
  q / ESC — quit
  c       — clear all boxes
"""

import cv2
import time
import math
import sys
import os
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.camera import create_hand_tracker, open_camera, process_frame, get_landmark_px

# landmark indices
THUMB_TIP = 4
THUMB_IP = 3
INDEX_TIP = 8
INDEX_DIP = 6
MIDDLE_TIP = 12
RING_TIP = 16
PINKY_TIP = 20
WRIST = 0
INDEX_MCP = 5

# --- config ---
CAM_OPACITY = 0.25            # webcam feed visibility
L_ANGLE_TOLERANCE = 40        # degrees — how close to 90° the L must be
FINGER_CURL_THRESHOLD = 30    # pixels — curled fingers must be within this of MCP
CREATE_DISTANCE = 200         # pixels — max distance between hands to start creating
SHELF_HEIGHT = 60             # pixels — height of the top shelf
MIN_BOX_SIZE = 40             # pixels — minimum box dimension
GRAB_RADIUS = 30              # pixels — how close pinch must be to grab a shelf box

FONT = cv2.FONT_HERSHEY_SIMPLEX

PLACEHOLDER_TEXTS = [
    "Hello, world!",
    "Touch to reveal",
    "Generative art",
    "Made with hands",
    "Open me!",
    "the.poet.engineer",
    "Interactive canvas",
    "Gesture magic",
]

BOX_COLORS = [
    (255, 120, 80),
    (80, 200, 255),
    (120, 255, 120),
    (255, 200, 80),
    (200, 120, 255),
    (80, 255, 200),
    (255, 80, 180),
    (180, 220, 255),
]


class Box:
    def __init__(self, x, y, w, h, color, text):
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.color = color
        self.text = text
        self.open = False
        self.open_progress = 0.0  # 0 = closed, 1 = fully open
        self.dragging = False

    def draw(self, canvas):
        x, y, w, h = int(self.x), int(self.y), int(self.w), int(self.h)

        # background fill with transparency effect
        overlay = canvas.copy()
        cv2.rectangle(overlay, (x, y), (x + w, y + h), self.color, -1)
        alpha = 0.15 + 0.25 * self.open_progress
        cv2.addWeighted(overlay, alpha, canvas, 1 - alpha, 0, canvas)

        # border
        border_color = tuple(min(c + 60, 255) for c in self.color)
        thickness = 2 if not self.open else 3
        cv2.rectangle(canvas, (x, y), (x + w, y + h), border_color, thickness)

        # text if open enough
        if self.open_progress > 0.3:
            text_alpha = min(1.0, (self.open_progress - 0.3) / 0.7)
            text_color = tuple(int(c * text_alpha) for c in (255, 255, 255))

            # wrap text inside box
            font_scale = max(0.4, min(0.7, w / 300))
            (tw, th), _ = cv2.getTextSize(self.text, FONT, font_scale, 1)
            tx = x + (w - tw) // 2
            ty = y + (h + th) // 2
            cv2.putText(canvas, self.text, (tx, ty), FONT, font_scale, text_color, 1, cv2.LINE_AA)

    def contains(self, px, py):
        return self.x <= px <= self.x + self.w and self.y <= py <= self.y + self.h


class ShelfSlot:
    """A draggable box template on the top shelf."""
    def __init__(self, x, y, w, h, color, text):
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.color = color
        self.text = text

    def draw(self, canvas):
        x, y, w, h = int(self.x), int(self.y), int(self.w), int(self.h)
        cv2.rectangle(canvas, (x, y), (x + w, y + h), self.color, -1)
        cv2.rectangle(canvas, (x, y), (x + w, y + h), (255, 255, 255), 1)
        # small label
        cv2.putText(canvas, "drag", (x + 4, y + h - 6), FONT, 0.3, (255, 255, 255), 1)

    def contains(self, px, py):
        return self.x <= px <= self.x + self.w and self.y <= py <= self.y + self.h


def is_l_shape(landmarks, w, h):
    """
    Detect if the hand is making an L shape:
    - Thumb extended outward
    - Index finger extended upward
    - Other fingers curled
    Returns (True/False, thumb_tip_px, index_tip_px)
    """
    thumb_tip = landmarks[THUMB_TIP]
    index_tip = landmarks[INDEX_TIP]
    index_mcp = landmarks[INDEX_MCP]
    wrist = landmarks[WRIST]

    ttx, tty, _ = get_landmark_px(thumb_tip, w, h)
    itx, ity, _ = get_landmark_px(index_tip, w, h)
    imx, imy, _ = get_landmark_px(index_mcp, w, h)
    wx, wy, _ = get_landmark_px(wrist, w, h)

    # check thumb is extended (away from wrist horizontally)
    thumb_dist = abs(ttx - wx)
    if thumb_dist < 40:
        return False, None, None

    # check index is extended (above its MCP)
    if ity > imy - 20:
        return False, None, None

    # check other fingers are curled (tips close to their MCPs)
    for tip_idx in [MIDDLE_TIP, RING_TIP, PINKY_TIP]:
        tip = landmarks[tip_idx]
        tx, ty, _ = get_landmark_px(tip, w, h)
        if ty < imy - 10:  # if other fingers are extended like index, not an L
            return False, None, None

    # check the angle between thumb and index is roughly 90°
    v_thumb = (ttx - imx, tty - imy)
    v_index = (itx - imx, ity - imy)
    dot = v_thumb[0] * v_index[0] + v_thumb[1] * v_index[1]
    mag_t = math.hypot(*v_thumb) + 1e-6
    mag_i = math.hypot(*v_index) + 1e-6
    cos_angle = dot / (mag_t * mag_i)
    cos_angle = max(-1, min(1, cos_angle))
    angle = math.degrees(math.acos(cos_angle))

    if abs(angle - 90) > L_ANGLE_TOLERANCE:
        return False, None, None

    return True, (ttx, tty), (itx, ity)


def is_pinching(landmarks, w, h, threshold=40):
    """Check if thumb and index are pinching. Returns (bool, midpoint)."""
    thumb = landmarks[THUMB_TIP]
    index = landmarks[INDEX_TIP]
    tx, ty, _ = get_landmark_px(thumb, w, h)
    ix, iy, _ = get_landmark_px(index, w, h)
    dist = math.hypot(tx - ix, ty - iy)
    mid = ((tx + ix) // 2, (ty + iy) // 2)
    return dist < threshold, mid


def run():
    cap = open_camera()
    landmarker = create_hand_tracker()

    ret, test_frame = cap.read()
    if not ret:
        raise RuntimeError("Could not read from camera")
    h, w, _ = test_frame.shape

    boxes = []
    box_counter = 0

    # create shelf slots across the top
    slot_w, slot_h = 50, 40
    slot_gap = 15
    num_slots = min(len(PLACEHOLDER_TEXTS), (w - 20) // (slot_w + slot_gap))
    shelf_start_x = (w - num_slots * (slot_w + slot_gap)) // 2
    shelf_slots = []
    for i in range(num_slots):
        sx = shelf_start_x + i * (slot_w + slot_gap)
        sy = 10
        color = BOX_COLORS[i % len(BOX_COLORS)]
        text = PLACEHOLDER_TEXTS[i % len(PLACEHOLDER_TEXTS)]
        shelf_slots.append(ShelfSlot(sx, sy, slot_w, slot_h, color, text))

    # state for dragging from shelf
    dragging_box = None       # Box being dragged from shelf
    dragging_hand_idx = None  # which hand is dragging

    # state for L-gesture box creation
    creating_box = False
    l_corners = None  # (left_thumb, left_index, right_thumb, right_index)

    prev_time = time.time()
    print("Hand Boxes running — press 'q' or ESC to quit, 'c' to clear")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        timestamp_ms = int(time.time() * 1000)
        results = process_frame(frame, landmarker, timestamp_ms)

        # dark canvas
        canvas = np.zeros_like(frame)
        cv2.addWeighted(frame, CAM_OPACITY, canvas, 1.0 - CAM_OPACITY, 0, canvas)

        # draw shelf background
        cv2.rectangle(canvas, (0, 0), (w, SHELF_HEIGHT), (30, 30, 40), -1)
        cv2.line(canvas, (0, SHELF_HEIGHT), (w, SHELF_HEIGHT), (80, 80, 100), 1)

        # draw shelf slots
        for slot in shelf_slots:
            slot.draw(canvas)

        hands_data = []  # [(is_l, thumb_pt, index_pt, is_pinch, pinch_mid, landmarks)]

        if results.hand_landmarks:
            for hand_landmarks in results.hand_landmarks:
                is_l, thumb_pt, index_pt = is_l_shape(hand_landmarks, w, h)
                is_pinch, pinch_mid = is_pinching(hand_landmarks, w, h)
                hands_data.append((is_l, thumb_pt, index_pt, is_pinch, pinch_mid, hand_landmarks))

                # draw hand indicators
                if is_l and thumb_pt and index_pt:
                    cv2.circle(canvas, thumb_pt, 8, (0, 200, 255), -1)
                    cv2.circle(canvas, index_pt, 8, (0, 200, 255), -1)
                    cv2.line(canvas, thumb_pt, index_pt, (0, 200, 255), 2)
                    # draw L label
                    mid = ((thumb_pt[0] + index_pt[0]) // 2, (thumb_pt[1] + index_pt[1]) // 2)
                    cv2.putText(canvas, "L", (mid[0] - 5, mid[1] - 10), FONT, 0.6, (0, 255, 255), 2)

                if is_pinch:
                    cv2.circle(canvas, pinch_mid, 10, (0, 0, 255), 2)

        # --- shelf drag logic ---
        if dragging_box is not None:
            # find the hand that's still pinching to update drag position
            still_pinching = False
            for is_l, thumb_pt, index_pt, is_pinch, pinch_mid, lm in hands_data:
                if is_pinch:
                    dragging_box.x = pinch_mid[0] - dragging_box.w // 2
                    dragging_box.y = pinch_mid[1] - dragging_box.h // 2
                    still_pinching = True
                    break

            if not still_pinching:
                # drop the box
                if dragging_box.y > SHELF_HEIGHT:
                    boxes.append(dragging_box)
                dragging_box = None
        else:
            # check if any pinching hand is on a shelf slot
            for is_l, thumb_pt, index_pt, is_pinch, pinch_mid, lm in hands_data:
                if is_pinch:
                    for slot in shelf_slots:
                        if slot.contains(pinch_mid[0], pinch_mid[1]):
                            dragging_box = Box(
                                pinch_mid[0] - 75, pinch_mid[1] - 50,
                                150, 100, slot.color, slot.text
                            )
                            box_counter += 1
                            break
                    if dragging_box:
                        break

        # --- L-gesture box creation / expansion ---
        if len(hands_data) >= 2:
            l_hands = [(i, d) for i, d in enumerate(hands_data) if d[0]]
            if len(l_hands) >= 2:
                _, d1 = l_hands[0]
                _, d2 = l_hands[1]
                t1, i1 = d1[1], d1[2]
                t2, i2 = d2[1], d2[2]

                # the box corners: use thumbs as horizontal extent, index tips as top
                left_x = min(t1[0], t2[0])
                right_x = max(t1[0], t2[0])
                top_y = min(i1[1], i2[1])
                bottom_y = max(t1[1], t2[1])

                bw = right_x - left_x
                bh = bottom_y - top_y

                if bw > MIN_BOX_SIZE and bh > MIN_BOX_SIZE:
                    # draw the creation preview
                    cv2.rectangle(canvas, (left_x, top_y), (right_x, bottom_y),
                                  (0, 255, 255), 2)
                    cv2.putText(canvas, f"{bw}x{bh}", (left_x, top_y - 10),
                                FONT, 0.5, (0, 255, 255), 1)
                    creating_box = True
                    l_corners = (left_x, top_y, bw, bh)
                else:
                    creating_box = False
            else:
                # if we were creating and now only one L or none, drop the box
                if creating_box and l_corners:
                    lx, ly, lw, lh = l_corners
                    color = BOX_COLORS[box_counter % len(BOX_COLORS)]
                    text = PLACEHOLDER_TEXTS[box_counter % len(PLACEHOLDER_TEXTS)]
                    new_box = Box(lx, ly, lw, lh, color, text)
                    new_box.open = True
                    new_box.open_progress = 1.0
                    boxes.append(new_box)
                    box_counter += 1
                creating_box = False
                l_corners = None
        else:
            if creating_box and l_corners:
                lx, ly, lw, lh = l_corners
                color = BOX_COLORS[box_counter % len(BOX_COLORS)]
                text = PLACEHOLDER_TEXTS[box_counter % len(PLACEHOLDER_TEXTS)]
                new_box = Box(lx, ly, lw, lh, color, text)
                new_box.open = True
                new_box.open_progress = 1.0
                boxes.append(new_box)
                box_counter += 1
            creating_box = False
            l_corners = None

        # --- open closed boxes with pinch inside them ---
        for is_l, thumb_pt, index_pt, is_pinch, pinch_mid, lm in hands_data:
            if is_pinch:
                for box in boxes:
                    if not box.open and box.contains(pinch_mid[0], pinch_mid[1]):
                        box.open = True

        # --- animate box open progress ---
        for box in boxes:
            if box.open and box.open_progress < 1.0:
                box.open_progress = min(1.0, box.open_progress + 0.05)

        # --- draw dragging box ---
        if dragging_box:
            dragging_box.draw(canvas)

        # --- draw all placed boxes ---
        for box in boxes:
            box.draw(canvas)

        # FPS
        now = time.time()
        fps = 1.0 / (now - prev_time) if (now - prev_time) > 0 else 0
        prev_time = now
        cv2.putText(canvas, f"FPS: {int(fps)}  Boxes: {len(boxes)}",
                    (10, h - 15), FONT, 0.6, (0, 255, 255), 1)

        # instructions
        cv2.putText(canvas, "L+L: create box | Pinch+drag: shelf | Pinch inside: open",
                    (10, h - 40), FONT, 0.45, (180, 180, 180), 1)

        cv2.imshow("Hand Boxes", canvas)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q") or key == 27:
            break
        elif key == ord("c"):
            boxes.clear()
            box_counter = 0

    landmarker.close()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run()
