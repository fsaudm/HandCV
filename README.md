# HandCV

A hand-gesture interactive resume powered by MediaPipe. Browse, expand, and explore "resume" sections using hand gestures.

![demo](photos/demo.gif)


Project Structure:
```
HandCV/
├── web2/                       # Browser dial mode (primary)
│   ├── index.html
│   ├── app.js
│   ├── boxes.js
│   ├── gestures.js
│   ├── config.js
│   └── style.css
├── web/                        # Browser drag & drop
│   ├── index.html
│   ├── app.js
│   ├── boxes.js
│   ├── gestures.js
│   ├── config.js
│   ├── style.css
│   └── resume.json
├── experiments/                # Prototypes & research
├── img/                        # Onboarding hand silhouettes
├── resume.json                 # Resume data (shared)
├── python-legacy/              # Original Python/OpenCV app (legacy)
└── shared/                     # Shared assets (Python app)
```


## Features

- 2 modes (as of now?):
  - **Dial browsing** : rotate your left hand to browse sections, right fist→open to expand
  - **Drag & drop** : pinch to grab, drag to move, two-hand pinch to open/close boxes
- **Shelf system** : resume sections live on a top shelf; gesture to pull them onto the canvas
- **Dynamic layout** : boxes are generated from `resume.json`; add or remove sections freely
- **Hand skeleton overlay** : 21 landmarks + bone connections rendered in real-time

## Quick Start

### Web2 (dial mode)

```bash
npx live-server web2/
```

### Web (drag & drop mode)

```bash
npx live-server web/
```

Both require a modern browser with webcam access (Chrome/Edge recommended for WebGPU MediaPipe).

## Implementations

**Tech stack:** Vanilla JS, HTML5 Canvas, MediaPipe JS SDK

### `web2/` - Browser Dial Mode

Left hand acts as a rotary dial to browse sections, right hand opens/closes them.

| Gesture | Action |
|---------|--------|
| Rotate left hand (clockwise/counterclockwise) | Browse shelf sections |
| Right hand fist-to-open | Expand selected section to center |
| Bring both hands together | Collapse expanded section |

**State machine:** `BROWSING` → `EXPANDING` → `EXPANDED` → `COLLAPSING` → `BROWSING`

### `web/` - Browser Drag & Drop

A free-form drag-and-drop interaction model. Pinch shelf slots to spawn boxes, drag them anywhere on the canvas.

| Gesture | Action |
|---------|--------|
| Pinch shelf slot + drag | Create a box |
| Pinch box + drag | Move it |
| Two-hand pinch near box | Open / close |
| Open hand near closed box | Expand it |
| Left fist (hold) | Reset all boxes |
| Right hand open-to-fist | Collapse nearest open box |

## `resume.json`

All implementations load resume data from `resume.json`. Each section needs a `title`, `body`, and `category`:

```json
[
  {
    "title": "Experience",
    "body": "Software Engineer\n@ Company Name\n2022 – Present",
    "category": "experience"
  }
]
```

Add or remove sections freely, the shelf adapts automatically.

## Architecture

All implementations follow the same core loop:

```
Camera frame → MediaPipe hand detection → Gesture recognition → State update → Render
```

### Visual Design

- Dark background (`#0F0F14`)
- Accent (`#FFD700`) for highlights, indicators, hand labels
- Corner-mark-only boxes (detached `+` corners, no full borders)
- Smooth easing animations for open/close transitions
- Hand skeleton overlay (21 landmarks + bone connections)
- Onboarding hints on first launch


## Legacy

The original Python/OpenCV implementation lives in `python-legacy/`. It requires Python 3.11+ and `uv sync` to install deps. See that directory for details.
