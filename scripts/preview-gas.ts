import fs from "fs";
import path from "path";
import http from "http";

const DIST = "dist/gas";
const PREVIEW = "dist/gas-preview";
const PORT = 5555;

interface DialogConfig {
  file: string;
  label: string;
  width: number;
  height: number;
  group: "core" | "markdown" | "utility";
}

const DIALOGS: DialogConfig[] = [
  {
    file: "Editor.html",
    label: "Editor",
    width: 1000,
    height: 700,
    group: "core",
  },
  {
    file: "Preview.html",
    label: "Convert Code to Diagrams",
    width: 800,
    height: 600,
    group: "core",
  },
  {
    file: "Extract.html",
    label: "Convert Diagrams to Code",
    width: 800,
    height: 600,
    group: "core",
  },
  {
    file: "EditDiagrams.html",
    label: "Edit All Mermaid Diagrams",
    width: 800,
    height: 600,
    group: "core",
  },
  {
    file: "Convert.html",
    label: "Converting...",
    width: 360,
    height: 180,
    group: "core",
  },
  {
    file: "ImportMarkdown.html",
    label: "Import from Markdown",
    width: 1000,
    height: 700,
    group: "markdown",
  },
  {
    file: "ExportMarkdown.html",
    label: "Export as Markdown",
    width: 900,
    height: 600,
    group: "markdown",
  },
  {
    file: "FixMarkdown.html",
    label: 'Fix Native "Copy as Markdown"',
    width: 900,
    height: 600,
    group: "markdown",
  },
  {
    file: "QuickGuide.html",
    label: "Quick Guide",
    width: 440,
    height: 600,
    group: "utility",
  },
  {
    file: "DevTools.html",
    label: "Dev Tools",
    width: 440,
    height: 380,
    group: "utility",
  },
  {
    file: "About.html",
    label: "About",
    width: 320,
    height: 280,
    group: "utility",
  },
];

const SAMPLE_FLOWCHART = `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[End]
    C --> D`;

const SAMPLE_SEQUENCE = `sequenceDiagram
    Alice->>Bob: Hello Bob!
    Bob-->>Alice: Hi Alice!
    Alice->>Bob: How are you?
    Bob-->>Alice: Great!`;

const SAMPLE_PIE = `pie title Languages
    "JavaScript" : 35
    "Python" : 30
    "TypeScript" : 20
    "Go" : 15`;

const SAMPLE_EXPORT_MD = `# Sample Document

This is a paragraph with **bold** and *italic* text.

## Diagrams

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

## Lists

- Item one
- Item two
  - Nested item

1. First
2. Second
`;

const MOCK_IMAGE_INFOS = JSON.stringify([
  { source: SAMPLE_FLOWCHART, childIndex: 2 },
  { source: SAMPLE_SEQUENCE, childIndex: 5 },
]);

const MOCK_BLOCK_INFOS = JSON.stringify([
  { definition: SAMPLE_FLOWCHART, startIdx: 10, endIdx: 45 },
  { definition: SAMPLE_PIE, startIdx: 60, endIdx: 80 },
]);

const TEMPLATE_REPLACEMENTS: Record<string, [string, string][]> = {
  "Editor.html": [
    [
      '<?!= JSON.stringify(initialSource || "") ?>',
      JSON.stringify(SAMPLE_FLOWCHART),
    ],
    [
      "<?!= JSON.stringify(imageChildIndex != null ? imageChildIndex : -1) ?>",
      "-1",
    ],
  ],
  "Extract.html": [["<?!= imageInfos ?>", MOCK_IMAGE_INFOS]],
  "Preview.html": [["<?!= blockInfos ?>", MOCK_BLOCK_INFOS]],
  "Convert.html": [
    ["<?!= JSON.stringify(mermaidSource) ?>", JSON.stringify(SAMPLE_SEQUENCE)],
    ["<?!= startIdx ?>", "0"],
    ["<?!= endIdx ?>", "50"],
  ],
};

