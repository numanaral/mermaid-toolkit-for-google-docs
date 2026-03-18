import type { MermaidSnippet } from "./types";
import {
  extractSelectedText,
  insertFencedCode,
  makeBlob,
  setMermaidAlt,
} from "./doc-utils";
import { findMermaidSnippets } from "./snippets";
import { findMermaidImages, findMermaidImageIn } from "./images";
import { exportDocAsMarkdown } from "./export-md";
import { getActiveBody, getTabContent } from "./tab-utils";

// --- Dialog helpers ---

const showPreviewDialog = (blockInfos: MermaidSnippet[]): void => {
  const template = HtmlService.createTemplateFromFile("Preview");
  template.blockInfos = JSON.stringify(blockInfos);

  const html = template.evaluate().setWidth(800).setHeight(600);
  DocumentApp.getUi().showModalDialog(html, "Convert Code to Diagrams");
};

const openEditorForImage = (source: string, imageChildIndex: number): void => {
  const template = HtmlService.createTemplateFromFile("Editor");
  template.initialSource = source;
  template.imageChildIndex = imageChildIndex;

  const html = template.evaluate().setWidth(1000).setHeight(700);
  DocumentApp.getUi().showModalDialog(html, "Mermaid Editor");
};

const openExtractDialog = (
  images: ReturnType<typeof findMermaidImages>,
): void => {
  const template = HtmlService.createTemplateFromFile("Extract");
  template.imageInfos = JSON.stringify(images);

  const html = template.evaluate().setWidth(800).setHeight(600);
  DocumentApp.getUi().showModalDialog(html, "Convert Diagrams to Code");
};

// --- Public functions (called by GAS menu / client dialogs) ---
// Exported so the build can discover and emit them as top-level GAS functions.

export const onOpen = (): void => {
  DocumentApp.getUi()
    .createMenu("Mermaid Toolkit")
    .addItem("Insert Mermaid Diagram", "openEditor")
    .addItem("Edit All Mermaid Diagrams", "openEditDiagrams")
    .addItem("Edit Selected Mermaid Diagram", "editSelectedMermaidImage")
    .addSeparator()
    .addItem("Convert All Code to Diagrams", "scanAndRender")
    .addItem("Convert Selected Code to Diagram", "convertSelectedCodeToDiagram")
    .addSeparator()
    .addItem("Convert All Diagrams to Code", "extractMermaidFromImages")
    .addItem("Convert Selected Diagram to Code", "convertSelectedImageToCode")
    .addSeparator()
    .addItem("Import from Markdown", "openImportMarkdown")
    .addItem("Export as Markdown", "openExportMarkdown")
    .addItem('Fix Native "Copy as Markdown"', "openFixMarkdown")
    .addSeparator()
    .addItem("Quick Guide", "showQuickGuide")
    .addItem("Dev Tools", "openDevTools")
    .addItem("About", "showAbout")
    .addToUi();
};

export const openEditor = (): void => {
  openEditorForImage("", -1);
};

export const scanAndRender = (): void => {
  const blocks = findMermaidSnippets();

  if (blocks.length === 0) {
    DocumentApp.getUi().alert(
      "No mermaid code blocks found.\n\n" +
        "Make sure your mermaid diagrams are in code " +
        "blocks (paste from markdown or use Format > " +
        "Code block), or wrapped in ```mermaid fences.",
    );
    return;
  }

  showPreviewDialog(blocks);
};

export const renderSelection = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    DocumentApp.getUi().alert(
      "No text selected.\n\nHighlight the mermaid diagram text and try again.",
    );
    return;
  }

  const { text, startIdx, endIdx } = extractSelectedText(
    selection,
    doc.getBody(),
  );

  if (!text) {
    DocumentApp.getUi().alert("Selected text is empty.");
    return;
  }

  showPreviewDialog([{ definition: text, startIdx, endIdx }]);
};

