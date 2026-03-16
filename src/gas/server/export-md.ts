import { MERMAID_ALT_TITLE } from "./constants";
import { decodeMermaidSource } from "./doc-utils";

interface CheckboxInfo {
  nestingDepth: number;
}

const textToMarkdown = (text: GoogleAppsScript.Document.Text): string => {
  const raw = text.getText();
  if (!raw) return "";

  const indices = text.getTextAttributeIndices();
  let result = "";

  for (let idx = 0; idx < indices.length; idx++) {
    const start = indices[idx];
    const end = idx + 1 < indices.length ? indices[idx + 1] : raw.length;

    const bold = text.isBold(start) ?? false;
    const italic = text.isItalic(start) ?? false;
    const strikethrough = text.isStrikethrough(start) ?? false;
    const link = text.getLinkUrl(start);
    const font = text.getFontFamily(start);
    const isCode = font === "Roboto Mono" || font === "Courier New";

    let chunk = raw.substring(start, end);

    if (isCode) {
      chunk = "`" + chunk + "`";
    } else {
      if (bold && italic) {
        chunk = "***" + chunk + "***";
      } else if (bold) {
        chunk = "**" + chunk + "**";
      } else if (italic) {
        chunk = "*" + chunk + "*";
      }
      if (strikethrough) {
        chunk = "~~" + chunk + "~~";
      }
    }
    if (link) {
      chunk = "[" + chunk + "](" + link + ")";
    }
    result += chunk;
  }

  return result;
};

const headingLevel = (
  heading: GoogleAppsScript.Document.ParagraphHeading,
): number => {
  switch (heading) {
    case DocumentApp.ParagraphHeading.HEADING1:
      return 1;
    case DocumentApp.ParagraphHeading.HEADING2:
      return 2;
    case DocumentApp.ParagraphHeading.HEADING3:
      return 3;
    case DocumentApp.ParagraphHeading.HEADING4:
      return 4;
    case DocumentApp.ParagraphHeading.HEADING5:
      return 5;
    case DocumentApp.ParagraphHeading.HEADING6:
      return 6;
    default:
      return 0;
  }
};

const buildCheckboxMap = (
  docId: string,
  tabId: string,
): Map<string, CheckboxInfo> => {
  const map = new Map<string, CheckboxInfo>();
  if (typeof Docs === "undefined" || !Docs?.Documents) return map;

  try {
    const bodyFields =
      "body.content(paragraph(bullet(nestingLevel,listId),paragraphStyle(indentStart,indentFirstLine),elements(textRun(content))))";
    const listsFields = "lists";

    interface DocsBlock {
      paragraph?: {
        bullet?: { nestingLevel?: number; listId?: string };
        paragraphStyle?: {
          indentStart?: { magnitude?: number };
          indentFirstLine?: { magnitude?: number };
        };
        elements?: { textRun?: { content?: string } }[];
      };
      sectionBreak?: object;
    }
    interface DocsList {
      [listId: string]: {
        listProperties?: {
          nestingLevels?: {
            glyphSymbol?: string;
            glyphType?: string;
          }[];
        };
      };
    }

    let content: DocsBlock[] | undefined;
    let lists: DocsList | undefined;

    if (!tabId) {
      const raw = Docs.Documents.get(docId, {
        fields: bodyFields + "," + listsFields,
      });
      content = raw?.body?.content as DocsBlock[] | undefined;
      lists = (raw as unknown as { lists?: DocsList })?.lists;
    } else {
      const tabFields =
        "tabs(tabProperties/tabId,documentTab/" +
        bodyFields +
        ",documentTab/" +
        listsFields +
        ")";
      const raw = Docs.Documents.get(docId, {
        includeTabsContent: true,
        fields: tabFields,
      }) as unknown as {
        tabs?: {
          documentTab?: {
            body?: { content?: DocsBlock[] };
            lists?: DocsList;
          };
          tabProperties?: { tabId?: string };
        }[];
      };
      if (raw.tabs) {
        for (const tab of raw.tabs) {
          if (tab.tabProperties?.tabId === tabId) {
            content = tab.documentTab?.body?.content;
            lists = tab.documentTab?.lists;
            break;
          }
        }
      }
    }

    if (!content) return map;

    const checkboxListIds = new Set<string>();
    if (lists) {
      for (const [listId, listDef] of Object.entries(lists)) {
        const levels = listDef.listProperties?.nestingLevels;
        if (levels && levels.length > 0) {
          const l0 = levels[0];
          if (
            l0.glyphSymbol === "☐" ||
            l0.glyphSymbol === "☑" ||
            (l0.glyphType === "GLYPH_TYPE_UNSPECIFIED" && !l0.glyphSymbol)
          ) {
            checkboxListIds.add(listId);
          }
        }
      }
    }

    if (checkboxListIds.size === 0) return map;

    for (const block of content) {
      if (!block.paragraph?.bullet) continue;
      const bullet = block.paragraph.bullet;
      if (!bullet.listId || !checkboxListIds.has(bullet.listId)) continue;

      const plainText = (block.paragraph.elements ?? [])
        .map((e) => e.textRun?.content ?? "")
        .join("")
        .replace(/\n$/, "");

      if (!plainText) continue;

      const ifl =
        block.paragraph.paragraphStyle?.indentFirstLine?.magnitude ?? 18;
      const nestingDepth = ifl <= 18 ? 0 : Math.round((ifl - 18) / 36);

      map.set(plainText, { nestingDepth });
    }
  } catch (e) {
    Logger.log("buildCheckboxMap error: " + e);
  }

  return map;
};

