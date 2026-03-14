import { loadScript } from "../../shared/scripts/load-script";
import { svgToPngBase64 } from "../../shared/scripts/svg-to-png";
import {
  MERMAID_CDN_URL,
  MERMAID_CONFIG,
} from "../../shared/scripts/mermaid-init";
import { openInNewTab } from "../../shared/scripts/dom-utils";

declare const mermaid: {
  initialize(config: unknown): void;
  render(id: string, src: string): Promise<{ svg: string }>;
};
declare const initialSource: string;
declare const imageChildIndex: number;

const sourceEl = document.getElementById("source") as HTMLTextAreaElement;
const previewEl = document.getElementById("preview-area")!;
const errorBar = document.getElementById("error-bar")!;
const statusEl = document.getElementById("status")!;
const insertBtn = document.getElementById("insert-btn") as HTMLButtonElement;
const replaceBtn = document.getElementById("replace-btn") as HTMLButtonElement;
const previewBtn = document.getElementById("preview-btn") as HTMLButtonElement;
const tplBtn = document.getElementById("tpl-btn") as HTMLButtonElement;
const tplRow = document.getElementById("tpl-row")!;

let currentBase64: string | null = null;
let mermaidReady = false;
let renderTimer: ReturnType<typeof setTimeout> | null = null;
let renderCounter = 0;

if (imageChildIndex >= 0) {
  replaceBtn.style.display = "";
}

const TEMPLATES: Record<string, string> = {
  flowchart:
    "flowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Do something]\n    B -->|No| D[Do something else]\n    C --> E[End]\n    D --> E",
  sequence:
    "sequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Hello Bob\n    B-->>A: Hi Alice\n    A->>B: How are you?\n    B-->>A: Great!",
  gantt:
    "gantt\n    title Project Timeline\n    dateFormat YYYY-MM-DD\n    section Phase 1\n    Task A :a1, 2026-01-01, 14d\n    Task B :a2, after a1, 10d\n    section Phase 2\n    Task C :b1, after a2, 7d\n    Task D :b2, after b1, 14d",
  class:
    "classDiagram\n    class Animal {\n        +String name\n        +int age\n        +makeSound()\n    }\n    class Dog {\n        +fetch()\n    }\n    class Cat {\n        +purr()\n    }\n    Animal <|-- Dog\n    Animal <|-- Cat",
  er: 'erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE_ITEM : contains\n    PRODUCT ||--o{ LINE_ITEM : "is in"',
  state:
    "stateDiagram-v2\n    [*] --> Idle\n    Idle --> Processing : submit\n    Processing --> Done : complete\n    Processing --> Error : fail\n    Error --> Idle : retry\n    Done --> [*]",
  pie: 'pie title Favorite Pets\n    "Dogs" : 45\n    "Cats" : 30\n    "Birds" : 15\n    "Fish" : 10',
  mindmap:
    "mindmap\n  root((Project))\n    Planning\n      Research\n      Requirements\n    Development\n      Frontend\n      Backend\n    Testing\n      Unit Tests\n      Integration",
  timeline:
    "timeline\n    title Project Milestones\n    2026-Q1 : Research\n             : Prototype\n    2026-Q2 : Development\n             : Testing\n    2026-Q3 : Launch\n             : Iterate",
  journey:
    "journey\n    title User Onboarding\n    section Sign Up\n      Visit site: 5: User\n      Create account: 3: User\n    section First Use\n      Complete tutorial: 4: User\n      Create first item: 5: User",
  gitgraph:
    "gitGraph\n    commit\n    commit\n    branch develop\n    checkout develop\n    commit\n    commit\n    checkout main\n    merge develop\n    commit",
  sankey:
    "sankey-beta\n\nAgricultural waste,Bio-conversion,124.729\nBio-conversion,Liquid,0.597\nBio-conversion,Losses,26.862\nBio-conversion,Solid,280.322\nBio-conversion,Gas,81.144",
  xychart:
    'xychart-beta\n    title "Sales Revenue"\n    x-axis [jan, feb, mar, apr, may]\n    y-axis "Revenue (k$)" 0 --> 150\n    bar [52, 78, 65, 120, 95]\n    line [52, 78, 65, 120, 95]',
  block:
    'block-beta\n  columns 3\n  a["Frontend"]:2 b["Backend"]\n  c["Database"] d["Cache"] e["Queue"]',
  quadrant:
    "quadrantChart\n    title Reach and engagement\n    x-axis Low Reach --> High Reach\n    y-axis Low Engagement --> High Engagement\n    quadrant-1 We should expand\n    quadrant-2 Need to promote\n    quadrant-3 Re-evaluate\n    quadrant-4 May be improved\n    Campaign A: [0.3, 0.6]\n    Campaign B: [0.45, 0.23]\n    Campaign C: [0.57, 0.69]\n    Campaign D: [0.78, 0.34]",
  requirement:
    "requirementDiagram\n    requirement test_req {\n      id: 1\n      text: the test text\n      risk: high\n      verifymethod: test\n    }\n    element test_entity {\n      type: simulation\n    }\n    test_entity - satisfies -> test_req",
  c4: 'C4Context\n    title System Context diagram\n    Person(customerA, "Customer A", "A customer")\n    System(systemAA, "System A", "Main system")\n    System_Ext(systemC, "External System", "An external system")\n    Rel(customerA, systemAA, "Uses")\n    Rel(systemAA, systemC, "Sends data", "HTTPS")',
};