const GAS_MOCK_SCRIPT = `
<script>
(function() {
  var MOCK_RESULTS = {
    isActiveTabFirst: true,
    getExportMarkdown: ${JSON.stringify(SAMPLE_EXPORT_MD)},
  };

  function postToParent(fn, args) {
    try {
      window.parent.postMessage(
        { type: "gas-call", fn: fn, args: args, ts: Date.now() },
        "*"
      );
    } catch (e) {}
  }

  function createRunner(successFn, failureFn) {
    return new Proxy({}, {
      get: function(_, name) {
        if (name === "then" || name === "catch" || typeof name === "symbol") return undefined;
        return function() {
          var args = Array.prototype.slice.call(arguments);
          console.log("[GAS Mock] " + name + "(" + args.map(function(a) {
            return typeof a === "string" && a.length > 80 ? a.substring(0, 80) + "..." : JSON.stringify(a);
          }).join(", ") + ")");
          postToParent(name, args.map(function(a) {
            return typeof a === "string" && a.length > 200 ? a.substring(0, 200) + "..." : a;
          }));
          var result = MOCK_RESULTS.hasOwnProperty(name) ? MOCK_RESULTS[name] : undefined;
          setTimeout(function() { successFn(result); }, 600);
        };
      }
    });
  }

  window.google = {
    script: {
      run: {
        withSuccessHandler: function(fn) {
          var _success = fn;
          var _failure = function() {};
          var runner = createRunner(function(r) { _success(r); }, function(e) { _failure(e); });
          runner.withFailureHandler = function(errFn) {
            _failure = errFn;
            return createRunner(function(r) { _success(r); }, function(e) { _failure(e); });
          };
          return runner;
        },
        withFailureHandler: function(fn) {
          return {
            withSuccessHandler: function(sFn) {
              return createRunner(sFn, fn);
            }
          };
        }
      },
      host: {
        close: function() {
          console.log("[GAS Mock] host.close()");
          postToParent("host.close", []);
          var toast = document.createElement("div");
          toast.textContent = "Dialog closed (mock)";
          toast.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e8e3e;color:#fff;padding:10px 24px;border-radius:24px;font-size:13px;z-index:99999;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.2);";
          document.body.appendChild(toast);
          setTimeout(function() { toast.remove(); }, 2000);
        },
        setHeight: function(h) {
          console.log("[GAS Mock] host.setHeight(" + h + ")");
          postToParent("host.setHeight", [h]);
        },
        setWidth: function(w) {
          console.log("[GAS Mock] host.setWidth(" + w + ")");
          postToParent("host.setWidth", [w]);
        }
      }
    }
  };
})();
</script>`;

const processDialog = (fileName: string, html: string): string => {
  const replacements = TEMPLATE_REPLACEMENTS[fileName];
  if (replacements) {
    for (const [pattern, value] of replacements) {
      html = html.replace(pattern, value);
    }
  }

  const firstScriptIdx = html.indexOf("<script>");
  if (firstScriptIdx !== -1) {
    html =
      html.slice(0, firstScriptIdx) +
      GAS_MOCK_SCRIPT +
      "\n" +
      html.slice(firstScriptIdx);
  }

  return html;
};

