# Experiment 3 — Retro Gesture Controller

Use hand gestures to control your computer — pinch to press Space, swipe to press arrow keys.

## What it does
- Pinch (thumb + index finger close together) → presses **Space**
- Swipe hand left/right/up/down → presses **Arrow keys**
- Shows live distance between thumb and index finger
- Visual feedback: line turns red when pinch is detected

## Run

```bash
uv run python experiments/gesture_controller/run.py
```

## Controls

| Key   | Action |
|-------|--------|
| `q`   | Quit   |
| `ESC` | Quit   |

## Gesture mapping

| Gesture       | Key pressed |
|---------------|-------------|
| Pinch         | Space       |
| Swipe left    | Left arrow  |
| Swipe right   | Right arrow |
| Swipe up      | Up arrow    |
| Swipe down    | Down arrow  |

## Tuning

Edit the config at the top of `run.py`:

- `PINCH_THRESHOLD` — max thumb-index distance for pinch (default 40px)
- `SWIPE_THRESHOLD` — min wrist displacement for swipe (default 60px)
- `SWIPE_COOLDOWN` — seconds between swipes (default 0.4)
- `PINCH_COOLDOWN` — seconds between pinches (default 0.3)

## Use case
Open a browser game (e.g. Chrome Dino, online Mario) and control it with your hands!
