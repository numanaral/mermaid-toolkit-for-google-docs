declare const mermaid: {
  initialize(config: Record<string, unknown>): void;
  render(id: string, code: string): Promise<{ svg: string }>;
};

mermaid.initialize({ startOnLoad: false, theme: "default" });

let counter = 0;
const items = document.querySelectorAll<HTMLElement>(".gallery-item[data-mermaid]");

const observer = new IntersectionObserver(
  (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const item = entry.target as HTMLElement;
      observer.unobserve(item);
      const code = item.getAttribute("data-mermaid");
      const container = item.querySelector<HTMLElement>(".gallery-item-render");
      if (!code || !container) return;
      const id = "mermaid-" + counter++;
      mermaid
        .render(id, code)
        .then((result) => {
          container.innerHTML = result.svg;
        })
        .catch(() => {
          container.innerHTML =
            '<span class="mermaid-placeholder">Preview not available — <a href="https://mermaid.js.org/" target="_blank" rel="noopener" style="color:var(--accent)">try on mermaid.js.org</a></span>';
        });
    });
  },
  { rootMargin: "200px" },
);

items.forEach((item) => observer.observe(item));

new MutationObserver((mutations: MutationRecord[]) => {
  mutations.forEach((m) => {
    m.addedNodes.forEach((node) => {
      const el = node as HTMLElement;
      if (el.id?.startsWith("d") && el.tagName === "svg") el.remove();
    });
  });
}).observe(document.body, { childList: true });
