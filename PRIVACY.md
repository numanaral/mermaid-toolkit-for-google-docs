# Privacy Policy — Mermaid for Google Docs™

**Last updated:** March 8, 2026

## Overview

Mermaid for Google Docs™ is a Google Docs™ add-on that renders Mermaid diagram syntax as images. Your privacy is important — this add-on is designed to work entirely within your browser with no external data transmission.

## Data Collection

This add-on does **not** collect, store, or transmit any user data. Specifically:

- **No analytics** — No usage tracking of any kind
- **No cookies** — No cookies are set or read
- **No telemetry** — No diagnostic data is sent anywhere
- **No advertising** — No ads, no ad-related tracking
- **No user accounts** — No sign-up or login required beyond Google's own authentication

## How Your Data Is Processed

All diagram rendering happens **client-side** in your browser using the [mermaid.js](https://mermaid.js.org/) library. When you use this add-on:

1. Your Mermaid code is read from the Google Docs™ document
2. The diagram is rendered locally in your browser via mermaid.js
3. The rendered image is inserted back into your Google Docs™ document

**No diagram content, document text, or any other data is sent to any external server.**

## OAuth Scopes

This add-on requests the following Google OAuth scopes:

| Scope | Why It's Needed |
|---|---|
| `https://www.googleapis.com/auth/documents.currentonly` | Read Mermaid code snippets from the current document and insert rendered diagram images back into it |
| `https://www.googleapis.com/auth/script.container.ui` | Display dialog windows (editor, preview) within Google Docs™ |

These are the minimum scopes required for the add-on to function. The `documents.currentonly` scope limits access to only the document you have open — the add-on cannot access any other files in your Google Drive™.

## Third-Party Services

This add-on does **not** use any third-party services, APIs, or servers. The mermaid.js library is loaded from a CDN directly into the browser for rendering purposes only.

## Data Sharing

Your data is never shared with anyone. There is no server-side component, no database, and no mechanism to collect or share data.

## Changes to This Policy

If this privacy policy changes, the update will be reflected in this document with a new "Last updated" date. Since no data is collected, meaningful changes are unlikely.

## Contact

If you have questions about this privacy policy, please visit our [Support page](https://numanaral.github.io/mermaid-for-google-docs/support).

---

<sub>Google Docs™, Google Drive™, and Google Workspace™ are trademarks of Google LLC. This add-on is not affiliated with or endorsed by Google.</sub>
