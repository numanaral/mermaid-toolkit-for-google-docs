export const MERMAID_CDN_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

export const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: "default" as const,
  securityLevel: "loose" as const,
  htmlLabels: false,
  flowchart: { htmlLabels: false },
  class: { htmlLabels: false },
  state: { htmlLabels: false },
  sequence: { useMaxWidth: false },
  gantt: { useMaxWidth: false },
};
