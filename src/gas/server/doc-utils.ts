import { MERMAID_ALT_TITLE, MERMAID_KEYWORDS } from "./constants";

export const isMermaidFirstLine = (firstLine: string): boolean => {
  const fl = firstLine.trim().toLowerCase();
  return MERMAID_KEYWORDS.some(
    (kw) => fl === kw || fl.startsWith(kw + " ") || fl.startsWith(kw + "-"),
  );
};

export const stripFences = (text: string): string => {
  return text
    .replace(/^```mermaid\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
};

export const getParaText = (
  child: GoogleAppsScript.Document.Element,
): string => {
  try {
    return (child as GoogleAppsScript.Document.Text).editAsText().getText();
  } catch {
    return "";
  }
};

export const tryExtractFencedMermaid = (text: string): string | null => {
  const trimmed = text.trim();
  if (
    !trimmed.startsWith("```mermaid") ||
    !trimmed.endsWith("```") ||
    trimmed === "```mermaid"
  )
    return null;

  const definition = stripFences(trimmed);
  if (!definition) return null;

  const firstLine = definition.split("\n")[0];
  if (!isMermaidFirstLine(firstLine)) return null;

  return definition;
};

export const makeBlob = (
  base64Data: string,
  index: number,
): GoogleAppsScript.Base.Blob => {
  return Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    "image/png",
    "mermaid-diagram-" + index + ".png",
  );
};

export const encodeMermaidSource = (source: string): string => {
  return source.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
};

export const decodeMermaidSource = (encoded: string): string => {
  let result = "";
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === "\\" && i + 1 < encoded.length) {
      const next = encoded[i + 1];
      if (next === "n") {
        result += "\n";
        i++;
        continue;
      }
      if (next === "\\") {
        result += "\\";
        i++;
        continue;
      }
    }
    result += encoded[i];
  }
  return result;
};

export const setMermaidAlt = (
  image: GoogleAppsScript.Document.InlineImage,
  mermaidSource: string,
): void => {
  image.setAltTitle(MERMAID_ALT_TITLE);
  image.setAltDescription(encodeMermaidSource(mermaidSource));
};

const styleCodeTable = (table: GoogleAppsScript.Document.Table): void => {
  const cell = table.getRow(0).getCell(0);
  cell.setBackgroundColor("#f6f8fa");
  cell.setPaddingTop(8);
  cell.setPaddingBottom(8);
  cell.setPaddingLeft(12);
  cell.setPaddingRight(12);
  const text = cell.editAsText();
  text.setFontFamily("Roboto Mono");
  text.setFontSize(10);
  text.setForegroundColor("#24292f");
  table.setBorderColor("#d1d9e0");
  table.setBorderWidth(1);
};

export const appendCodeBlock = (
  body: GoogleAppsScript.Document.Body,
  content: string,
): GoogleAppsScript.Document.Table => {
  const table = body.appendTable([[content]]);
  styleCodeTable(table);
  return table;
};

export const insertFencedCode = (
  body: GoogleAppsScript.Document.Body,
  idx: number,
  source: string,
): GoogleAppsScript.Document.Table => {
  const wrapped = "```mermaid\n" + source + "\n```";
  const table = body.insertTable(idx, [[wrapped]]);
  styleCodeTable(table);
  return table;
};

export const extractSelectedText = (
  selection: GoogleAppsScript.Document.Range,
  body: GoogleAppsScript.Document.Body,
): { text: string; startIdx: number; endIdx: number } => {
  const elements = selection.getRangeElements();
  let selectedText = "";
  let startIdx = -1;
  let endIdx = -1;

  for (const re of elements) {
    const el = re.getElement();

    let para: GoogleAppsScript.Document.Element = el;
    while (
      para.getParent() &&
      para.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION
    ) {
      para = para.getParent();
    }

    try {
      const idx = body.getChildIndex(para);
      if (startIdx === -1 || idx < startIdx) startIdx = idx;
      if (idx > endIdx) endIdx = idx;
    } catch {
      /* element not direct child */
    }

    const asText = el as GoogleAppsScript.Document.Text;
    if (asText.editAsText) {
      const text = asText.editAsText().getText();
      if (re.isPartial()) {
        selectedText += text.substring(
          re.getStartOffset(),
          re.getEndOffsetInclusive() + 1,
        );
      } else {
        selectedText += text;
      }
      selectedText += "\n";
    }
  }

  return { text: stripFences(selectedText), startIdx, endIdx };
};
