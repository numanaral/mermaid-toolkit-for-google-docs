import type { MermaidSnippet } from "./types";
import { extractSelectedText, insertFencedCode, makeBlob, setMermaidAlt } from "./doc-utils";
import { findMermaidSnippets } from "./snippets";
import { findMermaidImages, findMermaidImageIn } from "./images";

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

  const html = template.evaluate().setWidth(900).setHeight(620);
  DocumentApp.getUi().showModalDialog(html, "Mermaid Editor");
};

const openExtractDialog = (images: ReturnType<typeof findMermaidImages>): void => {
  const template = HtmlService.createTemplateFromFile("Extract");
  template.imageInfos = JSON.stringify(images);

  const html = template.evaluate().setWidth(800).setHeight(600);
  DocumentApp.getUi().showModalDialog(html, "Convert Images to Code");
};

// --- Public functions (called by GAS menu / client dialogs) ---

const onOpen = (): void => {
  DocumentApp.getUi()
    .createMenu("Mermaid Toolkit")
    .addItem("Insert Mermaid Diagram", "openEditor")
    .addItem("Edit Selected Mermaid Image", "editSelectedMermaidImage")
    .addSeparator()
    .addItem("Convert Selected Code to Diagram", "convertSelectedCodeToDiagram")
    .addItem("Convert All Code to Diagrams", "scanAndRender")
    .addSeparator()
    .addItem("Convert Selected Image to Code", "convertSelectedImageToCode")
    .addItem("Convert All Images to Code", "extractMermaidFromImages")
    .addSeparator()
    .addItem("Fix Copied Markdown", "openFixMarkdown")
    .addSeparator()
    .addItem("Quick Guide", "showQuickGuide")
    .addItem("About", "showAbout")
    .addToUi();
};

const openEditor = (): void => {
  openEditorForImage("", -1);
};

const scanAndRender = (): void => {
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

const renderSelection = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    DocumentApp.getUi().alert(
      "No text selected.\n\nHighlight the mermaid diagram text and try again.",
    );
    return;
  }

  const { text, startIdx, endIdx } = extractSelectedText(selection, doc.getBody());

  if (!text) {
    DocumentApp.getUi().alert("Selected text is empty.");
    return;
  }

  showPreviewDialog([{ definition: text, startIdx, endIdx }]);
};

const convertSelectedCodeToDiagram = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    DocumentApp.getUi().alert(
      "No text selected.\n\n" +
        "Select a mermaid code block or fenced ```mermaid block and try again.",
    );
    return;
  }

  const { text, startIdx, endIdx } = extractSelectedText(selection, doc.getBody());

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

const editSelectedMermaidImage = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    DocumentApp.getUi().alert(
      "No image selected.\n\n" +
        "Click on a Mermaid diagram image to select it, then try again.",
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
    "Selected image is not a Mermaid diagram.\n\n" +
      "Only images inserted by this add-on contain embedded Mermaid source code.",
  );
};

const extractMermaidFromImages = (): void => {
  const images = findMermaidImages();

  if (images.length === 0) {
    DocumentApp.getUi().alert(
      "No Mermaid diagram images found.\n\n" +
        "Only images inserted by this add-on contain embedded Mermaid source code.",
    );
    return;
  }

  openExtractDialog(images);
};

const convertSelectedImageToCode = (): void => {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    DocumentApp.getUi().alert(
      "No image selected.\n\n" +
        "Click on a Mermaid diagram image to select it, then try again.",
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
    "Selected image is not a Mermaid diagram.\n\n" +
      "Only images inserted by this add-on contain embedded Mermaid source code.",
  );
};

const insertDiagramAfterText = (
  base64Data: string,
  startIdx: number,
  endIdx: number,
  index: number,
  mermaidSource: string,
): { success: boolean; index: number } => {
  const body = DocumentApp.getActiveDocument().getBody();
  const blob = makeBlob(base64Data, index);
  const image = endIdx >= 0 ? body.insertImage(endIdx + 1, blob) : body.appendImage(blob);
  if (mermaidSource) setMermaidAlt(image, mermaidSource);
  return { success: true, index };
};

const replaceDiagramText = (
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

const insertImageAtCursor = (
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

const replaceImageInPlace = (
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

const insertCodeBlockAfterImage = (source: string, imageIdx: number): { success: boolean } => {
  const body = DocumentApp.getActiveDocument().getBody();
  insertFencedCode(body, imageIdx + 1, source);
  return { success: true };
};

const replaceImageWithCodeBlock = (source: string, imageIdx: number): { success: boolean } => {
  const body = DocumentApp.getActiveDocument().getBody();
  insertFencedCode(body, imageIdx, source);
  body.removeChild(body.getChild(imageIdx + 1));
  return { success: true };
};

const openEditorWithSource = (source: string): void => {
  openEditorForImage(source, -1);
};

const openFixMarkdown = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("FixMarkdown").setWidth(720).setHeight(480);
  DocumentApp.getUi().showModalDialog(html, "Fix Copied Markdown");
};

const showQuickGuide = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("QuickGuide").setWidth(440).setHeight(420);
  DocumentApp.getUi().showModalDialog(html, "Quick Guide");
};

const showAbout = (): void => {
  const html = HtmlService.createHtmlOutputFromFile("About").setWidth(320).setHeight(240);
  DocumentApp.getUi().showModalDialog(html, "About");
};
