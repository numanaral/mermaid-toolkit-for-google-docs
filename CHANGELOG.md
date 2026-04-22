# Changelog

All notable changes to Mermaid Toolkit for Google Docs™ are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.1.0] — 2026-04-22

**Text-based checkboxes, narrower OAuth scope.**

### Why this release exists

The Google Apps Script `DocumentApp` API — the API available to Google Workspace™ add-ons — has no method for creating native Google Docs™ checkbox glyphs. There is no `createChecklist()`, no `setGlyphType(GlyphType.CHECKBOX)`, nothing. The only supported path is a REST API call (`Docs.Documents.batchUpdate` with a `BULLET_CHECKBOX` preset) through the Docs Advanced Service.

v1.0.0 bridged this gap by enabling the Advanced Service, which in turn required the broader `documents` OAuth scope. That scope gives an application continuous, offline access to every Google Docs™ file the user owns — far more than this add-on ever needed.

Google's OAuth verification team declined to approve the `documents` scope for this add-on (correctly, given the minimum-scope policy). v1.1.0 removes the Advanced Service dependency entirely and replaces native checkboxes with a plain-text `[ ] ` / `[x] ` representation inside ordinary bullet list items. The scope narrows from `documents` to `documents.currentonly`, which limits the add-on to the currently open document and removes all offline access.

### Changed

- **OAuth scope:** `documents` → `documents.currentonly`. The add-on can no longer reach any file other than the one you have open, and has no continuous or offline access. Although this removes some functionality, it's the only way to get approval.
- **Removed Docs Advanced Service dependency.** Import and export now run entirely through `DocumentApp`. No `Docs.Documents.get`, no `Docs.Documents.batchUpdate`.
- **Checklists use plain-text `[ ] ` / `[x] ` markers.** Markdown checklist items (`- [ ]`, `- [x]`) are imported as ordinary bullet list items whose text begins with a literal `[ ] ` or `[x] ` prefix. Export reads the prefix back into standard markdown so state round-trips.
- **Checkbox state round-trips losslessly.** A task imported as `- [x] Done` exports as `- [x] Done`. The previous release had to export every task as unchecked because the Docs REST API never exposed the checked state.

### Added

- **Changelog page.** A new `/changelog/` page on the site renders this file directly at build time, and links from the navigation and footer.

### Removed

- **Docs API Blocks debug tab** in the Dev Tools → Inspect Document inspector. The tab relied on `Docs.Documents.get` and cannot function under the narrower scope. The inspector keeps the `DocumentApp`-based view and adds new columns (listId, nesting level, indent) to partially cover the loss.
- **Non-primary tab latency warning** in the Import from Markdown dialog. The 5–6 second latency it warned about came from the REST API round-trip and no longer exists.

## [v1.0.0] — 2026-04-21

**Initial public release.**

### Added

- **Insert Mermaid Diagram** — full side-by-side editor with live preview and templates.
- **Edit All / Edit Selected Mermaid Diagram** — in-place editing with live preview.
- **Convert All / Selected Code to Diagrams** — render Mermaid code blocks as diagrams in batch.
- **Convert All / Selected Diagrams to Code** — extract the original Mermaid source from diagram alt text.
- **Import from Markdown** — paste markdown with Mermaid blocks; headings, lists, tables, inline code, and checkboxes are created in the doc.
- **Export as Markdown** — convert the entire doc back to markdown with Mermaid source preserved.
- **Fix Native "Copy as Markdown"** — repair mangled Mermaid syntax produced by Google's own Copy as Markdown feature.
- **Public site** at [mermaid.numanaral.dev](https://mermaid.numanaral.dev/?utm_source=github&utm_medium=changelog_md&utm_campaign=mermaid_toolkit) covering features, gallery, limitations, FAQ, privacy, and support.

### OAuth scopes (v1.0.0)

- `https://www.googleapis.com/auth/documents` — used by the Docs Advanced Service to create native Google Docs™ checkbox glyphs during markdown import.
- `https://www.googleapis.com/auth/script.container.ui` — display dialog windows inside Google Docs™.

Superseded by v1.1.0's `documents.currentonly` scope. See the v1.1.0 entry above for the full rationale.

[v1.1.0]: https://github.com/numanaral/mermaid-toolkit-for-google-docs/releases/tag/v1.1.0
[v1.0.0]: https://github.com/numanaral/mermaid-toolkit-for-google-docs/releases/tag/v1.0.0
