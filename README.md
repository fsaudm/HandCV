# HandCV

A hand-gesture interactive resume powered by MediaPipe. Browse, expand, and explore resume sections using hand gestures captured via webcam. 

<p align="center">
  <img src="handcv.gif" alt="HandCV demo" width="600">
</p>

**Live demo:** [fsaudm.github.io/handcv/](https://fsaudm.github.io/handcv/)
*Note: Requires a modern browser with webcam access (Brave/Safari recommended)*.

## Quick Start

In dev:
```bash
npx live-server . --open=dial/     # dial mode
# npx live-server . --open=pinch/    # pinch mode
```

Project structure:
```
HandCV/
  dial/        - primary app (tilt to browse, open hand to expand)
  pinch/       - alternate mode (pinch to grab, drag to place, kinda outdated)
  resume/      - resume content as Markdown files
```

## Dial Mode (`dial/`)

Left hand controls a tilt dial to browse sections. Right hand expands/collapses cards.

| Gesture | Action |
|---------|--------|
| Open left hand + tilt | Browse shelf sections |
| Close left hand | Pause browsing |
| Open right hand | Expand selected card |
| Close right hand | Collapse card |
| Hover index finger on link | Open URL in new tab |

### Features

- **Markdown resume content**: each section is a `.md` file in `resume/` with YAML frontmatter for the title. `resume/index.json` controls shelf order.
- **Inline links**: use `[text](url)` in Markdown. Links render in blue and can be opened by hovering your index finger over them (a gold ring fills, then the link opens).
- **Text diffusion effect**: text materializes from scrambled characters when a card expands, and scrambles out on collapse. Pluggable via `texteffects.js` (set `TEXT_EFFECT: 'none'` in config to disable).
- **Headings and lists**: `## Heading` renders larger/brighter, `- item` renders as indented bullets, `---` draws a separator line.
- **Visual hand cues**: both wrists show a ring indicator (gold when hand is open, dim when closed).
- **Relative tilt with recalibration**: closing and reopening your left hand resets the neutral angle, so no awkward hand positions.

### Resume Content

Resume sections live in `resume/*.md`. Each file has a title in frontmatter:

```markdown
---
title: Skills
---

## Languages
Python - R - SQL - Bash
...
```

`resume/index.json` controls the shelf order:

```json
[
  "about.md",
  "experience.md",
  "projects.md",
  "skills.md"
]
```

## Pinch Mode (`pinch/`)

Eventually document if revived...