# Experiment 4 — High-Performance Multithreaded Pipeline

Splits camera capture, ML inference, and rendering into separate threads so each runs at its own maximum speed.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Camera Thread│────▶│  ML Thread  │────▶│Render Thread │
│  (captures)  │     │ (MediaPipe) │     │ (main loop)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       └───────── SharedState (lock-protected) ─┘
```

- **Camera thread** — grabs frames as fast as the webcam allows
- **ML thread** — runs MediaPipe in LIVE_STREAM mode (async callbacks)
- **Render thread** — composites particles + skeleton + camera at max FPS

Each thread reports its own FPS on screen so you can see the bottleneck.

## What it does
- Particles + force field (same as Level 2) but running at higher FPS
- Hand skeleton drawn over ghosted camera feed
- Per-thread FPS display: Render | Cam | ML

## Run

```bash
uv run python experiments/multithread_pipeline/run.py
```

## Controls

| Key   | Action |
|-------|--------|
| `q`   | Quit   |
| `ESC` | Quit   |

## Why this matters

Running MediaPipe and rendering on the same thread caps your FPS at whichever is slower. By separating them:
- The renderer doesn't wait for ML inference
- ML runs on its own cadence with async callbacks
- The camera captures independently of both

This is the same architecture TouchDesigner uses internally.
