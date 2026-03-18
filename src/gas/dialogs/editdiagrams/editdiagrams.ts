import { loadScript } from "../../shared/scripts/load-script";
import { svgToPngBase64 } from "../../shared/scripts/svg-to-png";
import { escapeHtml } from "../../shared/scripts/escape-html";
import {
  MERMAID_CDN_URL,
  MERMAID_CONFIG,
} from "../../shared/scripts/mermaid-init";
import { markBtn, setLoading } from "../../shared/scripts/card-helpers";

declare const mermaid: {
  initialize(config: unknown): void;
  render(id: string, src: string): Promise<{ svg: string }>;
};
declare const imageInfos: Array<{ source: string; childIndex: number }>;

const OPEN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
  '<polyline points="15 3 21 3 21 9"/>' +
  '<line x1="10" y1="14" x2="21" y2="3"/></svg>';

const cardsEl = document.getElementById("cards")!;
const statusEl = document.getElementById("status")!;

const cardEls: HTMLElement[] = [];
const sources: string[] = [];
let renderCounter = 0;
let debounceTimers: Record<number, number> = {};

const buildCard = (
  index: number,
  info: (typeof imageInfos)[0],
  thumbBase64: string | null,
): void => {
  const card = document.createElement("div");
  card.className = "card";
  cardEls.push(card);
  sources[index] = info.source;

  const thumbSrc = thumbBase64
    ? "data:image/png;base64," + thumbBase64
    : "";

  let rowHtml =
    '<div class="card-row">' +
    '<span class="card-chevron">&#9654;</span>' +
    '<span class="card-num">' +
    (index + 1) +
    "</span>";

  if (thumbSrc) {
    rowHtml +=
      '<div class="thumb-hover" data-src="' +
      thumbSrc +
      '">' +
      '<img class="card-thumb" src="' +
      thumbSrc +
      '" />' +
      '<div class="open-badge">' +
      OPEN_SVG +
      "</div></div>";
  }

  rowHtml += '<span class="card-spacer"></span>';
  rowHtml += '<div class="header-actions">';
  rowHtml +=
    '<button class="btn btn-filled-primary" id="edit-' +
    index +
    '">Edit</button>';
  rowHtml += "</div></div>";

  const editorHtml =
    '<div class="editor-wrap" id="editor-wrap-' +
    index +
    '">' +
    '<div class="editor-inner">' +
    '<div class="inline-panels">' +
    '<div class="inline-panel">' +
    '<div class="inline-panel-label">Source</div>' +
    '<textarea id="src-' +
    index +
    '" spellcheck="false">' +
    escapeHtml(info.source) +
    "</textarea>" +
    "</div>" +
    '<div class="inline-panel">' +
    '<div class="inline-panel-label">Preview</div>' +
    '<div class="preview-scroll" id="pv-' +
    index +
    '">' +
    (thumbSrc
      ? '<img src="data:image/png;base64,' + thumbBase64 + '" />'
      : '<span style="color:var(--outline)">Rendering...</span>') +
    "</div>" +
    '<div class="error-bar" id="err-' +
    index +
    '"></div>' +
    "</div>" +
    "</div>" +
    '<div class="editor-footer">' +
    '<span class="spacer"></span>' +
    '<button class="btn btn-filled-secondary" id="save-' +
    index +
    '">Save &amp; Replace</button>' +
    "</div>" +
    "</div>" +
    "</div>";

  card.innerHTML = rowHtml + editorHtml;
  cardsEl.appendChild(card);

  const row = card.querySelector(".card-row")!;
  row.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".header-actions, .thumb-hover"))
      return;
    toggleEditor(index);
  });

  const editBtn = document.getElementById(
    "edit-" + index,
  ) as HTMLButtonElement;
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleEditor(index);
  });

  const thumbEl = card.querySelector(".thumb-hover");
  if (thumbEl) {
    thumbEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const src = thumbEl.getAttribute("data-src");
      if (src) window.open(src, "_blank");
    });
  }

  const textarea = document.getElementById(
    "src-" + index,
  ) as HTMLTextAreaElement;
  textarea.addEventListener("input", () => {
    sources[index] = textarea.value;
    schedulePreview(index);
  });

  const saveBtn = document.getElementById(
    "save-" + index,
  ) as HTMLButtonElement;
  saveBtn.addEventListener("click", () => doSave(index));
};

const toggleEditor = (index: number): void => {
  const card = cardEls[index];
  const wrap = document.getElementById("editor-wrap-" + index);
  if (!card || !wrap) return;

  const isOpen = card.classList.contains("expanded");
  card.classList.toggle("expanded", !isOpen);
  wrap.classList.toggle("visible", !isOpen);

  if (!isOpen) {
    schedulePreview(index, 0);
  }
};