export const convertSelectedCodeToDiagram = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    DocumentApp.getUi().alert(
      "No text selected.\n\n" +
        "Select a mermaid code block or fenced ```mermaid block and try again.",
    );
    return;
  }

  const { text, startIdx, endIdx } = extractSelectedText(
    selection,
    doc.getBody(),
  );

  if (!text) {
    DocumentApp.getUi().alert("Selected text is empty.");
    return;
  }

  const template = HtmlService.createTemplateFromFile("Convert");
  template.mermaidSource = text;
  template.startIdx = startIdx;
  template.endIdx = endIdx;

  const html = template.evaluate().setWidth(360).setHeight(180);
  DocumentApp.getUi().showModalDialog(html, "Converting...");
};

export const editSelectedMermaidImage = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    DocumentApp.getUi().alert(
      "No diagram selected.\n\n" +
        "Click on a Mermaid diagram to select it, then try again.",
    );
    return;
  }

  const body = doc.getBody();
  for (const re of selection.getRangeElements()) {
    const result = findMermaidImageIn(re.getElement(), body);
    if (result) {
      openEditorForImage(result.source, result.childIndex);
      return;
    }
  }

  DocumentApp.getUi().alert(
    "Selection is not a Mermaid diagram.\n\n" +
      "Only diagrams inserted by this add-on contain embedded Mermaid source code.",
  );
};

export const openEditDiagrams = (): void => {
  const images = findMermaidImages();

  if (images.length === 0) {
    DocumentApp.getUi().alert(
      "No Mermaid diagrams found.\n\n" +
        "Only diagrams inserted by this add-on contain embedded Mermaid source code.",
    );
    return;
  }

  const template = HtmlService.createTemplateFromFile("EditDiagrams");
  template.imageInfos = JSON.stringify(images);

  const html = template.evaluate().setWidth(800).setHeight(600);
  DocumentApp.getUi().showModalDialog(html, "Edit All Mermaid Diagrams");
};

export const extractMermaidFromImages = (): void => {
  const images = findMermaidImages();

  if (images.length === 0) {
    DocumentApp.getUi().alert(
      "No Mermaid diagrams found.\n\n" +
        "Only diagrams inserted by this add-on contain embedded Mermaid source code.",
    );
    return;
  }

  openExtractDialog(images);
};

export const convertSelectedImageToCode = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    DocumentApp.getUi().alert(
      "No diagram selected.\n\n" +
        "Click on a Mermaid diagram to select it, then try again.",
    );
    return;
  }

  const body = doc.getBody();
  for (const re of selection.getRangeElements()) {
    const result = findMermaidImageIn(re.getElement(), body);
    if (result) {
      insertFencedCode(body, result.childIndex, result.source);
      body.removeChild(body.getChild(result.childIndex + 1));
      return;
    }
  }

  DocumentApp.getUi().alert(
    "Selection is not a Mermaid diagram.\n\n" +
      "Only diagrams inserted by this add-on contain embedded Mermaid source code.",
  );
};

export const insertDiagramAfterText = (
  base64Data: string,
  startIdx: number,
  endIdx: number,
  index: number,
  mermaidSource: string,
): { success: boolean; index: number } => {
  const body = DocumentApp.getActiveDocument().getBody();
  const blob = makeBlob(base64Data, index);
  const image =
    endIdx >= 0 ? body.insertImage(endIdx + 1, blob) : body.appendImage(blob);
  if (mermaidSource) setMermaidAlt(image, mermaidSource);
  return { success: true, index };
};

export const replaceDiagramText = (
  base64Data: string,
  startIdx: number,
  endIdx: number,
  index: number,
  mermaidSource: string,
): { success: boolean; index: number } => {
  const body = DocumentApp.getActiveDocument().getBody();

  if (startIdx < 0 || endIdx < 0) {
    throw new Error("Cannot replace: code block position unknown.");
  }

  const blob = makeBlob(base64Data, index);
  const image = body.insertImage(startIdx, blob);

  for (let i = endIdx + 1; i > startIdx; i--) {
    body.removeChild(body.getChild(i));
  }

  if (mermaidSource) setMermaidAlt(image, mermaidSource);
  return { success: true, index };
};