interface MenuItem {
  label: string;
  file?: string;
  width?: number;
  height?: number;
  dialogTitle?: string;
  separator?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Insert Mermaid Diagram",
    file: "Editor.html",
    width: 1000,
    height: 700,
    dialogTitle: "Mermaid Editor",
  },
  {
    label: "Edit Selected Mermaid Diagram",
    file: "Editor.html",
    width: 1000,
    height: 700,
    dialogTitle: "Mermaid Editor",
  },
  { separator: true, label: "" },
  {
    label: "Convert All Code to Diagrams",
    file: "Preview.html",
    width: 800,
    height: 600,
    dialogTitle: "Convert Code to Diagrams",
  },
  {
    label: "Convert Selected Code to Diagram",
    file: "Convert.html",
    width: 360,
    height: 180,
    dialogTitle: "Converting...",
  },
  { separator: true, label: "" },
  {
    label: "Convert All Diagrams to Code",
    file: "Extract.html",
    width: 800,
    height: 600,
    dialogTitle: "Convert Diagrams to Code",
  },
  {
    label: "Convert Selected Diagram to Code",
    file: "Extract.html",
    width: 800,
    height: 600,
    dialogTitle: "Convert Diagrams to Code",
  },
  { separator: true, label: "" },
  {
    label: "Import from Markdown",
    file: "ImportMarkdown.html",
    width: 1000,
    height: 700,
    dialogTitle: "Import from Markdown",
  },
  {
    label: "Export as Markdown",
    file: "ExportMarkdown.html",
    width: 900,
    height: 600,
    dialogTitle: "Export as Markdown",
  },
  {
    label: 'Fix Native "Copy as Markdown"',
    file: "FixMarkdown.html",
    width: 900,
    height: 600,
    dialogTitle: 'Fix Native "Copy as Markdown"',
  },
  { separator: true, label: "" },
  {
    label: "Quick Guide",
    file: "QuickGuide.html",
    width: 440,
    height: 600,
    dialogTitle: "Quick Guide",
  },
  {
    label: "Dev Tools",
    file: "DevTools.html",
    width: 440,
    height: 380,
    dialogTitle: "Dev Tools",
  },
  {
    label: "About",
    file: "About.html",
    width: 320,
    height: 280,
    dialogTitle: "About",
  },
];

