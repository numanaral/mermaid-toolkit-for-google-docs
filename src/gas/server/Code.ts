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

const makeUniqueDiagramBlob = (
  base64Data: string,
): GoogleAppsScript.Base.Blob => {
  const stamp = Date.now();
  const id = Utilities.getUuid().slice(0, 8);
  return Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    "image/png",
    `mermaid-diagram-${stamp}-${id}.png`,
  );
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
  const blob = makeUniqueDiagramBlob(base64Data);

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
  const blob = makeUniqueDiagramBlob(base64Data);

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
    .setWidth(400)
    .setHeight(320);
  DocumentApp.getUi().showModalDialog(html, "Dev Tools");
};

export const showAbout = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("About")
    .setWidth(320)
    .setHeight(280);
  DocumentApp.getUi().showModalDialog(html, "About");
};

export const openDocumentInfo = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const { body, tabId, isFirstTab } = getActiveBody(doc);
  const n = body.getNumChildren();
  const images = findMermaidImages();
  const snippets = findMermaidSnippets();

  const data = {
    rows: [
      ["Document ID", doc.getId()],
      ["Name", doc.getName()],
      ["Tab", isFirstTab ? "#1 (primary)" : tabId],
      ["Children", String(n)],
      ["Mermaid Diagrams", String(images.length)],
      ["Mermaid Code Blocks", String(snippets.length)],
      ["URL", doc.getUrl()],
    ],
  };

  const template = HtmlService.createTemplateFromFile("DocInfo");
  template.data = JSON.stringify(data);
  const html = template.evaluate().setWidth(500).setHeight(350);
  DocumentApp.getUi().showModalDialog(html, "Document Info");
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
  };

  const template = HtmlService.createTemplateFromFile("Inspector");
  template.data = JSON.stringify(data);
  const html = template.evaluate().setWidth(1100).setHeight(700);
  DocumentApp.getUi().showModalDialog(html, "Document Body Inspector");
};