export const insertImageAtCursor = (
  base64Data: string,
  mermaidSource: string,
): { success: boolean; position: string } => {
  const doc = DocumentApp.getActiveDocument();
  const cursor = doc.getCursor();
  const body = doc.getBody();
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    "image/png",
    "mermaid-diagram.png",
  );

  if (cursor) {
    const el = cursor.getElement();
    let para: GoogleAppsScript.Document.Element = el;
    while (
      para.getParent() &&
      para.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION
    ) {
      para = para.getParent();
    }
    try {
      const idx = body.getChildIndex(para);
      const image = body.insertImage(idx + 1, blob);
      if (mermaidSource) setMermaidAlt(image, mermaidSource);
      return { success: true, position: "cursor" };
    } catch {
      /* fall through to append */
    }
  }

  const image = body.appendImage(blob);
  if (mermaidSource) setMermaidAlt(image, mermaidSource);
  return { success: true, position: "end" };
};

export const replaceImageInPlace = (
  base64Data: string,
  childIndex: number,
  mermaidSource: string,
): { success: boolean } => {
  const body = DocumentApp.getActiveDocument().getBody();
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    "image/png",
    "mermaid-diagram.png",
  );

  const image = body.insertImage(childIndex, blob);
  body.removeChild(body.getChild(childIndex + 1));
  if (mermaidSource) setMermaidAlt(image, mermaidSource);
  return { success: true };
};

export const insertCodeBlockAfterImage = (
  source: string,
  imageIdx: number,
): { success: boolean } => {
  const body = DocumentApp.getActiveDocument().getBody();
  insertFencedCode(body, imageIdx + 1, source);
  return { success: true };
};

export const replaceImageWithCodeBlock = (
  source: string,
  imageIdx: number,
): { success: boolean } => {
  const body = DocumentApp.getActiveDocument().getBody();
  insertFencedCode(body, imageIdx, source);
  body.removeChild(body.getChild(imageIdx + 1));
  return { success: true };
};

export const openEditorWithSource = (source: string): void => {
  openEditorForImage(source, -1);
};

export const openImportMarkdown = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("ImportMarkdown")
    .setWidth(1000)
    .setHeight(700);
  DocumentApp.getUi().showModalDialog(html, "Import from Markdown");
};

export const isActiveTabFirst = (): boolean => {
  try {
    return DocumentApp.getActiveDocument().getActiveTab().getIndex() === 0;
  } catch {
    return true;
  }
};

export { importMarkdownAtCursor, importMarkdownReplace } from "./import-md";

export const openExportMarkdown = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("ExportMarkdown")
    .setWidth(900)
    .setHeight(600);
  DocumentApp.getUi().showModalDialog(html, "Export as Markdown");
};

export const getExportMarkdown = (): string => {
  const doc = DocumentApp.getActiveDocument();
  const { body, tabId, isFirstTab } = getActiveBody(doc);
  return exportDocAsMarkdown(body, doc.getId(), isFirstTab ? "" : tabId);
};

export const openFixMarkdown = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("FixMarkdown")
    .setWidth(900)
    .setHeight(600);
  DocumentApp.getUi().showModalDialog(html, 'Fix Native "Copy as Markdown"');
};

export const showQuickGuide = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("QuickGuide")
    .setWidth(560)
    .setHeight(460);
  DocumentApp.getUi().showModalDialog(html, "Quick Guide");
};

export const openDevTools = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("DevTools")
    .setWidth(560)
    .setHeight(460);
  DocumentApp.getUi().showModalDialog(html, "Dev Tools");
};

export const showAbout = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("About")
    .setWidth(320)
    .setHeight(280);
  DocumentApp.getUi().showModalDialog(html, "About");
};

export const getDocumentInfo = (): string => {
  const doc = DocumentApp.getActiveDocument();
  const { body, tabId, isFirstTab } = getActiveBody(doc);
  const n = body.getNumChildren();
  const images = findMermaidImages();
  const snippets = findMermaidSnippets();

  const lines = [
    "Document ID: " + doc.getId(),
    "Name: " + doc.getName(),
    "Tab: " + (isFirstTab ? "#1 (primary)" : tabId),
    "Children: " + n,
    "Mermaid Diagrams: " + images.length,
    "Mermaid Code Blocks: " + snippets.length,
    "URL: " + doc.getUrl(),
  ];
  return lines.join("\n");
};