const buildGalleryPage = (): string => {
  const menuItemsHtml = MENU_ITEMS.map((m, i) => {
    if (m.separator) return '<div class="gd-menu-sep" role="separator"></div>';
    return `<button class="gd-menu-item" data-idx="${i}" role="menuitem">${m.label}</button>`;
  }).join("");

  const menuDataJs = JSON.stringify(
    MENU_ITEMS.map((m) =>
      m.separator
        ? null
        : { file: m.file, w: m.width, h: m.height, title: m.dialogTitle },
    ),
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Mermaid Toolkit - Google Docs™</title>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&family=Roboto+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:'Google Sans',Arial,Helvetica,sans-serif;background:#f8f9fa;color:#202124;display:flex;flex-direction:column}

/* ---- Top bar ---- */
.gd-topbar{display:flex;align-items:center;height:48px;padding:0 12px;background:#fff;flex-shrink:0}
.gd-topbar-icon{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.gd-topbar-icon:hover{background:#f1f3f4}
.gd-topbar-icon svg{width:24px;height:24px}
.gd-topbar-title{font-size:18px;font-weight:400;color:#202124;padding:0 4px;margin-left:4px;line-height:24px;letter-spacing:0}
.gd-topbar-star{color:#5f6368;margin-left:4px;cursor:pointer;font-size:18px;opacity:.6}
.gd-topbar-star:hover{opacity:1}
.gd-topbar-spacer{flex:1}
.gd-topbar-actions{display:flex;align-items:center;gap:8px}
.gd-editing-badge{font-size:12px;color:#5f6368;padding:4px 12px;border:1px solid #dadce0;border-radius:16px}
.gd-share-btn{background:#1a73e8;color:#fff;border:none;border-radius:24px;padding:8px 20px;font-size:14px;font-weight:500;cursor:default;font-family:inherit;letter-spacing:.01em}
.gd-avatar{width:32px;height:32px;border-radius:50%;background:#8e24aa;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:500;cursor:default}

/* ---- Menu bar ---- */
.gd-menubar{display:flex;align-items:center;height:28px;padding:0 8px 0 56px;background:#fff;border-bottom:1px solid #dadce0;flex-shrink:0}
.gd-menubar-item{padding:4px 8px;font-size:13px;color:#202124;cursor:default;border-radius:4px;user-select:none;white-space:nowrap;line-height:20px}
.gd-menubar-item:hover{background:#f1f3f4}
.gd-menubar-item.active{background:#d3e3fd}
.gd-menubar-item.gd-ext{cursor:pointer}
button.gd-menubar-item{border:none;background:none;font:inherit;color:inherit}

/* ---- Toolbar ---- */
.gd-toolbar{display:flex;align-items:center;gap:2px;height:36px;padding:0 8px 0 56px;background:#edf2fa;border-bottom:1px solid #dadce0;flex-shrink:0}
.gd-tb-btn{width:28px;height:28px;border:none;background:none;border-radius:4px;cursor:default;display:flex;align-items:center;justify-content:center;color:#444746;font-size:14px}
.gd-tb-sep{width:1px;height:18px;background:#c4c7c5;margin:0 4px}
.gd-tb-select{height:28px;padding:0 8px;border:none;background:none;border-radius:4px;font-size:13px;color:#444746;font-family:inherit;cursor:default;display:flex;align-items:center;gap:4px}
.gd-tb-select .arrow{font-size:10px;color:#80868b}

/* ---- Body ---- */
.gd-body{display:flex;flex:1;overflow:hidden}

/* ---- Tabs sidebar ---- */
.gd-tabs{width:180px;background:#fff;border-right:1px solid #dadce0;flex-shrink:0;display:flex;flex-direction:column}
.gd-tabs-header{display:flex;align-items:center;padding:12px 12px 8px;gap:8px}
.gd-tabs-back{width:28px;height:28px;border:none;background:none;border-radius:50%;cursor:default;font-size:16px;color:#5f6368;display:flex;align-items:center;justify-content:center}
.gd-tabs-title{font-size:14px;color:#202124;flex:1}
.gd-tabs-add{width:28px;height:28px;border:none;background:none;border-radius:50%;cursor:default;font-size:18px;color:#5f6368;display:flex;align-items:center;justify-content:center}
.gd-tab{display:flex;align-items:center;padding:6px 12px 6px 20px;font-size:13px;color:#3c4043;cursor:default;gap:8px}
.gd-tab.active{font-weight:500;color:#202124;background:#e8f0fe}
.gd-tab-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.gd-tab-more{margin-left:auto;color:#5f6368;font-size:14px;opacity:0}
.gd-tab.active .gd-tab-more{opacity:1}

/* ---- Page area ---- */
.gd-page-area{flex:1;overflow:auto;display:flex;justify-content:center;padding:20px 40px;background:#f8f9fa}
.gd-page{width:680px;min-height:880px;background:#fff;box-shadow:0 1px 3px rgba(60,64,67,.15),0 4px 8px 3px rgba(60,64,67,.06);padding:72px 72px 72px;position:relative}
.gd-page-accent{position:absolute;top:0;left:50%;transform:translateX(-50%);width:24px;height:4px;background:#4285f4;border-radius:0 0 2px 2px}
.gd-page h1{font-size:24px;font-weight:400;color:#202124;margin-bottom:16px;font-family:'Google Sans',Arial,sans-serif}
.gd-page h2{font-size:18px;font-weight:400;color:#202124;margin:24px 0 8px;font-family:'Google Sans',Arial,sans-serif}
.gd-page h3{font-size:14px;font-weight:500;color:#202124;margin:16px 0 6px;font-family:'Google Sans',Arial,sans-serif}
.gd-page p{font-size:11pt;color:#202124;line-height:1.5;margin-bottom:8px;font-family:Arial,sans-serif}
.gd-page .mock-img{background:#f0f4ff;border:1px solid #dadce0;border-radius:4px;height:200px;display:flex;align-items:center;justify-content:center;color:#80868b;font-size:12px;margin:12px 0}

/* ---- Extensions dropdown ---- */
.gd-ext-dropdown{position:absolute;top:76px;left:0;background:#fff;border-radius:4px;box-shadow:0 2px 6px 2px rgba(60,64,67,.15),0 1px 2px rgba(60,64,67,.3);padding:6px 0;min-width:200px;z-index:1000;display:none}
.gd-ext-dropdown.open{display:block}
.gd-ext-entry{width:100%;padding:6px 32px 6px 16px;font-size:13px;color:#202124;cursor:pointer;display:flex;align-items:center;justify-content:space-between;white-space:nowrap;border:none;background:none;font-family:inherit;text-align:left}
.gd-ext-entry:hover{background:#f1f3f4}
.gd-ext-arrow{color:#5f6368;font-size:10px;margin-left:16px}

/* ---- Submenu ---- */
.gd-submenu{position:absolute;top:76px;left:200px;background:#fff;border-radius:4px;box-shadow:0 2px 6px 2px rgba(60,64,67,.15),0 1px 2px rgba(60,64,67,.3);padding:6px 0;min-width:260px;z-index:1001;display:none}
.gd-submenu.open{display:block}
.gd-menu-item{display:block;width:100%;text-align:left;padding:6px 16px;font-size:13px;color:#202124;cursor:pointer;white-space:nowrap;border:none;background:none;font-family:inherit}
.gd-menu-item:hover{background:#f1f3f4}
.gd-menu-sep{height:1px;background:#dadce0;margin:4px 0}

/* ---- Modal ---- */
.gd-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:none;align-items:center;justify-content:center}
.gd-backdrop.open{display:flex}
.gd-modal{background:#fff;border-radius:8px;box-shadow:0 24px 38px 3px rgba(0,0,0,.14),0 9px 46px 8px rgba(0,0,0,.12),0 11px 15px -7px rgba(0,0,0,.2);overflow:hidden;display:flex;flex-direction:column}
.gd-modal-titlebar{display:flex;align-items:center;padding:12px 8px 12px 20px;border-bottom:1px solid #e0e0e0;flex-shrink:0}
.gd-modal-title{flex:1;font-size:16px;font-weight:400;color:#202124}
.gd-modal-close{width:36px;height:36px;border:none;background:none;border-radius:50%;cursor:pointer;font-size:20px;color:#5f6368;display:flex;align-items:center;justify-content:center;transition:background .15s}
.gd-modal-close:hover{background:#f1f3f4}
.gd-modal iframe{display:block;border:none}

/* ---- Console drawer ---- */
.gd-console-tab{position:fixed;bottom:0;right:24px;background:#1e1e1e;color:#9aa0a6;font-size:11px;padding:4px 16px;border-radius:6px 6px 0 0;cursor:pointer;z-index:3000;user-select:none;font-family:'Roboto Mono',monospace;border:none}
.gd-console-tab:hover{background:#333}
.gd-console{position:fixed;bottom:0;left:0;right:0;height:160px;background:#1e1e1e;border-top:2px solid #333;z-index:2999;display:none;flex-direction:column}
.gd-console.open{display:flex}
.gd-console-header{display:flex;align-items:center;padding:6px 16px;background:#2d2d2d;font-size:11px;color:#9aa0a6;border-bottom:1px solid #333;flex-shrink:0}
.gd-console-header span{flex:1}
.gd-console-btns button{background:none;border:none;color:#9aa0a6;cursor:pointer;font-size:11px;font-family:inherit;margin-left:12px}
.gd-console-btns button:hover{color:#fff}
.gd-console-log{flex:1;overflow-y:auto;padding:8px 16px;font:12px/1.6 'Roboto Mono',monospace;color:#ce9178}
.gd-console-log .ts{color:#6a9955;margin-right:8px}
.gd-console-log .fn{color:#569cd6}
.gd-console-log .args{color:#9cdcfe}

/* ---- Right sidebar icons ---- */
.gd-right-sidebar{width:44px;background:#fff;border-left:1px solid #dadce0;flex-shrink:0;display:flex;flex-direction:column;align-items:center;padding-top:8px;gap:4px}
.gd-rs-icon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:default;color:#5f6368;font-size:16px}
</style>
</head>
<body>

<!-- Top bar -->
<div class="gd-topbar">
  <div class="gd-topbar-icon">
    <svg viewBox="0 0 48 48" fill="none"><path d="M29 4H12a4 4 0 0 0-4 4v32a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V15L29 4z" fill="#4285F4"/><path d="M34 15h6L29 4v6a5 5 0 0 0 5 5z" fill="#A1C2FA"/><path d="M16 24h16v2H16zm0 5h16v2H16zm0 5h10v2H16z" fill="#fff"/></svg>
  </div>
  <span class="gd-topbar-title">Mermaid Toolkit</span>
  <span class="gd-topbar-star">&#9734;</span>
  <span class="gd-topbar-spacer"></span>
  <div class="gd-topbar-actions">
    <span class="gd-editing-badge">Editing</span>
    <button class="gd-share-btn">Share</button>
    <div class="gd-avatar">N</div>
  </div>
</div>

<!-- Menu bar -->
<div class="gd-menubar" id="menubar">
  <div class="gd-menubar-item">File</div>
  <div class="gd-menubar-item">Edit</div>
  <div class="gd-menubar-item">View</div>
  <div class="gd-menubar-item">Insert</div>
  <div class="gd-menubar-item">Format</div>
  <div class="gd-menubar-item">Tools</div>
  <button class="gd-menubar-item gd-ext" id="ext-menu-btn">Extensions</button>
  <div class="gd-menubar-item">Help</div>
</div>

<!-- Toolbar -->
<div class="gd-toolbar">
  <div class="gd-tb-btn">&#8592;</div>
  <div class="gd-tb-btn">&#8594;</div>
  <div class="gd-tb-btn">&#8635;</div>
  <div class="gd-tb-sep"></div>
  <div class="gd-tb-select">100% <span class="arrow">&#9662;</span></div>
  <div class="gd-tb-sep"></div>
  <div class="gd-tb-select">Heading 1 <span class="arrow">&#9662;</span></div>
  <div class="gd-tb-sep"></div>
  <div class="gd-tb-select">Arial <span class="arrow">&#9662;</span></div>
  <div class="gd-tb-select">20 <span class="arrow">&#9662;</span></div>
  <div class="gd-tb-sep"></div>
  <div class="gd-tb-btn"><b>B</b></div>
  <div class="gd-tb-btn"><i>I</i></div>
  <div class="gd-tb-btn"><u>U</u></div>
  <div class="gd-tb-sep"></div>
  <div class="gd-tb-btn">A</div>
  <div class="gd-tb-btn">&#9998;</div>
</div>

<!-- Body -->
<div class="gd-body">
  <!-- Left tabs sidebar -->
  <div class="gd-tabs">
    <div class="gd-tabs-header">
      <div class="gd-tabs-back">&#8592;</div>
      <div class="gd-tabs-title">Document tabs</div>
      <div class="gd-tabs-add">+</div>
    </div>
    <div class="gd-tab active">
      <span class="gd-tab-dot" style="background:#4285f4"></span>
      Tab 1
      <span class="gd-tab-more">&#8942;</span>
    </div>
    <div class="gd-tab"><span class="gd-tab-dot" style="background:transparent"></span>Tab 2</div>
    <div class="gd-tab"><span class="gd-tab-dot" style="background:transparent"></span>Tab 3</div>
    <div class="gd-tab"><span class="gd-tab-dot" style="background:transparent"></span>Tab 4</div>
    <div class="gd-tab"><span class="gd-tab-dot" style="background:transparent"></span>Tab 5</div>
    <div class="gd-tab"><span class="gd-tab-dot" style="background:transparent"></span>Tab 6</div>
  </div>

  <!-- Page area -->
  <div class="gd-page-area">
    <div class="gd-page">
      <div class="gd-page-accent"></div>
      <h1>PRD: Mermaid Toolkit for Google Docs™</h1>
      <h2>Overview</h2>
      <p>Mermaid Toolkit is a Google Docs™ add-on that lets users write Mermaid diagram syntax directly in their documents and render it as high-quality PNG images. Everything runs client-side in the browser &mdash; no servers, no data collection, no cookies.</p>
      <h2>Architecture &amp; Diagrams</h2>
      <h3>System Architecture</h3>
      <p>The add-on runs entirely within Google Docs™. The GAS server handles document manipulation (finding code blocks, inserting/replacing images), while each dialog runs in a sandboxed iframe that loads mermaid.js from jsDelivr to render diagrams client-side.</p>
      <div class="mock-img">[ Architecture Diagram ]</div>
      <h2>Rendering Pipeline</h2>
      <p>The rendering pipeline uses a multi-pass approach to convert SVG to PNG entirely in the browser, handling browser security restrictions around tainted canvases and foreignObject elements.</p>
    </div>
  </div>

  <!-- Right sidebar icons -->
  <div class="gd-right-sidebar">
    <div class="gd-rs-icon">&#128172;</div>
    <div class="gd-rs-icon">&#9998;</div>
    <div class="gd-rs-icon">&#128279;</div>
  </div>
</div>

<!-- Extensions dropdown -->
<div class="gd-ext-dropdown" id="ext-dropdown">
  <button class="gd-ext-entry" id="ext-mermaid">
    Mermaid Toolkit
    <span class="gd-ext-arrow">&#9656;</span>
  </button>
</div>

<!-- Submenu -->
<div class="gd-submenu" id="ext-submenu">
  ${menuItemsHtml}
</div>

<!-- Modal backdrop -->
<div class="gd-backdrop" id="backdrop">
  <div class="gd-modal" id="modal">
    <div class="gd-modal-titlebar">
      <span class="gd-modal-title" id="modal-title"></span>
      <button class="gd-modal-close" id="modal-close">&#10005;</button>
    </div>
    <iframe id="modal-iframe"></iframe>
  </div>
</div>

<!-- Console drawer -->
<button class="gd-console-tab" id="console-tab">Console</button>
<div class="gd-console" id="console-drawer">
  <div class="gd-console-header">
    <span>google.script.run calls</span>
    <div class="gd-console-btns">
      <button id="console-clear">Clear</button>
      <button id="console-close">Close</button>
    </div>
  </div>
  <div class="gd-console-log" id="log"></div>
</div>

<script>
(function() {
  var MENU_DATA = ${menuDataJs};

  var extBtn = document.getElementById("ext-menu-btn");
  var dropdown = document.getElementById("ext-dropdown");
  var mermaidEntry = document.getElementById("ext-mermaid");
  var submenu = document.getElementById("ext-submenu");
  var backdrop = document.getElementById("backdrop");
  var modal = document.getElementById("modal");
  var modalTitle = document.getElementById("modal-title");
  var modalClose = document.getElementById("modal-close");
  var modalIframe = document.getElementById("modal-iframe");
  var consoleTab = document.getElementById("console-tab");
  var consoleDrawer = document.getElementById("console-drawer");
  var consoleClear = document.getElementById("console-clear");
  var consoleClose = document.getElementById("console-close");
  var log = document.getElementById("log");

  function closeMenus() {
    dropdown.classList.remove("open");
    submenu.classList.remove("open");
    extBtn.classList.remove("active");
  }

  function positionDropdown() {
    var r = extBtn.getBoundingClientRect();
    dropdown.style.left = r.left + "px";
    dropdown.style.top = r.bottom + "px";
  }

  function positionSubmenu() {
    var r = dropdown.getBoundingClientRect();
    submenu.style.left = r.right + "px";
    submenu.style.top = r.top + "px";
  }

  extBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    if (dropdown.classList.contains("open")) {
      closeMenus();
    } else {
      positionDropdown();
      dropdown.classList.add("open");
      extBtn.classList.add("active");
    }
  });

  mermaidEntry.addEventListener("mouseenter", function() {
    positionSubmenu();
    submenu.classList.add("open");
  });

  dropdown.addEventListener("mouseleave", function(e) {
    var to = e.relatedTarget;
    if (to && (submenu.contains(to) || dropdown.contains(to))) return;
    submenu.classList.remove("open");
  });

  submenu.addEventListener("mouseleave", function(e) {
    var to = e.relatedTarget;
    if (to && (dropdown.contains(to) || submenu.contains(to))) return;
    submenu.classList.remove("open");
  });

  document.addEventListener("click", function(e) {
    if (!dropdown.contains(e.target) && !submenu.contains(e.target) && e.target !== extBtn) {
      closeMenus();
    }
  });

  submenu.addEventListener("click", function(e) {
    var item = e.target.closest(".gd-menu-item");
    if (!item) return;
    var idx = +item.getAttribute("data-idx");
    var data = MENU_DATA[idx];
    if (!data) return;
    closeMenus();
    openDialog(data.file, data.w, data.h, data.title);
  });

  function openDialog(file, w, h, title) {
    modalTitle.textContent = title;
    modalIframe.setAttribute("width", w);
    modalIframe.setAttribute("height", h);
    modalIframe.src = file;
    modal.style.width = w + "px";
    backdrop.classList.add("open");
  }

  modalClose.addEventListener("click", function() {
    backdrop.classList.remove("open");
    modalIframe.src = "about:blank";
  });

  backdrop.addEventListener("click", function(e) {
    if (e.target === backdrop) {
      backdrop.classList.remove("open");
      modalIframe.src = "about:blank";
    }
  });

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      if (backdrop.classList.contains("open")) {
        backdrop.classList.remove("open");
        modalIframe.src = "about:blank";
      }
      closeMenus();
    }
  });

  // Console drawer
  var consoleOpen = false;
  consoleTab.addEventListener("click", function() {
    consoleOpen = !consoleOpen;
    consoleDrawer.classList.toggle("open", consoleOpen);
    consoleTab.style.display = consoleOpen ? "none" : "";
  });
  consoleClose.addEventListener("click", function() {
    consoleOpen = false;
    consoleDrawer.classList.remove("open");
    consoleTab.style.display = "";
  });
  consoleClear.addEventListener("click", function() { log.innerHTML = ""; });

  window.addEventListener("message", function(e) {
    if (!e.data || e.data.type !== "gas-call") return;
    var time = new Date(e.data.ts).toLocaleTimeString();
    var argsStr = (e.data.args || []).map(function(a) {
      return typeof a === "string" && a.length > 100 ? '"' + a.substring(0, 100) + '..."' : JSON.stringify(a);
    }).join(", ");
    var entry = document.createElement("div");
    entry.innerHTML = '<span class="ts">' + time + '</span> <span class="fn">' + e.data.fn + '</span>(<span class="args">' + argsStr + '</span>)';
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    if (!consoleOpen) {
      consoleTab.textContent = "Console \\u2022";
    }
  });
})();
</script>
</body>
</html>`;
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const startServer = (): void => {
  const root = path.resolve(PREVIEW);

  const server = http.createServer((req, res) => {
    const url = req.url === "/" ? "/index.html" : req.url!;
    const filePath = path.join(root, decodeURIComponent(url));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found: " + url);
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  });

  server.listen(PORT, () => {
    console.log(`\n  Preview server running at http://localhost:${PORT}\n`);
    console.log("  Press Ctrl+C to stop.\n");
  });
};

const main = (): void => {
  if (!fs.existsSync(DIST)) {
    console.error(`Error: ${DIST} not found. Run "yarn gas:build" first.`);
    process.exit(1);
  }

  fs.rmSync(PREVIEW, { recursive: true, force: true });
  fs.mkdirSync(PREVIEW, { recursive: true });

  console.log("Generating preview files...\n");

  for (const dialog of DIALOGS) {
    const srcPath = path.join(DIST, dialog.file);
    if (!fs.existsSync(srcPath)) {
      console.warn(`  SKIP: ${dialog.file} not found in ${DIST}`);
      continue;
    }

    let html = fs.readFileSync(srcPath, "utf8");
    html = processDialog(dialog.file, html);
    fs.writeFileSync(path.join(PREVIEW, dialog.file), html);
    console.log(`  ${dialog.file} (${dialog.width}×${dialog.height})`);
  }

  const gallery = buildGalleryPage();
  fs.writeFileSync(path.join(PREVIEW, "index.html"), gallery);
  console.log("\n  index.html (gallery)");

  startServer();
};

main();