const doRender = async (): Promise<void> => {
  const src = sourceEl.value.trim();
  if (!src) {
    previewEl.innerHTML =
      '<div class="placeholder">Start typing to see a live preview.</div>';
    errorBar.className = "error-bar";
    errorBar.textContent = "";
    insertBtn.disabled = true;
    replaceBtn.disabled = true;
    previewBtn.disabled = true;
    statusEl.textContent = "Ready.";
    return;
  }
  if (!mermaidReady) return;

  renderCounter++;
  const id = "editor-svg-" + renderCounter;

  try {
    const rendered = await mermaid.render(id, src);
    const base64 = await svgToPngBase64(rendered.svg);
    if (base64) {
      currentBase64 = base64;
      previewEl.innerHTML =
        '<img src="data:image/png;base64,' + base64 + '" />';
      insertBtn.disabled = false;
      if (imageChildIndex >= 0) replaceBtn.disabled = false;
      previewBtn.disabled = false;
      errorBar.className = "error-bar";
      errorBar.textContent = "";
      statusEl.textContent = "Preview up to date.";
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errorBar.textContent = msg;
    errorBar.className = "error-bar visible";
    statusEl.textContent = "Syntax error — showing last valid preview.";
  }

  const leftover = document.getElementById("d" + id);
  if (leftover) leftover.remove();
};

const scheduleRender = (): void => {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(doRender, 400);
};

const updateTemplateHighlight = (): void => {
  const currentSrc = sourceEl.value;
  const tplBtns =
    tplRow.querySelectorAll<HTMLButtonElement>("button[data-tpl]");
  let matched: string | null = null;
  for (const btn of tplBtns) {
    const key = btn.getAttribute("data-tpl")!;
    if (TEMPLATES[key] && currentSrc === TEMPLATES[key]) {
      matched = key;
    }
    btn.classList.remove("active");
  }
  if (matched) {
    const activeBtn = tplRow.querySelector<HTMLButtonElement>(
      `button[data-tpl="${matched}"]`,
    );
    if (activeBtn) activeBtn.classList.add("active");
  }
};

sourceEl.addEventListener("input", () => {
  scheduleRender();
  updateTemplateHighlight();
});

sourceEl.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = sourceEl.selectionStart;
    const end = sourceEl.selectionEnd;
    sourceEl.value =
      sourceEl.value.substring(0, start) +
      "    " +
      sourceEl.value.substring(end);
    sourceEl.selectionStart = sourceEl.selectionEnd = start + 4;
    scheduleRender();
  }
});

previewBtn.addEventListener("click", () => {
  if (currentBase64) openInNewTab(currentBase64);
});

insertBtn.addEventListener("click", () => {
  if (!currentBase64) return;
  insertBtn.disabled = true;
  insertBtn.innerHTML = '<span class="spinner-inline"></span>Inserting...';
  statusEl.textContent = "Inserting into document...";

  google.script.run
    .withSuccessHandler(() => {
      google.script.host.close();
    })
    .withFailureHandler((err: Error) => {
      insertBtn.textContent = "Insert into Document";
      insertBtn.className = "btn-insert";
      insertBtn.disabled = false;
      statusEl.textContent = "Error: " + err;
    })
    .insertImageAtCursor(currentBase64, sourceEl.value.trim());
});

replaceBtn.addEventListener("click", () => {
  if (!currentBase64 || imageChildIndex < 0) return;
  replaceBtn.disabled = true;
  replaceBtn.innerHTML = '<span class="spinner-inline"></span>Replacing...';
  statusEl.textContent = "Replacing image...";

  google.script.run
    .withSuccessHandler(() => {
      google.script.host.close();
    })
    .withFailureHandler((err: Error) => {
      replaceBtn.textContent = "Replace Image";
      replaceBtn.className = "btn-replace";
      replaceBtn.disabled = false;
      statusEl.textContent = "Error: " + err;
    })
    .replaceImageInPlace(currentBase64, imageChildIndex, sourceEl.value.trim());
});

tplBtn.addEventListener("click", () => {
  tplRow.classList.toggle("visible");
});

const tplBtns = tplRow.querySelectorAll<HTMLButtonElement>("button[data-tpl]");
for (const btn of tplBtns) {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-tpl")!;
    if (TEMPLATES[key]) {
      sourceEl.value = TEMPLATES[key];
      updateTemplateHighlight();
      doRender();
    }
  });
}

(async () => {
  try {
    await loadScript(MERMAID_CDN_URL);
    mermaid.initialize(MERMAID_CONFIG);
    mermaidReady = true;
    if (initialSource) {
      sourceEl.value = initialSource;
      statusEl.textContent = "Source loaded — rendering...";
      doRender();
    } else {
      statusEl.textContent = "Ready — start typing.";
    }
  } catch (e) {
    statusEl.textContent =
      "Failed to load mermaid.js: " +
      (e instanceof Error ? e.message : String(e));
  }
})();
