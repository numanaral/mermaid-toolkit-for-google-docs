/**
 * GAS menu + menu handler entrypoints, and re-exports for dialog RPC (google.script.run).
 * Build bundles this file into Code.gs (see scripts/build-gas.ts). Logic lives in sibling modules.
 */
import { bakeAllFenceSources, tryGetSelectedMermaidImage } from "./images";
import {
  tryGetMermaidSnippetForConvert,
  tryGetMermaidSnippetForPreview,
} from "./mermaid-code-selection";
import {
  openConvertDialog,
  openDiagramToCodeDialog,
  openEditDiagramsDialog,
  openEditorForImage,
  openExtractDialog,
  openSimpleHtmlDialog,
  showPreviewDialog,
} from "./ui-dialogs";

export function onOpen(): void {
  DocumentApp.getUi()
    .createMenu("Mermaid Toolkit")
    .addItem("Insert Mermaid Diagram", "openEditor")
    .addItem("Edit All Mermaid Diagrams", "openEditDiagrams")
    .addItem("Edit Selected Mermaid Diagram", "editSelectedMermaidImage")
    .addSeparator()
    .addItem("Convert All Code to Diagrams", "scanAndRender")
    .addItem("Convert Selected Code to Diagram", "convertSelectedCodeToDiagram")
    .addItem("Register Diagram Sources", "registerDiagramSources")
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
}

export function openEditor(): void {
  openEditorForImage("", -1);
}

export function scanAndRender(): void {
  showPreviewDialog(null);
}

export function renderSelection(): void {
  const snippet = tryGetMermaidSnippetForPreview();
  if (snippet) showPreviewDialog([snippet]);
}

export function convertSelectedCodeToDiagram(): void {
  const snippet = tryGetMermaidSnippetForConvert();
  if (!snippet) return;
  openConvertDialog(snippet.definition, snippet.startIdx, snippet.endIdx);
}

/**
 * Adopt diagrams that were authored by another tool.
 *
 * Tools that drive Google Docs over the REST APIs (gws, gog) can write
 * paragraphs but cannot write an InlineImage's alt text, so they leave the
 * Mermaid source in a ```mermaid fence beside the rendered image. This walks
 * the document, moves each such source into the image alt text, and drops the
 * fence, after which the diagram behaves like one this add-on inserted.
 */
export function registerDiagramSources(): void {
  const { baked } = bakeAllFenceSources();
  const ui = DocumentApp.getUi();

  if (baked === 0) {
    ui.alert(
      "No markdown-fenced diagrams found.\n\n" +
        "A diagram is registered when a ```mermaid block sits immediately " +
        "before or after an image.",
    );
    return;
  }

  ui.alert(
    "Registered " +
      baked +
      (baked === 1 ? " diagram." : " diagrams.") +
      "\n\nThe Mermaid source now lives in the image alt text and the markdown " +
      "fence is gone. Edit All Mermaid Diagrams, Convert Diagram to Code and " +
      "Export as Markdown all work on it now.",
  );
}

export function editSelectedMermaidImage(): void {
  const image = tryGetSelectedMermaidImage();
  if (image) openEditorForImage(image.source, image.childIndex);
}

export function openEditDiagrams(): void {
  openEditDiagramsDialog();
}

export function extractMermaidFromImages(): void {
  openExtractDialog(null);
}

export function convertSelectedImageToCode(): void {
  const image = tryGetSelectedMermaidImage();
  if (image) openDiagramToCodeDialog(image.source, image.childIndex);
}

export function openEditorWithSource(source: string): void {
  openEditorForImage(source, -1);
}

export function openImportMarkdown(): void {
  openSimpleHtmlDialog("ImportMarkdown", 1000, 700, "Import from Markdown");
}

export function openExportMarkdown(): void {
  openSimpleHtmlDialog("ExportMarkdown", 900, 600, "Export as Markdown");
}

export function openFixMarkdown(): void {
  openSimpleHtmlDialog(
    "FixMarkdown",
    900,
    600,
    'Fix Native "Copy as Markdown"',
  );
}

export function showQuickGuide(): void {
  openSimpleHtmlDialog("QuickGuide", 560, 460, "Quick Guide");
}

export function openDevTools(): void {
  openSimpleHtmlDialog("DevTools", 400, 320, "Dev Tools");
}

export function showAbout(): void {
  openSimpleHtmlDialog("About", 320, 280, "About");
}

// Dialog RPC — must be exported here so esbuild includes them in Code.gs
export {
  batchInsertCodeBlocks,
  batchInsertDiagrams,
  batchReplaceDiagrams,
  batchReplaceWithCodeBlocks,
  insertCodeBlockAfterImage,
  insertDiagramAfterText,
  insertImageAtCursor,
  replaceDiagramText,
  replaceImageInPlace,
  replaceImageWithCodeBlock,
} from "./diagram-ops";

export { getDocumentInfoData, openDocumentInfo } from "./doc-info";

export { getExportMarkdown } from "./export-md";

export { getMermaidImagesForDialog } from "./images";

export { importMarkdownAtCursor, importMarkdownReplace } from "./import-md";

export { debugDocStructure, getInspectorData } from "./inspector";

export { getMermaidSnippetsForPreview } from "./snippets";
