# Contributing to Mermaid Toolkit for Google Docs

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Yarn](https://classic.yarnpkg.com/) v1 (Classic)
- A Google account with access to Google Docs

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/numanaral/mermaid-toolkit-for-google-docs.git
cd mermaid-toolkit-for-google-docs

# 2. Install dependencies
yarn install

# 3. Copy the environment template
cp .env.example .env
```

## Setting Up the Add-on for Testing

You'll need your own Apps Script project to test changes in Google Docs.

### Create a test Apps Script project

1. Open a Google Doc (or create a new one)
2. Go to **Extensions > Apps Script**
3. In the Apps Script editor, go to **Project Settings** (gear icon)
4. Copy the **Script ID**

### Configure clasp

1. Paste your Script ID into `.env`:
   ```
   CLASP_SCRIPT_ID=your-script-id-here
   ```

2. Create `.clasp.json` in the repo root:
   ```json
   {
     "scriptId": "your-script-id-here",
     "rootDir": "dist/gas"
   }
   ```

3. Enable the Apps Script API at https://script.google.com/home/usersettings

4. Log in to clasp:
   ```bash
   yarn clasp:login
   ```

### Deploy and test

```bash
# Build the add-on and push to your Apps Script project
yarn clasp:push

# This runs: lint -> typecheck -> build:gas -> clasp push
```

After pushing, reload your Google Doc. The add-on appears under **Extensions > Mermaid Toolkit**.

### Development workflow

```bash
# Watch for changes and rebuild automatically
yarn dev:gas

# In another terminal, push when ready
yarn clasp:push
```

## Project Structure

```
├── site/                  # Marketing website (Eleventy + SCSS + TS)
│   ├── _data/             # Site data (site.json)
│   ├── _includes/         # Nunjucks templates
│   ├── assets/            # Images, brand assets
│   ├── scripts/           # Client-side TypeScript
│   └── styles/            # SCSS (base, components, layout)
├── src/gas/               # Google Apps Script add-on
│   ├── server/            # Server-side code (Code.ts, utilities)
│   ├── dialogs/           # Dialog UI (HTML + SCSS + TS per dialog)
│   │   ├── editor/        # Live Mermaid editor
│   │   ├── preview/       # Code-to-diagram preview
│   │   ├── extract/       # Image-to-code extraction
│   │   ├── convert/       # Single code-to-diagram conversion
│   │   ├── fixmarkdown/   # Markdown repair tool
│   │   ├── about/         # About dialog
│   │   └── quickguide/    # Quick guide dialog
│   └── shared/            # Shared styles, scripts, templates
│       ├── styles/        # SCSS (base, components, layout)
│       ├── scripts/       # Shared TypeScript utilities
│       └── templates/     # Shared HTML partials (footer)
├── scripts/               # Build tooling (TypeScript)
│   ├── build-gas.ts       # GAS build pipeline
│   └── dev-gas.ts         # GAS file watcher
├── dist/gas/              # Built GAS output (gitignored)
└── _site/                 # Built site output (gitignored)
```

## Available Scripts

| Command | Description |
|---|---|
| `yarn dev` | Start the site dev server with live reload |
| `yarn build` | Production build for the site |
| `yarn dev:gas` | Watch GAS source files and rebuild on change |
| `yarn build:gas` | Build the GAS add-on to `dist/gas/` |
| `yarn verify` | Run ESLint + TypeScript checks |
| `yarn lint` | Run ESLint only |
| `yarn typecheck` | Run TypeScript type checking only |
| `yarn clasp:login` | Authenticate with Google via clasp |
| `yarn clasp:push` | Verify, build, and push to Apps Script |

## Code Style

- **TypeScript** for all source code (no plain `.js` except Eleventy config)
- **SCSS** with `@use` imports (no `@import`)
- **`interface`** over `type` for object shapes
- Explicit `return` with braces for multi-line arrow functions
- ESLint enforces consistent style — run `yarn lint` before committing

## How the GAS Build Works

The build pipeline (`scripts/build-gas.ts`) does the following:

1. **Server**: Compiles `src/gas/server/Code.ts` via esbuild, then post-processes the output to produce GAS-compatible `Code.gs` (top-level function declarations, no module system)
2. **Styles**: Compiles each dialog's SCSS to minified CSS
3. **Scripts**: Bundles each dialog's TypeScript to minified IIFE
4. **Assembly**: Injects compiled CSS and JS into each dialog's HTML template, producing self-contained HTML files that GAS can serve

## Pull Requests

1. Fork the repo and create a feature branch from `main`
2. Make your changes
3. Run `yarn verify` to ensure lint and types pass
4. Run `yarn build:gas` to verify the build succeeds
5. Test in Google Docs if your change affects the add-on
6. Open a PR with a clear description of what changed and why

## Reporting Issues

Use [GitHub Issues](https://github.com/numanaral/mermaid-toolkit-for-google-docs/issues) for bug reports and feature requests. Include:

- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Screenshots if applicable
- Browser and OS info
