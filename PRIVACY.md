# Privacy Policy — Mermaid Toolkit for Google Docs™

**Last updated:** April 22, 2026 — see the [changelog](https://mermaid.numanaral.dev/changelog/?utm_source=github&utm_medium=privacy_md&utm_campaign=mermaid_toolkit#v1-1-0) for the most recent scope change.

## Overview

Mermaid Toolkit for Google Docs™ is a Google Docs™ add-on that renders Mermaid diagram syntax as images. Your privacy is important — this add-on is designed to work entirely within your browser with no external data transmission.

## Data Collection

This add-on does **not** collect, store, or transmit any user data. Specifically:

- **No analytics** — No usage tracking of any kind
- **No cookies** — No cookies are set or read
- **No telemetry** — No diagnostic data is sent anywhere
- **No advertising** — No ads, no ad-related tracking
- **No user accounts** — No sign-up or login required beyond Google's own authentication

## How Your Data Is Processed

All diagram rendering happens **client-side** in your browser using the [Mermaid.js](https://mermaid.js.org/) library. When you use this add-on:

1. Your Mermaid code is read from the Google Docs™ document
2. The diagram is rendered locally in your browser via Mermaid.js
3. The rendered diagram is inserted back into your Google Docs™ document

**No diagram content, document text, or any other data is sent to any external server.**

## OAuth Scopes

This add-on requests the following Google OAuth scopes:

| Scope | Why It's Needed |
|---|---|
| `https://www.googleapis.com/auth/documents.currentonly` | Read Mermaid code snippets, insert rendered diagrams, and import/export Markdown in the currently open document |
| `https://www.googleapis.com/auth/script.container.ui` | Display dialog windows (editor, preview, import/export) within Google Docs™ |

These are the narrowest scopes Google offers for a Google Docs™ add-on. `documents.currentonly` limits access to **only** the document the user currently has open — it cannot read, modify, or enumerate any other files in your Google Drive™, and it has no continuous or offline access.

## Third-Party Services

This add-on loads the following open-source libraries from **jsDelivr** (`cdn.jsdelivr.net`), a public open-source CDN:

- **[Mermaid.js](https://mermaid.js.org/)** — diagram rendering (used by all features)
- **[Marked.js](https://marked.js.org/)** — Markdown parsing (used by Import from Markdown)

These are the only external network requests the add-on makes. **No user data, document content, or diagram code is sent to jsDelivr** — only the library scripts are fetched.

jsDelivr may log standard HTTP metadata (IP address, user-agent) as part of normal CDN operation. This is outside the add-on's control. See [jsDelivr's privacy policy](https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net) for details.

All rendering and parsing happens locally in your browser after the libraries are loaded. No other third-party services, APIs, or servers are used.

## Data Sharing

Your data is never shared with anyone. There is no server-side component, no database, and no mechanism to collect or share data.

## Changes to This Policy

If this privacy policy changes, the update will be reflected in this document with a new "Last updated" date. Since no data is collected, meaningful changes are unlikely.

## Contact

If you have questions about this privacy policy, please visit our [Support page](https://mermaid.numanaral.dev/support?utm_source=github&utm_medium=privacy_md&utm_campaign=mermaid_toolkit).

---

<sub>Google Docs™, Google Drive™, and Google Workspace™ are trademarks of Google LLC. This add-on is not affiliated with or endorsed by Google.</sub>