export const debugDocStructure = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();
  const { body, tabId, isFirstTab } = getActiveBody(doc);
  const n = body.getNumChildren();

  interface ChildInfo {
    idx: number;
    type: string;
    heading: string;
    glyph: string;
    nest: number;
    text: string;
    font: string;
  }
  const children: ChildInfo[] = [];

  for (let i = 0; i < n; i++) {
    const child = body.getChild(i);
    const type = child.getType().toString();
    let text = "";
    let heading = "";
    let glyph = "";
    let nest = -1;
    let font = "";

    try {
      if (type === "TABLE") {
        const tbl = child.asTable();
        const cellTexts: string[] = [];
        for (let r = 0; r < tbl.getNumRows() && r < 2; r++) {
          const row = tbl.getRow(r);
          for (let c = 0; c < row.getNumCells() && c < 3; c++) {
            cellTexts.push(row.getCell(c).editAsText().getText());
          }
        }
        text = cellTexts.join(" | ");
      } else if (type === "LIST_ITEM") {
        const li = child.asListItem();
        text = li.editAsText().getText();
        glyph = String(li.getGlyphType());
        nest = li.getNestingLevel();
        try {
          font = li.editAsText().getFontFamily(0) ?? "";
        } catch {
          /* */
        }
      } else if (type === "PARAGRAPH") {
        const para = child.asParagraph();
        text = para.editAsText().getText();
        heading = String(para.getHeading());
        try {
          font = para.editAsText().getFontFamily(0) ?? "";
        } catch {
          /* */
        }
      } else {
        text = (child as GoogleAppsScript.Document.Text).editAsText().getText();
      }
    } catch {
      text = "(unable to read)";
    }

    children.push({ idx: i, type, heading, glyph, nest, text, font });
  }

  interface ApiBlock {
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
  const apiBlocks: ApiBlock[] = [];
  let listsJson = "{}";

  if (typeof Docs !== "undefined" && Docs?.Documents) {
    try {
      const fields =
        "body.content(startIndex,endIndex,sectionBreak,table,paragraph(bullet,paragraphStyle,elements(textRun(content,textStyle)))),lists";

      let raw: GoogleAppsScript.Docs.Schema.Document;
      if (!tabId || isFirstTab) {
        raw = Docs.Documents.get(docId, { fields });
      } else {
        raw = Docs.Documents.get(docId, {
          includeTabsContent: true,
          fields: "tabs(tabProperties/tabId,documentTab/" + fields + ")",
        });
        const tabs = (
          raw as unknown as {
            tabs?: {
              tabProperties?: { tabId?: string };
              documentTab?: GoogleAppsScript.Docs.Schema.Document;
            }[];
          }
        ).tabs;
        if (tabs) {
          for (const tab of tabs) {
            if (tab.tabProperties?.tabId === tabId) {
              raw = tab.documentTab as GoogleAppsScript.Docs.Schema.Document;
              break;
            }
          }
        }
      }

      const content = raw?.body?.content ?? [];
      const lists =
        (raw as unknown as { lists?: Record<string, unknown> })?.lists ?? {};
      listsJson = JSON.stringify(lists, null, 2);

      const listGlyphs: Record<
        string,
        { glyphType: string; glyphSymbol: string }
      > = {};
      for (const [listId, listDef] of Object.entries(lists) as [
        string,
        {
          listProperties?: {
            nestingLevels?: { glyphType?: string; glyphSymbol?: string }[];
          };
        },
      ][]) {
        const l0 = listDef?.listProperties?.nestingLevels?.[0];
        listGlyphs[listId] = {
          glyphType: l0?.glyphType ?? "",
          glyphSymbol: l0?.glyphSymbol ?? "",
        };
      }

      for (let i = 0; i < content.length; i++) {
        const block = content[i] as Record<string, unknown>;
        let type = "UNKNOWN";
        let listId = "";
        let nestLevel = -1;
        let indent = "";
        let text = "";
        let glyphType = "";
        let glyphSymbol = "";
        let strikethrough = false;

        let bulletRaw = "";
        let textStyleRaw = "";

        if (block.sectionBreak) {
          type = "SECTION_BREAK";
        } else if (block.table) {
          type = "TABLE";
          text = "(table)";
        } else if (block.paragraph) {
          type = "PARAGRAPH";
          const para = block.paragraph as Record<string, unknown>;
          const bullet = para.bullet as
            | { nestingLevel?: number; listId?: string }
            | undefined;
          const ps = para.paragraphStyle as
            | {
                namedStyleType?: string;
                indentStart?: { magnitude?: number };
                indentFirstLine?: { magnitude?: number };
              }
            | undefined;
          const elements = (para.elements ?? []) as {
            textRun?: {
              content?: string;
              textStyle?: Record<string, unknown>;
            };
          }[];

          text = elements
            .map((e) => e.textRun?.content ?? "")
            .join("")
            .replace(/\n$/, "");

          if (bullet) {
            type = "PARAGRAPH+BULLET";
            listId =
              ((bullet as Record<string, unknown>).listId as string) ?? "";
            nestLevel = bullet.nestingLevel ?? 0;
            bulletRaw = JSON.stringify(bullet);
            if (listId && listGlyphs[listId]) {
              glyphType = listGlyphs[listId].glyphType;
              glyphSymbol = listGlyphs[listId].glyphSymbol;
            }
          }
          if (ps?.namedStyleType && ps.namedStyleType !== "NORMAL_TEXT") {
            type += " [" + ps.namedStyleType + "]";
          }
          const iS = ps?.indentStart?.magnitude;
          const iF = ps?.indentFirstLine?.magnitude;
          if (iS || iF) indent = "s:" + (iS ?? 0) + " f:" + (iF ?? 0);

          const allStyles = elements
            .map((e) => e.textRun?.textStyle)
            .filter(Boolean);
          if (allStyles.length > 0) {
            textStyleRaw = JSON.stringify(allStyles);
          }

          strikethrough =
            elements.length > 0 &&
            elements.every(
              (e) =>
                (
                  e.textRun?.textStyle as
                    | { strikethrough?: boolean }
                    | undefined
                )?.strikethrough === true,
            );
        }

        apiBlocks.push({
          idx: i,
          type,
          listId: listId ? listId.substring(0, 20) : "",
          nestLevel,
          indent,
          text,
          glyphType,
          glyphSymbol,
          strikethrough,
          bulletRaw,
          textStyleRaw,
        });
      }
    } catch (e) {
      apiBlocks.push({
        idx: -1,
        type: "ERROR: " + e,
        listId: "",
        nestLevel: -1,
        indent: "",
        text: "",
        glyphType: "",
        glyphSymbol: "",
        strikethrough: false,
        bulletRaw: "",
        textStyleRaw: "",
      });
    }
  }

  const data = {
    numChildren: n,
    tabId,
    isFirstTab,
    children,
    apiBlocks,
    listsJson,
  };

  const template = HtmlService.createTemplate(INSPECTOR_HTML);
  template.data = JSON.stringify(data);
  const html = template.evaluate().setWidth(1100).setHeight(700);
  DocumentApp.getUi().showModalDialog(html, "Document Body Inspector");
};

