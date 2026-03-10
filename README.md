&nbsp;  
&nbsp;  
&nbsp;  

---

> **⏳ Awaiting Google Verification:** Currently undergoing branding verification by Google's Trust and Safety team. The Marketplace listing will be submitted for review once verification is complete. Install link coming soon!

---

&nbsp;  
&nbsp;  
&nbsp;  

<p align="center">
  <img src="site/assets/brand/icon-128.png" alt="Mermaid Toolkit for Google Docs™" width="128" height="128" />
</p>

<h1 align="center">Mermaid Toolkit for Google Docs™</h1>

<p align="center">
  Render Mermaid diagrams as images directly in Google Docs™.<br/>
  Client-side rendering — no data leaves your browser.
</p>

<p align="center">
  <!-- TODO: Replace with actual Marketplace URL once published -->
  <a href="#installation"><img src="https://img.shields.io/badge/Google%20Workspace-Install%20Add--on-4285F4?logo=google&logoColor=white" alt="Install from Google Workspace Marketplace" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" /></a>
</p>

---

## Features

- **Convert All Code to Diagrams** — Scans your entire document for Mermaid code blocks and renders them all as high-quality images in one click
- **Convert Selected Code to Diagram** — Render a single selected code block without scanning the whole document
- **Insert Mermaid Diagram** — Side-by-side editor with real-time preview, syntax highlighting, and starter templates
- **Edit Selected Mermaid Image** — Click any diagram image and edit its source in place
- **Convert Image to Code** — Extract the original Mermaid source from any diagram image inserted by this add-on (single or bulk)
- **Fix Copied Markdown** — Repairs corrupted Mermaid syntax caused by Google Docs' paste behavior (vertical tabs, stray backticks, formatting artifacts). [Learn more](https://numanaral.github.io/mermaid-toolkit-for-google-docs/features#fix-markdown)
- **100% client-side** — All rendering happens in your browser via [mermaid.js](https://mermaid.js.org/). No data is sent to any server

## Screenshots

### Live Editor
<img src="site/assets/screenshots/example-editor.png" alt="Mermaid Editor — side-by-side code and preview" width="800" />

### Render Preview (single diagram)
<img src="site/assets/screenshots/example-render-all-for-one.png" alt="Render preview for a single diagram" width="800" />

### Render Preview (all diagrams)
<img src="site/assets/screenshots/example-render-all-for-all.png" alt="Render preview for all diagrams with bulk actions" width="800" />

### Extensions Menu
<img src="site/assets/screenshots/example-menu.png" alt="Extensions menu showing Mermaid Toolkit options" width="800" />

## Installation

<!-- TODO: Replace # with actual Marketplace URL once published -->
1. Visit the [Google Workspace Marketplace™ listing](#)
2. Click **Install**
3. Grant the required permissions (see [Privacy](#privacy))
4. Open any Google Doc — the add-on appears under **Extensions → Mermaid Toolkit**

## How to Use

### Render existing Mermaid code

1. In your Google Doc, insert a code block: **Insert → Building blocks → Code block**
2. Write your Mermaid syntax inside the code block
3. Go to **Extensions → Mermaid Toolkit → Convert All Code to Diagrams**
4. A preview dialog shows each detected diagram — click **Insert** or **Replace**

> **Important:** The first line of your code block must be a diagram type keyword (e.g. `graph TD`, `sequenceDiagram`, `erDiagram`). Comments (`%%`) are fine after the first line, but a comment on the very first line will prevent the snippet from being detected.

### Use the built-in editor

1. Go to **Extensions → Mermaid Toolkit → Insert Mermaid Diagram**
2. Write or paste Mermaid syntax in the left panel
3. See the live preview on the right
4. Pick a template from the dropdown to get started quickly
5. Click **Insert into Document** when you're happy with the result

### Fix pasted markdown

1. Go to **Extensions → Mermaid Toolkit → Fix Copied Markdown**
2. Paste the corrupted code — the tool shows a side-by-side diff of what it will fix
3. Click **Copy Fixed** and paste it back into your doc

### Other menu options

- **Convert Selected Code to Diagram** — Select text and render just that as a diagram
- **Edit Selected Mermaid Image** — Click a diagram image and edit its source
- **Convert Selected Image to Code** — Extract Mermaid source from a single diagram image
- **Convert All Images to Code** — Extract source from all diagram images in the document
- **Quick Guide** — Feature overview and documentation links
- **About** — Version info and links

## Supported Diagram Types

The add-on detects code blocks that start with any of the following keywords:

| Diagram | Keyword |
|---|---|
| Flowchart | `flowchart` / `graph` |
| Sequence Diagram | `sequenceDiagram` |
| Class Diagram | `classDiagram` |
| State Diagram | `stateDiagram` |
| ER Diagram | `erDiagram` |
| Gantt Chart | `gantt` |
| Pie Chart | `pie` |
| Git Graph | `gitGraph` |
| User Journey | `journey` |
| Mindmap | `mindmap` |
| Timeline | `timeline` |
| Sankey | `sankey` |
| XY Chart | `xychart` |
| Block Diagram | `block-beta` |
| Quadrant Chart | `quadrantChart` |
| Requirement Diagram | `requirementDiagram` |
| C4 Diagrams | `c4context` / `c4container` / `c4component` / `c4dynamic` / `c4deployment` |

See the [mermaid.js docs](https://mermaid.js.org/) for syntax details on each type.

## Privacy

This add-on **does not collect, store, or transmit any data**. All diagram rendering happens locally in your browser. No analytics, no tracking, no cookies.

The add-on requests only two OAuth scopes:
- `documents.currentonly` — to read code snippets and insert images in the current document
- `script.container.ui` — to display dialog windows

Read the full [Privacy Policy](https://numanaral.github.io/mermaid-toolkit-for-google-docs/privacy).

## Terms of Service

This add-on is provided "as is" without warranty. It is free to use and not affiliated with Google or Mermaid.js.

Read the full [Terms of Service](https://numanaral.github.io/mermaid-toolkit-for-google-docs/terms).

## Support

Need help or have feedback? Visit the [Support page](https://numanaral.github.io/mermaid-toolkit-for-google-docs/support) for all the ways to reach us.

- **Bug reports:** [Open an issue](https://github.com/numanaral/mermaid-toolkit-for-google-docs/issues)
- **Questions & feedback:** [Join the discussion](https://github.com/numanaral/mermaid-toolkit-for-google-docs/discussions)

## License

[MIT](LICENSE) — Copyright (c) 2026 Numan Aral

---

<p align="center">
  Created by <a href="https://numanaral.github.io">Numan Aral</a>
</p>

<sub>Google Docs™, Google Drive™, and Google Workspace™ are trademarks of Google LLC. This add-on is not affiliated with or endorsed by Google.</sub>