const schedulePreview = (index: number, delay = 400): void => {
  if (debounceTimers[index]) clearTimeout(debounceTimers[index]);
  debounceTimers[index] = window.setTimeout(
    () => renderPreview(index),
    delay,
  );
};

const renderPreview = async (index: number): Promise<void> => {
  const pvEl = document.getElementById("pv-" + index);
  const errEl = document.getElementById("err-" + index);
  if (!pvEl || !errEl) return;

  const src = sources[index].trim();
  if (!src) {
    pvEl.innerHTML =
      '<span style="color:var(--outline)">Enter Mermaid code</span>';
    errEl.textContent = "";
    return;
  }

  const id = "live-svg-" + index + "-" + ++renderCounter;
  try {
    const rendered = await mermaid.render(id, src);
    const base64 = await svgToPngBase64(rendered.svg);
    if (base64) {
      pvEl.innerHTML =
        '<img src="data:image/png;base64,' + base64 + '" />';
    } else {
      pvEl.innerHTML =
        '<span style="color:var(--outline)">Render failed</span>';
    }
    errEl.textContent = "";
  } catch (e) {
    errEl.textContent = e instanceof Error ? e.message : String(e);
    const broken = document.getElementById(id);
    if (broken) broken.remove();
  }
};

const doSave = (idx: number): void => {
  const btn = document.getElementById("save-" + idx) as HTMLButtonElement;
  setLoading(btn, "Saving...");
  disableCard(idx);

  const newSource = sources[idx];

  const renderAndReplace = async (): Promise<void> => {
    try {
      const rendered = await mermaid.render(
        "save-svg-" + idx + "-" + ++renderCounter,
        newSource,
      );
      const base64 = await svgToPngBase64(rendered.svg);
      if (!base64) throw new Error("PNG conversion failed");

      google.script.run
        .withSuccessHandler(() => {
          markBtn(btn, true);
          btn.textContent = "Saved ✓";
          enableCard(idx);

          const thumb = cardEls[idx].querySelector<HTMLImageElement>(
            ".card-thumb",
          );
          if (thumb) thumb.src = "data:image/png;base64," + base64;
          const thumbWrap = cardEls[idx].querySelector(".thumb-hover");
          if (thumbWrap)
            thumbWrap.setAttribute(
              "data-src",
              "data:image/png;base64," + base64,
            );
        })
        .withFailureHandler((err: Error) => {
          markBtn(btn, false);
          btn.textContent = "Retry Save";
          btn.disabled = false;
          btn.onclick = () => doSave(idx);
          enableCard(idx);
          statusEl.textContent = "Error: " + err;
        })
        .replaceImageInPlace(
          base64,
          imageInfos[idx].childIndex,
          newSource,
        );
    } catch (e) {
      markBtn(btn, false);
      btn.textContent = "Retry Save";
      btn.disabled = false;
      btn.onclick = () => doSave(idx);
      enableCard(idx);
      statusEl.textContent =
        "Render error: " + (e instanceof Error ? e.message : String(e));
    }
  };

  renderAndReplace();
};

const disableCard = (idx: number): void => {
  const card = cardEls[idx];
  if (!card) return;
  card.querySelectorAll<HTMLButtonElement>(".btn").forEach(
    (b) => { b.disabled = true; },
  );
};

const enableCard = (idx: number): void => {
  const card = cardEls[idx];
  if (!card) return;
  card.querySelectorAll<HTMLButtonElement>(".btn").forEach(
    (b) => {
      if (!b.classList.contains("done") && !b.classList.contains("failed"))
        b.disabled = false;
    },
  );
};

(async () => {
  try {
    await loadScript(MERMAID_CDN_URL);
  } catch {
    statusEl.textContent = "Failed to load mermaid.js.";
    return;
  }

  mermaid.initialize(MERMAID_CONFIG);

  statusEl.innerHTML =
    '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--text-muted)"></span>' +
    "Rendering " +
    imageInfos.length +
    " preview(s)...";

  for (let i = 0; i < imageInfos.length; i++) {
    statusEl.innerHTML =
      '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--text-muted)"></span>' +
      "Rendering preview " +
      (i + 1) +
      " of " +
      imageInfos.length +
      "...";

    let thumbBase64: string | null = null;

    try {
      const rendered = await mermaid.render(
        "edit-svg-" + i,
        imageInfos[i].source,
      );
      const base64 = await svgToPngBase64(rendered.svg);
      if (base64) thumbBase64 = base64;
    } catch {
      // thumbnail not available
    }

    buildCard(i, imageInfos[i], thumbBase64);
  }

  statusEl.textContent =
    imageInfos.length + " diagram(s) found. Click Edit to modify.";
})();