const INSPECTOR_HTML = `<!DOCTYPE html>
<html><head><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Google Sans','Roboto',Arial,sans-serif;font-size:12px;display:flex;flex-direction:column;height:100vh;overflow:hidden;background:#fff;color:#1b1b1f}
.toolbar{display:flex;gap:8px;padding:10px 16px;background:#f2f4f5;background-image:linear-gradient(rgba(26,115,232,0.05),rgba(26,115,232,0.05));align-items:center;flex-wrap:wrap;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,0.05),0 1px 3px rgba(0,0,0,0.08)}
.toolbar-spacer{flex:1}
.stat{display:inline-block;background:#e8eaed;padding:3px 10px;border-radius:12px;font-size:11px;color:#747579;font-weight:500}
.btn{padding:8px 20px;font-size:13px;border-radius:12px;font-family:inherit;font-weight:500;cursor:pointer;border:none;white-space:nowrap;transition:box-shadow .2s,background .2s,opacity .2s}
.btn-primary{background:#1a73e8;color:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.05),0 1px 3px rgba(0,0,0,0.08)}
.btn-primary:hover{box-shadow:0 2px 6px rgba(0,0,0,0.07),0 4px 12px rgba(0,0,0,0.06)}
.btn-primary.copied{background:#1e8e3e}
.tabs{display:inline-flex;margin:10px 16px 0}
.tab{padding:6px 16px;font-size:13px;font-weight:500;color:#747579;cursor:pointer;border:1px solid #c4c6cf;background:#fff;font-family:inherit;transition:background .15s,color .15s}
.tab:first-child{border-radius:12px 0 0 12px}
.tab:last-child{border-radius:0 12px 12px 0}
.tab+.tab{border-left:none}
.tab:hover{background:#f2f4f5;color:#1b1b1f}
.tab.active{background:#d3e3fd;color:#1a73e8}
.tab-content{flex:1;overflow:auto;display:none}
.tab-content.active{display:block}
table{width:100%;border-collapse:collapse;font-size:11px}
th{text-align:left;background:#f2f4f5;padding:6px 8px;border:1px solid #c4c6cf;white-space:nowrap;position:sticky;top:0;z-index:1;color:#747579;font-weight:500}
td{padding:4px 8px;border:1px solid #e8eaed;vertical-align:top}
td.mono{font-family:'Roboto Mono',monospace;font-size:10px;white-space:pre-wrap;word-break:break-all;max-width:400px}
tr:nth-child(even){background:#fafafa}
tr.cb{background:#e6f4ea}
tr.heading{background:#d3e3fd}
tr.table-row{background:#fef7e0}
tr.section{background:#f3e8fd}
.json-view{font-family:'Roboto Mono',monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-all;padding:16px 20px;margin:0;background:rgba(0,0,0,0.02);color:#1b1b1f}
.json-key{color:#1a73e8}
.json-str{color:#1e8e3e}
.json-num{color:#e8710a}
.json-null{color:#747579}
</style></head><body>
<div class="toolbar">
<span class="stat" id="stat-children"></span>
<span class="stat" id="stat-tab"></span>
<span class="toolbar-spacer"></span>
<button class="btn btn-primary" id="copy-btn">Copy Active Tab</button>
</div>
<div class="tabs">
<div class="tab active" data-tab="docapp">DocumentApp Children</div>
<div class="tab" data-tab="docsapi">Docs API Blocks</div>
<div class="tab" data-tab="lists">Lists Definitions</div>
</div>
<div class="tab-content active" id="tc-docapp"></div>
<div class="tab-content" id="tc-docsapi"></div>
<div class="tab-content" id="tc-lists"></div>
<script>
var data=JSON.parse(<?!= JSON.stringify(data) ?>);
document.getElementById('stat-children').textContent='Children: '+data.numChildren;
document.getElementById('stat-tab').textContent='Tab: '+(data.isFirstTab?'#1 (primary)':data.tabId);
var tabs=document.querySelectorAll('.tab');
var panes=document.querySelectorAll('.tab-content');
for(var ti=0;ti<tabs.length;ti++){(function(i){tabs[i].onclick=function(){
for(var j=0;j<tabs.length;j++){tabs[j].classList.remove('active');panes[j].classList.remove('active')}
tabs[i].classList.add('active');panes[i].classList.add('active');
}})(ti)}
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function trunc(s,n){return s.length>n?s.substring(0,n)+'...':s}
var copyParts={docapp:[],docsapi:[],lists:[]};
var h='<table><tr><th>#</th><th>Type</th><th>Heading</th><th>Glyph</th><th>Nest</th><th>Font</th><th>Text</th></tr>';
copyParts.docapp.push('# DocumentApp Children');
copyParts.docapp.push('idx|type|heading|glyph|nest|font|text');
copyParts.docapp.push('---|----|----|-----|----|----|----');
for(var i=0;i<data.children.length;i++){var c=data.children[i];
var cls=c.type==='TABLE'?'table-row':c.heading&&c.heading!=='NORMAL'?'heading':'';
h+='<tr class="'+cls+'"><td>'+c.idx+'</td><td>'+c.type+'</td><td>'+esc(c.heading)+'</td><td>'+esc(c.glyph)+'</td><td>'+(c.nest>=0?c.nest:'')+'</td><td>'+esc(c.font)+'</td><td class="mono">'+esc(trunc(c.text,200))+'</td></tr>';
copyParts.docapp.push(c.idx+'|'+c.type+'|'+c.heading+'|'+c.glyph+'|'+(c.nest>=0?c.nest:'')+'|'+c.font+'|'+c.text.replace(/\\n/g,'\\\\n'))}
h+='</table>';document.getElementById('tc-docapp').innerHTML=h;
var h2='<table><tr><th>#</th><th>Type</th><th>ListId</th><th>Nest</th><th>Indent</th><th>GlyphType</th><th>GlyphSym</th><th>Strike</th><th>Bullet (raw)</th><th>TextStyle (raw)</th><th>Text</th></tr>';
copyParts.docsapi.push('# Docs API Blocks');
copyParts.docsapi.push('idx|type|listId|nest|indent|glyphType|glyphSym|strike|bulletRaw|textStyleRaw|text');
copyParts.docsapi.push('---|----|----|----|----|---------|--------|------|---------|------------|----');
for(var j=0;j<data.apiBlocks.length;j++){var b=data.apiBlocks[j];
var cls2=b.type.indexOf('SECTION')>=0?'section':b.type.indexOf('TABLE')>=0?'table-row':b.glyphType==='GLYPH_TYPE_UNSPECIFIED'?'cb':b.type.indexOf('HEADING')>=0?'heading':'';
h2+='<tr class="'+cls2+'"><td>'+b.idx+'</td><td>'+esc(b.type)+'</td><td class="mono">'+esc(b.listId)+'</td><td>'+(b.nestLevel>=0?b.nestLevel:'')+'</td><td>'+esc(b.indent)+'</td><td>'+esc(b.glyphType)+'</td><td>'+esc(b.glyphSymbol)+'</td><td>'+(b.strikethrough?'YES':'')+'</td><td class="mono" style="max-width:200px;overflow:auto;font-size:10px">'+esc(b.bulletRaw||'')+'</td><td class="mono" style="max-width:200px;overflow:auto;font-size:10px">'+esc(b.textStyleRaw||'')+'</td><td class="mono">'+esc(trunc(b.text,200))+'</td></tr>';
copyParts.docsapi.push(b.idx+'|'+b.type+'|'+b.listId+'|'+(b.nestLevel>=0?b.nestLevel:'')+'|'+b.indent+'|'+b.glyphType+'|'+b.glyphSymbol+'|'+(b.strikethrough?'YES':'')+' |'+(b.bulletRaw||'')+'|'+(b.textStyleRaw||'')+'|'+b.text.replace(/\\n/g,'\\\\n'))}
h2+='</table>';document.getElementById('tc-docsapi').innerHTML=h2;
copyParts.lists.push('# Lists Definitions');
copyParts.lists.push(data.listsJson);
function syntaxHL(json){return json.replace(/("(?:\\\\.|[^"])*")\\s*:/g,'<span class="json-key">$1</span>:').replace(/:\\s*("(?:\\\\.|[^"])*")/g,': <span class="json-str">$1</span>').replace(/:\\s*(\\d+\\.?\\d*)/g,': <span class="json-num">$1</span>').replace(/:\\s*(null|true|false)/g,': <span class="json-null">$1</span>')}
document.getElementById('tc-lists').innerHTML='<div class="json-view">'+syntaxHL(esc(data.listsJson))+'</div>';
document.getElementById('copy-btn').onclick=function(){
var active='docapp';for(var k=0;k<tabs.length;k++){if(tabs[k].classList.contains('active')){active=tabs[k].getAttribute('data-tab');break}}
var text=copyParts[active].join('\\n');var btn=document.getElementById('copy-btn');
navigator.clipboard.writeText(text).then(function(){btn.textContent='Copied!';btn.className='btn btn-primary copied';setTimeout(function(){btn.textContent='Copy Active Tab';btn.className='btn btn-primary'},1500)}).catch(function(){
var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);btn.textContent='Copied!';btn.className='btn btn-primary copied';setTimeout(function(){btn.textContent='Copy Active Tab';btn.className='btn btn-primary'},1500)})};
</script></body></html>`;
