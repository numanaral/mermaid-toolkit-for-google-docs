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
  setBtnLoading,
} from "../../shared/scripts/card-helpers";
import { openDataUriInNewTab } from "../../shared/scripts/dom-utils";
import { OPEN_SVG } from "../../shared/scripts/icons";

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
    rowHtml += '<span class="card-status failed">Error</span>';
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
      if (src) openDataUriInNewTab(src);
    });
  }

  const insBtn = document.getElementById(
    "ins-" + index,
  ) as HTMLButtonElement | null;
  const repBtn = document.getElementById(
    "rep-" + index,
  ) as HTMLButtonElement | null;

  if (insBtn)
    insBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      doInsert(index);
    });
  if (repBtn)
    repBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      doReplace(index);
    });
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
      updateStatusCount();
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
      updateStatusCount();
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

const updateStatusCount = (): void => {
  let remaining = 0;
  for (let i = 0; i < cardEls.length; i++) {
    const rep = document.getElementById("rep-" + i) as HTMLButtonElement | null;
    if (rep && !rep.classList.contains("done")) remaining++;
  }
  if (remaining === 0) {
    statusEl.textContent = "All diagrams processed. Choose an action or close.";
  } else {
    statusEl.textContent =
      remaining + " of " + results.length + " diagram(s) remaining.";
  }
};

const disableCard = (idx: number): void => {
  const card = cardEls[idx];
  if (!card) return;
  card
    .querySelectorAll<HTMLButtonElement>(".header-actions .btn")
    .forEach((b) => {
      b.disabled = true;
    });
};

const enableCard = (idx: number): void => {
  const card = cardEls[idx];
  if (!card) return;
  card
    .querySelectorAll<HTMLButtonElement>(".header-actions .btn")
    .forEach((b) => {
      if (!b.classList.contains("done") && !b.classList.contains("failed"))
        b.disabled = false;
    });
};

interface BatchResult {
  index: number;
  ok: boolean;
  error?: string;
}

const doBatchDiagrams = (action: "insert" | "replace"): void => {
  const isReplace = action === "replace";
  const btnPrefix = isReplace ? "rep-" : "ins-";
  const serverFn = isReplace ? "batchReplaceDiagrams" : "batchInsertDiagrams";

  const queue: number[] = [];
  for (let i = 0; i < results.length; i++) {
    if (!results[i].base64) continue;
    const btn = document.getElementById(
      btnPrefix + i,
    ) as HTMLButtonElement | null;
    if (btn?.classList.contains("done")) continue;
    queue.push(i);
  }

  if (queue.length === 0) {
    statusEl.textContent =
      "All items have already been " +
      (isReplace ? "replaced" : "inserted") +
      ".";
    return;
  }

  queue.sort((a, b) => results[b].startIdx - results[a].startIdx);

  insertAllB.disabled = true;
  replaceAllB.disabled = true;
  const activeBtn = isReplace ? replaceAllB : insertAllB;
  activeBtn.innerHTML =
    '<span class="spinner-inline"></span>' +
    (isReplace ? "Replacing..." : "Inserting...");
  statusEl.innerHTML =
    '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--text-muted)"></span>' +
    (isReplace ? "Replacing" : "Inserting") +
    " " +
    queue.length +
    " diagram(s)...";

  for (const idx of queue) disableCard(idx);

  const items = queue.map((idx) => ({
    base64: results[idx].base64!,
    startIdx: results[idx].startIdx,
    endIdx: results[idx].endIdx,
    index: idx,
    definition: results[idx].definition,
  }));

  google.script.run
    .withSuccessHandler((batchResults: BatchResult[]) => {
      let okCount = 0;
      let errCount = 0;
      for (const r of batchResults) {
        const insBtn = document.getElementById(
          "ins-" + r.index,
        ) as HTMLButtonElement | null;
        const repBtn = document.getElementById(
          "rep-" + r.index,
        ) as HTMLButtonElement | null;
        if (r.ok) {
          okCount++;
          if (isReplace) {
            if (repBtn) markBtn(repBtn, true);
            if (insBtn) {
              insBtn.disabled = true;
              insBtn.textContent = "N/A";
            }
          } else {
            if (insBtn) markBtn(insBtn, true);
          }
        } else {
          errCount++;
          const btn = isReplace ? repBtn : insBtn;
          if (btn) markBtn(btn, false);
        }
        enableCard(r.index);
      }
      updateStatusCount();
      if (errCount > 0) {
        statusEl.textContent = okCount + " succeeded, " + errCount + " failed.";
        activeBtn.textContent = isReplace ? "Replace All" : "Insert All";
        insertAllB.disabled = false;
        replaceAllB.disabled = false;
      } else {
        google.script.host.close();
      }
    })
    .withFailureHandler((err: Error) => {
      statusEl.textContent = "Batch error: " + err;
      for (const idx of queue) enableCard(idx);
      insertAllB.disabled = false;
      replaceAllB.disabled = false;
      activeBtn.textContent = isReplace ? "Replace All" : "Insert All";
    })
    [serverFn](items);
};

insertAllB.addEventListener("click", () => doBatchDiagrams("insert"));
replaceAllB.addEventListener("click", () => doBatchDiagrams("replace"));

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

  setBtnLoading(insertAllB, true);
  setBtnLoading(replaceAllB, true);
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

  setBtnLoading(insertAllB, false);
  setBtnLoading(replaceAllB, false);
  if (successCount > 0) {
    insertAllB.disabled = false;
    replaceAllB.disabled = false;
  }
})();