export const exportDocAsMarkdown = (
  body: GoogleAppsScript.Document.Body,
  docId?: string,
  tabId?: string,
): string => {
  const checkboxMap = docId
    ? buildCheckboxMap(docId, tabId ?? "")
    : new Map<string, CheckboxInfo>();

  const n = body.getNumChildren();
  const lines: string[] = [];
  let prevWasListItem = false;

  for (let i = 0; i < n; i++) {
    const child = body.getChild(i);
    const type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      const para = child.asParagraph();
      const heading = para.getHeading();
      const level = headingLevel(heading);

      const numChildren = para.getNumChildren();
      let hasMermaidImage = false;
      let mermaidSource = "";

      for (let c = 0; c < numChildren; c++) {
        const pChild = para.getChild(c);
        if (pChild.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
          const img = pChild.asInlineImage();
          if (img.getAltTitle() === MERMAID_ALT_TITLE) {
            const raw = img.getAltDescription();
            if (raw) {
              hasMermaidImage = true;
              mermaidSource = decodeMermaidSource(raw);
            }
          }
        }
      }

      if (hasMermaidImage && mermaidSource) {
        lines.push("");
        lines.push("```mermaid");
        lines.push(mermaidSource);
        lines.push("```");
        lines.push("");
        prevWasListItem = false;
        continue;
      }

      if (
        para.getNumChildren() === 1 &&
        para.getChild(0).getType() === DocumentApp.ElementType.HORIZONTAL_RULE
      ) {
        lines.push("");
        lines.push("---");
        lines.push("");
        prevWasListItem = false;
        continue;
      }

      const plainText = para.editAsText().getText();
      const cbInfo = checkboxMap.get(plainText);
      if (cbInfo) {
        const md = textToMarkdown(para.editAsText());
        const indent = "  ".repeat(cbInfo.nestingDepth);
        lines.push(`${indent}- [ ] ${md}`);
        prevWasListItem = true;
        continue;
      }

      const md = textToMarkdown(para.editAsText());

      if (level > 0) {
        lines.push("");
        lines.push("#".repeat(level) + " " + md);
        lines.push("");
      } else if (md.trim() === "") {
        lines.push("");
      } else {
        lines.push(md);
      }
      prevWasListItem = false;
      continue;
    }

    if (type === DocumentApp.ElementType.LIST_ITEM) {
      const li = child.asListItem();
      const plainText = li.editAsText().getText();
      const md = textToMarkdown(li.editAsText());
      const glyph = li.getGlyphType();
      const nestLevel = li.getNestingLevel();
      const indent = "  ".repeat(nestLevel);
      const isOrdered =
        glyph === DocumentApp.GlyphType.NUMBER ||
        glyph === DocumentApp.GlyphType.LATIN_UPPER ||
        glyph === DocumentApp.GlyphType.LATIN_LOWER ||
        glyph === DocumentApp.GlyphType.ROMAN_UPPER ||
        glyph === DocumentApp.GlyphType.ROMAN_LOWER;

      const cbInfo = checkboxMap.get(plainText);
      if (cbInfo) {
        const cbIndent = "  ".repeat(cbInfo.nestingDepth);
        lines.push(`${cbIndent}- [ ] ${md}`);
      } else if (md.startsWith("✓ ")) {
        lines.push(`${indent}- [x] ${md.substring(2)}`);
      } else if (md.startsWith("☐ ")) {
        lines.push(`${indent}- [ ] ${md.substring(2)}`);
      } else if (md.startsWith("☑ ")) {
        lines.push(`${indent}- [x] ${md.substring(2)}`);
      } else {
        const prefix = isOrdered ? "1. " : "- ";
        lines.push(indent + prefix + md);
      }
      prevWasListItem = true;
      continue;
    }

    if (prevWasListItem) {
      lines.push("");
      prevWasListItem = false;
    }

    if (type === DocumentApp.ElementType.TABLE) {
      const tbl = child.asTable();
      const rows = tbl.getNumRows();

      if (rows === 1 && tbl.getRow(0).getNumCells() === 1) {
        const cellText = tbl.getRow(0).getCell(0).editAsText().getText();
        const trimmed = cellText.trim();
        if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
          lines.push("");
          lines.push(trimmed);
          lines.push("");
          continue;
        }
        lines.push("");
        lines.push("```");
        lines.push(cellText);
        lines.push("```");
        lines.push("");
        continue;
      }

      lines.push("");
      for (let r = 0; r < rows; r++) {
        const row = tbl.getRow(r);
        const cells: string[] = [];
        for (let c = 0; c < row.getNumCells(); c++) {
          cells.push(textToMarkdown(row.getCell(c).editAsText()));
        }
        lines.push("| " + cells.join(" | ") + " |");
        if (r === 0) {
          lines.push("| " + cells.map(() => "---").join(" | ") + " |");
        }
      }
      lines.push("");
      continue;
    }

    if (type.toString() === "CODE_SNIPPET") {
      const text = child.asText?.() ? child.asText().getText() : "";
      if (!text) continue;
      lines.push("");
      lines.push("```");
      lines.push(text);
      lines.push("```");
      lines.push("");
      continue;
    }

    try {
      const text = (child as GoogleAppsScript.Document.Text)
        .editAsText()
        .getText();
      if (text) lines.push(text);
    } catch {
      /* skip unknown element types */
    }
  }

  return (
    lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
};
