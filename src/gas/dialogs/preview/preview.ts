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
  batchAction,
} from "../../shared/scripts/card-helpers";

declare const mermaid: {
  initialize(config: unknown): void;
  render(id: string, src: string): Promise<{ svg: string }>;
};
declare const blockInfos: Array<{
  definition: string;
  startIdx: number;
  endIdx: number;
}>;

const OPEN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
  '<polyline points="15 3 21 3 21 9"/>' +
  '<line x1="10" y1="14" x2="21" y2="3"/></svg>';

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

const results: RenderResult[] = [];
const cardEls: HTMLElement[] = [];

const buildCard = (index: number, result: RenderResult): void => {
  const card = document.createElement("div");
  card.className = "card";
  cardEls.push(card);

  const thumbSrc = result.base64
    ? "data:image/png;base64," + result.base64
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

  if (result.base64) {
    rowHtml +=
      '<button class="btn btn-filled-primary" id="ins-' +
      index +
      '">Insert After</button>' +
      '<button class="btn btn-filled-secondary" id="rep-' +
      index +
      '">Replace</button>';
  } else {
    rowHtml +=
      '<span class="card-status failed">Error</span>';
  }

  rowHtml += "</div></div>";

  let sourceHtml =
    '<div class="source-wrap" id="source-wrap-' +
    index +
    '"><pre class="source-block">' +
    escapeHtml(result.definition) +
    "</pre></div>";

  card.innerHTML = rowHtml + sourceHtml;
  cardsEl.appendChild(card);

  const row = card.querySelector(".card-row")!;
  row.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".header-actions, .thumb-hover"))
      return;
    card.classList.toggle("expanded");
    const wrap = card.querySelector(".source-wrap");
    if (wrap) wrap.classList.toggle("visible");
  });

  const thumbEl = card.querySelector(".thumb-hover");
  if (thumbEl) {
    thumbEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const src = thumbEl.getAttribute("data-src");
      if (src) window.open(src, "_blank");
    });
  }

  const insBtn = document.getElementById(
    "ins-" + index,
  ) as HTMLButtonElement | null;
  const repBtn = document.getElementById(
    "rep-" + index,
  ) as HTMLButtonElement | null;

  if (insBtn) insBtn.addEventListener("click", (e) => { e.stopPropagation(); doInsert(index); });
  if (repBtn) repBtn.addEventListener("click", (e) => { e.stopPropagation(); doReplace(index); });
};

const doInsert = (idx: number): void => {
  const btn = document.getElementById("ins-" + idx) as HTMLButtonElement;
  setLoading(btn, "Inserting...");
  disableCard(idx);

  google.script.run
    .withSuccessHandler(() => {
      markBtn(btn, true);
      btn.textContent = "Inserted ✓";
      enableCard(idx);
    })
    .withFailureHandler((err: Error) => {
      markBtn(btn, false);
      btn.textContent = "Retry Insert";
      btn.disabled = false;
      btn.onclick = () => doInsert(idx);
      enableCard(idx);
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
  disableCard(idx);

  google.script.run
    .withSuccessHandler(() => {
      markBtn(btn, true);
      btn.textContent = "Replaced ✓";
      const insBtn = document.getElementById(
        "ins-" + idx,
      ) as HTMLButtonElement | null;
      if (insBtn) {
        insBtn.disabled = true;
        insBtn.style.opacity = "0.3";
      }
      enableCard(idx);
    })
    .withFailureHandler((err: Error) => {
      markBtn(btn, false);
      btn.textContent = "Retry Replace";
      btn.disabled = false;
      btn.onclick = () => doReplace(idx);
      enableCard(idx);
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

const disableCard = (idx: number): void => {
  const card = cardEls[idx];
  if (!card) return;
  card.querySelectorAll<HTMLButtonElement>(".header-actions .btn").forEach(
    (b) => { b.disabled = true; },
  );
};

const enableCard = (idx: number): void => {
  const card = cardEls[idx];
  if (!card) return;
  card.querySelectorAll<HTMLButtonElement>(".header-actions .btn").forEach(
    (b) => {
      if (!b.classList.contains("done") && !b.classList.contains("failed"))
        b.disabled = false;
    },
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
})();
