import { loadScript } from "../../shared/scripts/load-script";
import { svgToPngBase64 } from "../../shared/scripts/svg-to-png";
import { escapeHtml } from "../../shared/scripts/escape-html";
import { MERMAID_CDN_URL, MERMAID_CONFIG } from "../../shared/scripts/mermaid-init";
import { markBtn, setLoading, setCardStatus, batchAction } from "../../shared/scripts/card-helpers";

declare const mermaid: { initialize(config: unknown): void; render(id: string, src: string): Promise<{ svg: string }> };
declare const imageInfos: Array<{ source: string; childIndex: number }>;

const cardsEl = document.getElementById("cards")!;
const statusEl = document.getElementById("status")!;
const insertAllB = document.getElementById("insert-all-btn") as HTMLButtonElement;
const replaceAllB = document.getElementById("replace-all-btn") as HTMLButtonElement;
const toggleBtn = document.getElementById("toggle-btn") as HTMLButtonElement;

let allExpanded = false;
const cardEls: HTMLElement[] = [];

const buildCard = (index: number, info: typeof imageInfos[0], previewHtml: string, thumbBase64: string | null): void => {
  const card = document.createElement("div");
  card.className = "card";
  cardEls.push(card);

  const thumbHtml = thumbBase64
    ? '<img class="card-thumb" src="data:image/png;base64,' + thumbBase64 + '" />'
    : "";

  const summaryHtml =
    '<div class="card-summary">' +
    '<span class="card-chevron">&#9654;</span>' +
    '<span class="card-title">Diagram ' + (index + 1) + "</span>" +
    thumbHtml +
    '<span class="card-spacer"></span>' +
    '<span class="card-status" id="card-status-' + index + '"></span>' +
    "</div>";

  const bodyHtml =
    '<div class="card-body">' +
    '<div class="card-buttons">' +
    '<button class="btn btn-filled-primary" id="ins-' + index + '">Insert Code After</button>' +
    '<button class="btn btn-filled-secondary" id="rep-' + index + '">Replace with Code</button>' +
    '<button class="btn btn-tonal-primary" id="edit-' + index + '">Open in Editor</button>' +
    "</div>" +
    "<details><summary>Show source</summary>" +
    "<pre>" + escapeHtml(info.source) + "</pre>" +
    "</details>" +
    '<div class="preview-area" id="preview-' + index + '">' + previewHtml + "</div>" +
    "</div>";

  card.innerHTML = summaryHtml + bodyHtml;
  cardsEl.appendChild(card);

  card.querySelector(".card-summary")!.addEventListener("click", () => {
    card.classList.toggle("expanded");
  });

  const insBtn = document.getElementById("ins-" + index) as HTMLButtonElement;
  const repBtn = document.getElementById("rep-" + index) as HTMLButtonElement;
  const editBtn = document.getElementById("edit-" + index) as HTMLButtonElement;

  insBtn.addEventListener("click", () => doInsert(index));
  repBtn.addEventListener("click", () => doReplace(index));
  editBtn.addEventListener("click", () => doEdit(index));
};

const doInsert = (idx: number): void => {
  const btn = document.getElementById("ins-" + idx) as HTMLButtonElement;
  setLoading(btn, "Inserting...");

  google.script.run
    .withSuccessHandler(() => {
      markBtn(btn, true);
      setCardStatus(idx, "Inserted");
    })
    .withFailureHandler((err: Error) => {
      markBtn(btn, false);
      statusEl.textContent = "Error: " + err;
    })
    .insertCodeBlockAfterImage(imageInfos[idx].source, imageInfos[idx].childIndex);
};

