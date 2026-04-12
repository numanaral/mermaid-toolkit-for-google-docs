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
declare const imageInfos: Array<{ source: string; childIndex: number }>;

const cardsEl = document.getElementById("cards")!;
const statusEl = document.getElementById("status")!;
const insertAllB = document.getElementById(
  "insert-all-btn",
) as HTMLButtonElement;
const replaceAllB = document.getElementById(
  "replace-all-btn",
) as HTMLButtonElement;

const cardEls: HTMLElement[] = [];
const thumbs: (string | null)[] = [];

const buildCard = (
  index: number,
  info: (typeof imageInfos)[0],
  thumbBase64: string | null,
): void => {
  const card = document.createElement("div");
  card.className = "card";
  cardEls.push(card);
  thumbs.push(thumbBase64);

  const thumbSrc = thumbBase64 ? "data:image/png;base64," + thumbBase64 : "";

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
    '<button class="btn btn-filled-primary" id="ins-' +
    index +
    '">Insert After</button>' +
    '<button class="btn btn-filled-secondary" id="rep-' +
    index +
    '">Replace</button>';
  rowHtml += "</div></div>";

  const sourceHtml =
    '<div class="source-wrap" id="source-wrap-' +
    index +
    '"><pre class="source-block">' +
    escapeHtml(info.source) +
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

  const insBtn = document.getElementById("ins-" + index) as HTMLButtonElement;
  const repBtn = document.getElementById("rep-" + index) as HTMLButtonElement;

  insBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    doInsert(index);
  });
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
    .insertCodeBlockAfterImage(
      imageInfos[idx].source,
      imageInfos[idx].childIndex,
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
    .replaceImageWithCodeBlock(
      imageInfos[idx].source,
      imageInfos[idx].childIndex,
    );
};

const updateStatusCount = (): void => {
  let remaining = 0;
  for (let i = 0; i < cardEls.length; i++) {
    const rep = document.getElementById("rep-" + i) as HTMLButtonElement | null;
    if (rep && !rep.classList.contains("done")) remaining++;
  }
  if (remaining === 0) {
    statusEl.textContent = "All diagrams converted. Choose an action or close.";
  } else {
    statusEl.textContent =
      remaining + " of " + cardEls.length + " diagram(s) remaining.";
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

const doBatchCodeBlocks = (action: "insert" | "replace"): void => {
  const isReplace = action === "replace";
  const btnPrefix = isReplace ? "rep-" : "ins-";
  const serverFn = isReplace
    ? "batchReplaceWithCodeBlocks"
    : "batchInsertCodeBlocks";

  const queue: number[] = [];
  for (let i = 0; i < imageInfos.length; i++) {
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

  queue.sort((a, b) => imageInfos[b].childIndex - imageInfos[a].childIndex);

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
    source: imageInfos[idx].source,
    childIndex: imageInfos[idx].childIndex,
    index: idx,
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

insertAllB.addEventListener("click", () => doBatchCodeBlocks("insert"));
replaceAllB.addEventListener("click", () => doBatchCodeBlocks("replace"));

(async () => {
  try {
    await loadScript(MERMAID_CDN_URL);
  } catch {
    statusEl.textContent = "Previews unavailable (mermaid.js failed to load).";
    for (let i = 0; i < imageInfos.length; i++) {
      buildCard(i, imageInfos[i], null);
    }
    insertAllB.disabled = false;
    replaceAllB.disabled = false;
    return;
  }

  mermaid.initialize(MERMAID_CONFIG);

  setBtnLoading(insertAllB, true);
  setBtnLoading(replaceAllB, true);
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
        "extract-svg-" + i,
        imageInfos[i].source,
      );
      const base64 = await svgToPngBase64(rendered.svg);
      if (base64) {
        thumbBase64 = base64;
      }
    } catch {
      // thumbnail not available, still show the card
    }

    buildCard(i, imageInfos[i], thumbBase64);
  }

  statusEl.textContent =
    imageInfos.length + " Mermaid diagram(s) found. Choose an action.";
  setBtnLoading(insertAllB, false);
  setBtnLoading(replaceAllB, false);
  insertAllB.disabled = false;
  replaceAllB.disabled = false;
})();
