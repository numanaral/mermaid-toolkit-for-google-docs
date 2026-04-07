import { appendCodeBlock, encodeMermaidSource } from "./doc-utils";
import { MERMAID_ALT_TITLE } from "./constants";
import { getActiveBody, getTabContent } from "./tab-utils";

interface Seg {
  t: string;
  b?: boolean;
  i?: boolean;
  s?: boolean;
  c?: boolean;
  l?: string;
}

interface ImportListItem {
  text: Seg[];
  checked?: boolean;
  children?: ImportListItem[];
}

interface ImportElement {
  type: "heading" | "paragraph" | "code" | "image" | "list" | "table" | "hr";
  content: Seg[];
  level?: number;
  base64?: string;
  mermaidSource?: string;
  ordered?: boolean;
  rows?: Seg[][][];
  items?: ImportListItem[];
}

const applySegments = (
  text: GoogleAppsScript.Document.Text,
  segs: Seg[],
): void => {
  const plain = segs.map((s) => s.t).join("");
  if (!plain) {
    text.setText("");
    return;
  }

  text.setText(plain);

  let pos = 0;
  for (const seg of segs) {
    if (!seg.t) continue;
    const end = pos + seg.t.length - 1;
    if (seg.b) text.setBold(pos, end, true);
    if (seg.i) text.setItalic(pos, end, true);
    if (seg.s) text.setStrikethrough(pos, end, true);
    if (seg.c) {
      text.setFontFamily(pos, end, "Roboto Mono");
      text.setBackgroundColor(pos, end, "#f3f4f6");
      text.setForegroundColor(pos, end, "#d63384");
    }
    if (seg.l) {
      text.setLinkUrl(pos, end, seg.l);
      text.setForegroundColor(pos, end, "#1a73e8");
      text.setUnderline(pos, end, true);
    }
    pos += seg.t.length;
  }
};

const pendingChecklists: { contentIdx: number; depth: number }[] = [];
let pendingTabId = "";
let pendingIsFirstTab = true;

const hasAnyChecklist = (items: ImportListItem[]): boolean => {
  for (const item of items) {
    if (item.checked !== undefined) return true;
    if (item.children && hasAnyChecklist(item.children)) return true;
  }
  return false;
};

const appendChecklistAsParagraphs = (
  body: GoogleAppsScript.Document.Body,
  items: ImportListItem[],
  depth: number,
): void => {
  for (const item of items) {
    const para = body.appendParagraph("");
    applySegments(para.editAsText(), item.text);
    if (depth > 0) {
      para.setIndentStart(36 * depth);
      para.setIndentFirstLine(36 * depth);
    }
    if (item.checked !== undefined) {
      const idx = body.getChildIndex(para);
      pendingChecklists.push({ contentIdx: idx + 1, depth });
    }
    if (item.children && item.children.length > 0) {
      appendChecklistAsParagraphs(body, item.children, depth + 1);
    }
  }
};

const appendListItems = (
  body: GoogleAppsScript.Document.Body,
  items: ImportListItem[],
  depth: number,
  ordered: boolean,
  anchorItem: GoogleAppsScript.Document.ListItem | null,
): GoogleAppsScript.Document.ListItem => {
  const glyph = ordered
    ? DocumentApp.GlyphType.NUMBER
    : DocumentApp.GlyphType.BULLET;

  for (const item of items) {
    const li = body.appendListItem("");
    li.setNestingLevel(depth);
    li.setGlyphType(glyph);

    if (anchorItem) {
      li.setListId(anchorItem);
    }
    if (!anchorItem) {
      anchorItem = li;
    }

    applySegments(li.editAsText(), item.text);

    if (item.children && item.children.length > 0) {
      anchorItem = appendListItems(
        body,
        item.children,
        depth + 1,
        ordered,
        anchorItem,
      );
    }
  }

  return anchorItem!;
};

const applyChecklists = (): void => {
  if (pendingChecklists.length === 0) return;

  if (typeof Docs === "undefined" || !Docs?.Documents) {
    pendingChecklists.length = 0;
    return;
  }

  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();

  doc.saveAndClose();

  const content = getTabContent(docId, pendingTabId, pendingIsFirstTab);
  if (!content) {
    pendingChecklists.length = 0;
    return;
  }

  const checkboxRequests: object[] = [];
  const indentRequests: object[] = [];
  const tabRange = pendingTabId ? { tabId: pendingTabId } : {};

  for (const item of pendingChecklists) {
    const block = content[item.contentIdx];
    if (!block || !block.paragraph || block.startIndex == null) continue;
    const range = {
      startIndex: block.startIndex,
      endIndex: block.endIndex,
      ...tabRange,
    };
    checkboxRequests.push({
      createParagraphBullets: {
        bulletPreset: "BULLET_CHECKBOX",
        range,
      },
    });
    if (item.depth > 0) {
      const indent = 36 * item.depth;
      indentRequests.push({
        updateParagraphStyle: {
          paragraphStyle: {
            indentStart: { magnitude: indent, unit: "PT" },
            indentFirstLine: { magnitude: indent, unit: "PT" },
          },
          fields: "indentStart,indentFirstLine",
          range,
        },
      });
    }
  }

  if (checkboxRequests.length > 0) {
    try {
      Docs.Documents.batchUpdate(
        {
          requests: checkboxRequests,
        } as GoogleAppsScript.Docs.Schema.BatchUpdateDocumentRequest,
        docId,
      );
    } catch {
      // checkbox API call failed; non-fatal
    }
  }

  if (indentRequests.length > 0) {
    try {
      Docs.Documents.batchUpdate(
        {
          requests: indentRequests,
        } as GoogleAppsScript.Docs.Schema.BatchUpdateDocumentRequest,
        docId,
      );
    } catch {
      // indent API call failed; non-fatal
    }
  }

  pendingChecklists.length = 0;
};