const doReplace = (idx: number): void => {
  const btn = document.getElementById("rep-" + idx) as HTMLButtonElement;
  setLoading(btn, "Replacing...");

  google.script.run
    .withSuccessHandler(() => {
      markBtn(btn, true);
      setCardStatus(idx, "Replaced");
      const insBtn = document.getElementById("ins-" + idx) as HTMLButtonElement | null;
      if (insBtn) { insBtn.disabled = true; insBtn.textContent = "N/A"; }
    })
    .withFailureHandler((err: Error) => {
      markBtn(btn, false);
      statusEl.textContent = "Error: " + err;
    })
    .replaceImageWithCodeBlock(imageInfos[idx].source, imageInfos[idx].childIndex);
};

const doEdit = (idx: number): void => {
  const btn = document.getElementById("edit-" + idx) as HTMLButtonElement;
  setLoading(btn, "Opening...");

  google.script.run
    .withSuccessHandler(() => {
      markBtn(btn, true);
    })
    .withFailureHandler((err: Error) => {
      markBtn(btn, false);
      statusEl.textContent = "Error opening editor: " + err;
    })
    .openEditorForImage(imageInfos[idx].source, imageInfos[idx].childIndex);
};

insertAllB.addEventListener("click", () => {
  batchAction(
    imageInfos.map((info) => ({ ...info, base64: "placeholder" })),
    "insert",
    "insertCodeBlockAfterImage",
    statusEl,
    insertAllB,
    replaceAllB,
    (_item, idx) => imageInfos[idx].childIndex,
    (idx) => [imageInfos[idx].source, imageInfos[idx].childIndex],
  );
});

replaceAllB.addEventListener("click", () => {
  batchAction(
    imageInfos.map((info) => ({ ...info, base64: "placeholder" })),
    "replace",
    "replaceImageWithCodeBlock",
    statusEl,
    insertAllB,
    replaceAllB,
    (_item, idx) => imageInfos[idx].childIndex,
    (idx) => [imageInfos[idx].source, imageInfos[idx].childIndex],
  );
});

toggleBtn.addEventListener("click", () => {
  allExpanded = !allExpanded;
  for (const card of cardEls) {
    card.classList.toggle("expanded", allExpanded);
  }
  toggleBtn.textContent = allExpanded ? "Collapse All" : "Expand All";
});

(async () => {
  try {
    await loadScript(MERMAID_CDN_URL);
  } catch {
    statusEl.textContent = "Previews unavailable (mermaid.js failed to load).";
    for (let i = 0; i < imageInfos.length; i++) {
      buildCard(i, imageInfos[i], '<span class="placeholder">Preview unavailable</span>', null);
    }
    insertAllB.disabled = false;
    replaceAllB.disabled = false;
    if (imageInfos.length > 1) toggleBtn.style.display = "";
    return;
  }

  mermaid.initialize(MERMAID_CONFIG);

  statusEl.innerHTML =
    '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--text-muted)"></span>' +
    "Rendering " + imageInfos.length + " preview(s)...";

  for (let i = 0; i < imageInfos.length; i++) {
    statusEl.innerHTML =
      '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--text-muted)"></span>' +
      "Rendering preview " + (i + 1) + " of " + imageInfos.length + "...";

    let previewHtml = "";
    let thumbBase64: string | null = null;

    try {
      const rendered = await mermaid.render("extract-svg-" + i, imageInfos[i].source);
      const base64 = await svgToPngBase64(rendered.svg);
      if (base64) {
        previewHtml = '<img src="data:image/png;base64,' + base64 + '" />';
        thumbBase64 = base64;
      } else {
        previewHtml = '<span class="error">Preview render failed</span>';
      }
    } catch (e) {
      previewHtml = '<span class="error">' + escapeHtml(e instanceof Error ? e.message : String(e)) + "</span>";
    }

    buildCard(i, imageInfos[i], previewHtml, thumbBase64);
  }

  statusEl.textContent = imageInfos.length + " Mermaid diagram(s) found. Choose an action.";
  insertAllB.disabled = false;
  replaceAllB.disabled = false;
  if (imageInfos.length > 1) toggleBtn.style.display = "";
})();
