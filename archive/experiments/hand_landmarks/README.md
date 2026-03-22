# Experiment 1 — Hand Landmarks ("The Matrix Vision")

Opens your webcam and draws MediaPipe's 21 hand landmark points in real-time.

## What it does
- Draws the full hand skeleton (landmarks + connections) on each detected hand
- Labels each landmark with its index number (0–20)
- Highlights the index fingertip (landmark 8) with a red circle
- Shows live pixel coordinates and depth (z) for the index fingertip
- Displays FPS counter

## Run

From the project root:

```bash
uv run python experiments/hand_landmarks/run.py
```

Or via the launcher:

```bash
uv run python main.py hand_landmarks
```

## Controls

| Key     | Action |
|---------|--------|
| `q`     | Quit   |
| `ESC`   | Quit   |

## MediaPipe hand landmarks reference

```
        8   12  16  20
        |   |   |   |
    7   11  15  19
    |   |   |   |
    6   10  14  18
    |   |   |   |
    5---9---13--17
     \  |  /  /
      \ | / /
        4
        |
        3
        |
        2
        |
        1
        |
        0 (wrist)
```

Key landmarks:
- 0: Wrist
- 4: Thumb tip
- 8: Index finger tip
- 12: Middle finger tip
- 16: Ring finger tip
- 20: Pinky tip