const appendElements = (
  body: GoogleAppsScript.Document.Body,
  elements: ImportElement[],
): void => {
  const headingMap: Record<number, GoogleAppsScript.Document.ParagraphHeading> =
    {
      1: DocumentApp.ParagraphHeading.HEADING1,
      2: DocumentApp.ParagraphHeading.HEADING2,
      3: DocumentApp.ParagraphHeading.HEADING3,
      4: DocumentApp.ParagraphHeading.HEADING4,
      5: DocumentApp.ParagraphHeading.HEADING5,
      6: DocumentApp.ParagraphHeading.HEADING6,
    };

  for (const el of elements) {
    switch (el.type) {
      case "heading": {
        const para = body.appendParagraph("");
        para.setHeading(
          headingMap[el.level || 1] || DocumentApp.ParagraphHeading.HEADING1,
        );
        applySegments(para.editAsText(), el.content);
        break;
      }

      case "paragraph": {
        const para = body.appendParagraph("");
        applySegments(para.editAsText(), el.content);
        break;
      }

      case "code": {
        const codeText = el.content.map((s) => s.t).join("");
        appendCodeBlock(body, codeText);
        break;
      }

      case "image": {
        if (el.base64) {
          const blob = Utilities.newBlob(
            Utilities.base64Decode(el.base64),
            "image/png",
            "mermaid-diagram.png",
          );
          const image = body.appendImage(blob);
          if (el.mermaidSource) {
            image.setAltTitle(MERMAID_ALT_TITLE);
            image.setAltDescription(encodeMermaidSource(el.mermaidSource));
          }
        }
        break;
      }

      case "list": {
        if (el.items && el.items.length > 0) {
          if (hasAnyChecklist(el.items)) {
            appendChecklistAsParagraphs(body, el.items, 0);
          } else {
            appendListItems(body, el.items, 0, el.ordered ?? false, null);
          }
        }
        break;
      }

      case "table": {
        if (el.rows && el.rows.length > 0) {
          const emptyRows = el.rows.map((row) => row.map(() => ""));
          const table = body.appendTable(emptyRows);
          for (let r = 0; r < table.getNumRows(); r++) {
            const row = table.getRow(r);
            for (let c = 0; c < row.getNumCells(); c++) {
              const cell = row.getCell(c);
              applySegments(cell.editAsText(), el.rows![r][c]);
              if (r === 0) {
                cell.editAsText().setBold(true);
                cell.setBackgroundColor("#f1f3f4");
              }
            }
          }
          table.setBorderColor("#dadce0");
          table.setBorderWidth(1);
        }
        break;
      }

      case "hr": {
        const para = body.appendParagraph("");
        para.appendHorizontalRule();
        break;
      }
    }
  }
};

export const importMarkdownAtCursor = (
  payloadJson: string,
): { success: boolean } => {
  let elements: ImportElement[];
  try {
    elements = JSON.parse(payloadJson);
  } catch {
    throw new Error("Invalid import payload. Please try again.");
  }
  const doc = DocumentApp.getActiveDocument();
  const { body, tabId, isFirstTab } = getActiveBody(doc);

  pendingChecklists.length = 0;
  pendingTabId = tabId;
  pendingIsFirstTab = isFirstTab;
  appendElements(body, elements);
  applyChecklists();
  return { success: true };
};

export const importMarkdownReplace = (
  payloadJson: string,
): { success: boolean } => {
  let elements: ImportElement[];
  try {
    elements = JSON.parse(payloadJson);
  } catch {
    throw new Error("Invalid import payload. Please try again.");
  }
  const doc = DocumentApp.getActiveDocument();
  const { body, tabId, isFirstTab } = getActiveBody(doc);

  const oldCount = body.getNumChildren();

  pendingChecklists.length = 0;
  pendingTabId = tabId;
  pendingIsFirstTab = isFirstTab;
  appendElements(body, elements);

  let removed = 0;
  for (let n = 0; n < oldCount; n++) {
    if (body.getNumChildren() <= 1) break;
    body.removeChild(body.getChild(0));
    removed++;
  }

  for (const item of pendingChecklists) {
    item.contentIdx -= removed;
  }

  applyChecklists();
  return { success: true };
};
