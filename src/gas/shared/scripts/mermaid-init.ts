export const MERMAID_CDN_URL = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js";

export const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: "default" as const,
  securityLevel: "loose" as const,
  flowchart: { htmlLabels: false },
  sequence: { useMaxWidth: false },
  gantt: { useMaxWidth: false },
};
