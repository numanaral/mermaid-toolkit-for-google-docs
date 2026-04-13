# Scripts

Build tooling and automation for the Mermaid Toolkit project.

## Build & Dev

| Script | Description |
|---|---|
| `build-gas.ts` | GAS build pipeline — compiles server TypeScript, dialog SCSS/TS, and assembles self-contained HTML files for Apps Script |
| `dev-gas.ts` | File watcher that rebuilds GAS output on source changes |
| `push.ts` | Runs verify + build + `clasp push` in sequence |
| `preview-gas.ts` | Serves built GAS HTML dialogs locally for browser inspection |
| `build.sh` | Shell wrapper for site + GAS builds |
| `dev.sh` | Shell wrapper for concurrent site + GAS dev servers |

## Verification

| Script | Description |
|---|---|
| `verify.ts` | Runs ESLint + TypeScript checks across site and GAS code |
| `verify-fix.ts` | Same as verify but with ESLint auto-fix enabled |
| `typecheck.ts` | TypeScript-only check for the site |
| `typecheck-gas.ts` | TypeScript-only check for GAS code |

## Testing

| Script | Description |
|---|---|
| `test-gdocs.ts` | Standalone Playwright smoke test — opens a Google Doc™ with the add-on and exercises menu items. Requires `DOC_URL` in `.env`. |

## Demo Recording Pipeline (`demo/`)

End-to-end pipeline for recording, processing, and publishing demo assets.

| Script | Description |
|---|---|
| `demo/recorder.ts` | Orchestrator — launches Playwright browser, runs all step scripts in order, captures video + screenshots + timestamps |
| `demo/helpers.ts` | Shared constants (`DOC_URL`, `SCREENSHOTS_DIR`, viewport dimensions) and Playwright utility functions |
| `demo/steps/` | Individual step scripts (`00-reset.ts` through `13-about.ts`) — each demonstrates one add-on feature |
| `demo/split-clips.ts` | Splits the full recording into per-step `.webm` clips using timestamps |
| `demo/to-gif.ts` | Converts per-step clips to optimized GIFs (palette-based, scaled to 720px) |
| `demo/to-webm.ts` | Generates optimized VP9 WebM clips for the site (scaled to 720px) |
| `demo/demo-gif.ts` | Generates a single combined demo GIF from the full recording, skipping the reset step |
| `demo/site-video.ts` | Cuts the demo video (skip reset) and copies it to `site/assets/demo/demo.webm` |
| `demo/analyze-clips.ts` | Diagnostic tool for identifying timing drift between timestamps and actual video |
| `demo/trim-offsets.json` | Per-step trim configuration (start/end padding in ms) |

### Typical workflow

```bash
yarn demo:record       # Record full demo
yarn demo:gif          # Generate per-step GIFs
yarn demo:webm         # Generate per-step WebM clips for site
yarn demo:demo-gif     # Generate combined demo GIF
yarn demo:site-video   # Cut site video
```

All demo output goes to `temp/demo/` (gitignored). Site assets are written to `site/assets/demo/` (video), `site/assets/clips/` (WebM), and `site/assets/gifs/` (GIF for README/GitHub).

See `demo/PLAYWRIGHT-GUIDE.md` for detailed Playwright setup and troubleshooting.
