interface InspChildInfo {
  idx: number;
  type: string;
  heading: string;
  glyph: string;
  nest: number;
  text: string;
  font: string;
}

interface InspApiBlock {
  idx: number;
  type: string;
  listId: string;
  nestLevel: number;
  indent: string;
  text: string;
  glyphType: string;
  glyphSymbol: string;
  strikethrough: boolean;
  bulletRaw: string;
  textStyleRaw: string;
}

declare const inspectorData: {
  numChildren: number;
  tabId: string;
  isFirstTab: boolean;
  children: InspChildInfo[];
  apiBlocks: InspApiBlock[];
};

(() => {
  const esc = (s: string): string => {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  };

  const trunc = (s: string, n: number): string =>
    s.length > n ? s.substring(0, n) + "..." : s;

  document.getElementById("stat-children")!.textContent =
    "Children: " + inspectorData.numChildren;
  document.getElementById("stat-tab")!.textContent =
    "Tab: " + (inspectorData.isFirstTab ? "#1 (primary)" : inspectorData.tabId);

  const tabs = document.querySelectorAll<HTMLElement>(".tab");
  const panes = document.querySelectorAll<HTMLElement>(".tab-content");
  for (let ti = 0; ti < tabs.length; ti++) {
    ((i: number) => {
      tabs[i].onclick = () => {
        for (let j = 0; j < tabs.length; j++) {
          tabs[j].classList.remove("active");
          panes[j].classList.remove("active");
        }
        tabs[i].classList.add("active");
        panes[i].classList.add("active");
      };
    })(ti);
  }

  const copyParts: Record<string, string[]> = { docapp: [], docsapi: [] };

  let h =
    "<table><tr><th>#</th><th>Type</th><th>Heading</th><th>Glyph</th><th>Nest</th><th>Font</th><th>Text</th></tr>";
  copyParts.docapp.push("# DocumentApp Children");
  copyParts.docapp.push("idx|type|heading|glyph|nest|font|text");
  copyParts.docapp.push("---|----|----|-----|----|----|----");

  for (const c of inspectorData.children) {
    const cls =
      c.type === "TABLE"
        ? "table-row"
        : c.heading && c.heading !== "NORMAL"
          ? "heading"
          : "";
    h +=
      '<tr class="' +
      cls +
      '"><td>' +
      c.idx +
      "</td><td>" +
      c.type +
      "</td><td>" +
      esc(c.heading) +
      "</td><td>" +
      esc(c.glyph) +
      "</td><td>" +
      (c.nest >= 0 ? c.nest : "") +
      "</td><td>" +
      esc(c.font) +
      '</td><td class="mono">' +
      esc(trunc(c.text, 200)) +
      "</td></tr>";
    copyParts.docapp.push(
      c.idx +
        "|" +
        c.type +
        "|" +
        c.heading +
        "|" +
        c.glyph +
        "|" +
        (c.nest >= 0 ? c.nest : "") +
        "|" +
        c.font +
        "|" +
        c.text.replace(/\n/g, "\\n"),
    );
  }
  h += "</table>";
  document.getElementById("tc-docapp")!.innerHTML = h;

  let h2 =
    "<table><tr><th>#</th><th>Type</th><th>ListId</th><th>Nest</th><th>Indent</th><th>GlyphType</th><th>GlyphSym</th><th>Strike</th><th>Bullet (raw)</th><th>TextStyle (raw)</th><th>Text</th></tr>";
  copyParts.docsapi.push("# Docs API Blocks");
  copyParts.docsapi.push(
    "idx|type|listId|nest|indent|glyphType|glyphSym|strike|bulletRaw|textStyleRaw|text",
  );
  copyParts.docsapi.push(
    "---|----|----|----|----|---------|--------|------|---------|------------|----",
  );

  for (const b of inspectorData.apiBlocks) {
    const cls2 =
      b.type.indexOf("SECTION") >= 0
        ? "section"
        : b.type.indexOf("TABLE") >= 0
          ? "table-row"
          : b.glyphType === "GLYPH_TYPE_UNSPECIFIED"
            ? "cb"
            : b.type.indexOf("HEADING") >= 0
              ? "heading"
              : "";
    h2 +=
      '<tr class="' +
      cls2 +
      '"><td>' +
      b.idx +
      "</td><td>" +
      esc(b.type) +
      '</td><td class="mono">' +
      esc(b.listId) +
      "</td><td>" +
      (b.nestLevel >= 0 ? b.nestLevel : "") +
      "</td><td>" +
      esc(b.indent) +
      "</td><td>" +
      esc(b.glyphType) +
      "</td><td>" +
      esc(b.glyphSymbol) +
      "</td><td>" +
      (b.strikethrough ? "YES" : "") +
      '</td><td class="mono" style="max-width:200px;overflow:auto;font-size:10px">' +
      esc(b.bulletRaw || "") +
      '</td><td class="mono" style="max-width:200px;overflow:auto;font-size:10px">' +
      esc(b.textStyleRaw || "") +
      '</td><td class="mono">' +
      esc(trunc(b.text, 200)) +
      "</td></tr>";
    copyParts.docsapi.push(
      b.idx +
        "|" +
        b.type +
        "|" +
        b.listId +
        "|" +
        (b.nestLevel >= 0 ? b.nestLevel : "") +
        "|" +
        b.indent +
        "|" +
        b.glyphType +
        "|" +
        b.glyphSymbol +
        "|" +
        (b.strikethrough ? "YES" : "") +
        " |" +
        (b.bulletRaw || "") +
        "|" +
        (b.textStyleRaw || "") +
        "|" +
        b.text.replace(/\n/g, "\\n"),
    );
  }
  h2 += "</table>";
  document.getElementById("tc-docsapi")!.innerHTML = h2;

  const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
  copyBtn.addEventListener("click", () => {
    let active = "docapp";
    for (let k = 0; k < tabs.length; k++) {
      if (tabs[k].classList.contains("active")) {
        active = tabs[k].getAttribute("data-tab") ?? "docapp";
        break;
      }
    }
    const text = copyParts[active].join("\n");

    const onSuccess = (): void => {
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy Active Tab";
        copyBtn.classList.remove("copied");
      }, 1500);
    };

    navigator.clipboard
      .writeText(text)
      .then(onSuccess)
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        onSuccess();
      });
  });
})();
