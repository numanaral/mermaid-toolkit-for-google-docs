import { loadScript } from "../../shared/scripts/load-script";
import { svgToPngBase64 } from "../../shared/scripts/svg-to-png";
import { escapeHtml } from "../../shared/scripts/escape-html";
import {
  MERMAID_CDN_URL,
  MERMAID_CONFIG,
} from "../../shared/scripts/mermaid-init";
import {
  markBtn,
  setLoading,
  setCardStatus,
  batchAction,
} from "../../shared/scripts/card-helpers";
import { wrapImgWithFullscreen } from "../../shared/scripts/fullscreen";

declare const mermaid: {
  initialize(config: unknown): void;
  render(id: string, src: string): Promise<{ svg: string }>;
};
declare const blockInfos: Array<{
  definition: string;
  startIdx: number;
  endIdx: number;
}>;

interface RenderResult {
  definition: string;
  startIdx: number;
  endIdx: number;
  base64: string | null;
  error: string | null;
}

const cardsEl = document.getElementById("cards")!;
const statusEl = document.getElementById("status")!;
const insertAllB = document.getElementById(
  "insert-all-btn",
) as HTMLButtonElement;
const replaceAllB = document.getElementById(
  "replace-all-btn",
) as HTMLButtonElement;
const toggleBtn = document.getElementById("toggle-btn") as HTMLButtonElement;

const results: RenderResult[] = [];
let allExpanded = false;
const cardEls: HTMLElement[] = [];

const buildCard = (index: number, result: RenderResult): void => {
  const card = document.createElement("div");
  card.className = "card";
  cardEls.push(card);

  const thumbHtml = result.base64
    ? '<img class="card-thumb" src="data:image/png;base64,' +
      result.base64 +
      '" />'
    : "";

  const summaryHtml =
    '<div class="card-summary">' +
    '<span class="card-chevron">&#9654;</span>' +
    '<span class="card-title">Diagram ' +
    (index + 1) +
    "</span>" +
    thumbHtml +
    '<span class="card-spacer"></span>' +
    '<span class="card-status" id="card-status-' +
    index +
    '">' +
    (result.error ? '<span class="error">Error</span>' : "") +
    "</span></div>";

  let bodyHtml = '<div class="card-body">';

  if (result.base64) {
    bodyHtml +=
      '<div class="card-buttons">' +
      '<button class="btn btn-tonal-primary" id="src-' +
      index +
      '">Show Source</button>' +
      '<button class="btn btn-filled-primary" id="ins-' +
      index +
      '">Insert After</button>' +
      '<button class="btn btn-filled-secondary" id="rep-' +
      index +
      '">Replace</button>' +
      "</div>" +
      '<div class="source-wrap" id="source-wrap-' +
      index +
      '"><pre class="source-block">' +
      escapeHtml(result.definition) +
      "</pre></div>" +
      '<img src="data:image/png;base64,' +
      result.base64 +
      '" />';
  } else {
    bodyHtml +=
      '<p class="error">' +
      escapeHtml(result.error || "Unknown error") +
      "</p>" +
      "<pre>" +
      escapeHtml(result.definition) +
      "</pre>";
  }

  bodyHtml += "</div>";
  card.innerHTML = summaryHtml + bodyHtml;
  cardsEl.appendChild(card);

  card.querySelector(".card-summary")!.addEventListener("click", () => {
    card.classList.toggle("expanded");
  });

  const imgEl = card.querySelector<HTMLImageElement>(".card-body > img");
  if (imgEl) wrapImgWithFullscreen(imgEl);

  const srcBtn = document.getElementById(
    "src-" + index,
  ) as HTMLButtonElement | null;
  const insBtn = document.getElementById(
    "ins-" + index,
  ) as HTMLButtonElement | null;
  const repBtn = document.getElementById(
    "rep-" + index,
  ) as HTMLButtonElement | null;

  if (srcBtn) {
    srcBtn.addEventListener("click", () => {
      const wrap = document.getElementById("source-wrap-" + index);
      if (!wrap) return;
      const isVisible = wrap.classList.contains("visible");
      wrap.classList.toggle("visible", !isVisible);
      srcBtn.textContent = isVisible ? "Show Source" : "Hide Source";
    });
  }
  if (insBtn) insBtn.addEventListener("click", () => doInsert(index));
  if (repBtn) repBtn.addEventListener("click", () => doReplace(index));
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
    .insertDiagramAfterText(
      results[idx].base64,
      results[idx].startIdx,
      results[idx].endIdx,
      idx,
      results[idx].definition,
    );
};

const doReplace = (idx: number): void => {
  const btn = document.getElementById("rep-" + idx) as HTMLButtonElement;
  setLoading(btn, "Replacing...");

  google.script.run
    .withSuccessHandler(() => {
      markBtn(btn, true);
      setCardStatus(idx, "Replaced");
      const insBtn = document.getElementById(
        "ins-" + idx,
      ) as HTMLButtonElement | null;
      if (insBtn) {
        insBtn.disabled = true;
        insBtn.textContent = "N/A";
      }
    })
    .withFailureHandler((err: Error) => {
      markBtn(btn, false);
      statusEl.textContent = "Error: " + err;
    })
    .replaceDiagramText(
      results[idx].base64,
      results[idx].startIdx,
      results[idx].endIdx,
      idx,
      results[idx].definition,
    );
};

insertAllB.addEventListener("click", () => {
  batchAction(
    results,
    "insert",
    "insertDiagramAfterText",
    statusEl,
    insertAllB,
    replaceAllB,
    (item) => (item as RenderResult).startIdx,
    (idx) => [
      results[idx].base64,
      results[idx].startIdx,
      results[idx].endIdx,
      idx,
      results[idx].definition,
    ],
  );
});

replaceAllB.addEventListener("click", () => {
  batchAction(
    results,
    "replace",
    "replaceDiagramText",
    statusEl,
    insertAllB,
    replaceAllB,
    (item) => (item as RenderResult).startIdx,
    (idx) => [
      results[idx].base64,
      results[idx].startIdx,
      results[idx].endIdx,
      idx,
      results[idx].definition,
    ],
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
  } catch (e) {
    statusEl.textContent =
      "Failed to load mermaid.js: " +
      (e instanceof Error ? e.message : String(e));
    return;
  }

  mermaid.initialize(MERMAID_CONFIG);

  statusEl.innerHTML =
    '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--text-muted)"></span>' +
    "Rendering " +
    blockInfos.length +
    " diagram(s)...";

  let successCount = 0;

  for (let i = 0; i < blockInfos.length; i++) {
    statusEl.innerHTML =
      '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--text-muted)"></span>' +
      "Rendering diagram " +
      (i + 1) +
      " of " +
      blockInfos.length +
      "...";

    const info = blockInfos[i];
    const result: RenderResult = {
      definition: info.definition,
      startIdx: info.startIdx,
      endIdx: info.endIdx,
      base64: null,
      error: null,
    };

    try {
      const rendered = await mermaid.render(
        "mermaid-svg-" + i,
        info.definition,
      );
      const base64 = await svgToPngBase64(rendered.svg);
      if (base64) {
        result.base64 = base64;
        successCount++;
      } else {
        result.error = "SVG to PNG conversion failed.";
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
    }

    results.push(result);
    buildCard(i, result);
  }

  statusEl.textContent =
    successCount +
    " of " +
    blockInfos.length +
    " diagram(s) rendered. Choose an action.";

  if (successCount > 0) {
    insertAllB.disabled = false;
    replaceAllB.disabled = false;
  }

  if (blockInfos.length > 1) {
    toggleBtn.style.display = "";
  }
})();
