let counter = 0;
const items = document.querySelectorAll<HTMLElement>(".gallery-item[data-mermaid]");

async function loadMermaid() {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({ startOnLoad: false, theme: "default" });
  return mermaid;
}

const mermaidPromise = items.length ? loadMermaid() : null;

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const item = entry.target as HTMLElement;
      observer.unobserve(item);
      const code = item.getAttribute("data-mermaid");
      const container = item.querySelector<HTMLElement>(".gallery-item-render");
      if (!code || !container) return;

      const id = "mermaid-" + counter++;
      mermaidPromise!
        .then((mermaid) => mermaid.render(id, code))
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

new MutationObserver((mutations) => {
  mutations.forEach((m) => {
    m.addedNodes.forEach((node) => {
      const el = node as HTMLElement;
      if (el.id?.startsWith("d") && el.tagName === "svg") el.remove();
    });
  });
}).observe(document.body, { childList: true });
