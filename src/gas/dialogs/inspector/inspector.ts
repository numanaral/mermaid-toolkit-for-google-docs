interface InspChildInfo {
  idx: number;
  type: string;
  heading: string;
  glyph: string;
  nest: number;
  text: string;
  listId: string;
  indent: string;
}

declare const inspectorData: {
  numChildren: number;
  tabId: string;
  isFirstTab: boolean;
  children: InspChildInfo[];
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

  const columns: Array<{ key: keyof InspChildInfo; label: string }> = [
    { key: "idx", label: "#" },
    { key: "type", label: "Type" },
    { key: "heading", label: "Heading" },
    { key: "glyph", label: "Glyph" },
    { key: "listId", label: "List" },
    { key: "nest", label: "Nest" },
    { key: "indent", label: "Indent (start/first)" },
    { key: "text", label: "Text" },
  ];

  const copyRows: string[] = [];
  copyRows.push("| " + columns.map((c) => c.label).join(" | ") + " |");
  copyRows.push("| " + columns.map(() => "---").join(" | ") + " |");

  let h = "<table><tr>";
  for (const col of columns) h += "<th>" + col.label + "</th>";
  h += "</tr>";

  const cellFor = (c: InspChildInfo, key: keyof InspChildInfo): string => {
    if (key === "idx") return String(c.idx);
    if (key === "nest") return c.nest >= 0 ? String(c.nest) : "";
    if (key === "text") return trunc(c.text, 200);
    return String(c[key] ?? "");
  };

  for (const c of inspectorData.children) {
    const cls =
      c.type === "TABLE"
        ? "table-row"
        : c.heading && c.heading !== "NORMAL"
          ? "heading"
          : "";
    h += '<tr class="' + cls + '">';
    const row: string[] = [];
    for (const col of columns) {
      const raw = cellFor(c, col.key);
      const tdClass = col.key === "text" ? ' class="mono"' : "";
      h += "<td" + tdClass + ">" + esc(raw) + "</td>";
      // Pipes inside markdown tables must be escaped so the row parses cleanly.
      const cell =
        col.key === "text"
          ? raw.replace(/\|/g, "\\|").replace(/\n/g, "\\n")
          : raw;
      row.push(cell);
    }
    h += "</tr>";
    copyRows.push("| " + row.join(" | ") + " |");
  }
  h += "</table>";
  document.getElementById("tc-docapp")!.innerHTML = h;

  const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
  const defaultLabel = copyBtn.textContent ?? "Copy as Markdown";
  copyBtn.addEventListener("click", () => {
    const text = copyRows.join("\n");

    const onSuccess = (): void => {
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = defaultLabel;
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
