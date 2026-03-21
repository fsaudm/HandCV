# Experiment 2 — Force Field Particle System

800 colored particles float on screen. Your fingertips act as force fields that repel them.

## What it does
- Particles are scattered across the screen with colors based on position
- All 5 fingertips on each hand create repulsion zones
- Particles bounce off screen edges
- Your webcam feed is shown as a ghosted background

## Run

```bash
uv run python experiments/force_field/run.py
```

## Controls

| Key   | Action                    |
|-------|---------------------------|
| `q`   | Quit                      |
| `ESC` | Quit                      |
| `r`   | Reset particles           |
| `+`   | Add 200 particles (max 5000) |
| `-`   | Remove 200 particles (min 100) |

## Tuning

Edit the config at the top of `run.py`:

- `NUM_PARTICLES` — starting count (default 800)
- `REPEL_RADIUS` — how close before particles flee (default 120px)
- `REPEL_STRENGTH` — push force (default 8.0)
- `FRICTION` — velocity damping (default 0.95, lower = more drag)
- `CAM_OPACITY` — webcam visibility (default 0.3)
