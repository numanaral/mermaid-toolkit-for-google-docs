import type { MermaidSnippet } from "./types";
import {
  readFenceBlockAt,
  tryExtractFencedMermaid,
  tryExtractMermaidFromBlock,
} from "./doc-utils";
import { timeServer } from "./server-perf";

/** True when a body child is, or contains, an inline image. */
const hasInlineImage = (child: GoogleAppsScript.Document.Element): boolean => {
  if (child.getType() === DocumentApp.ElementType.INLINE_IMAGE) return true;
  if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) return false;

  const para = child.asParagraph();
  for (let j = 0; j < para.getNumChildren(); j++) {
    if (para.getChild(j).getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      return true;
    }
  }
  return false;
};

const hasInlineImageAt = (
  body: GoogleAppsScript.Document.Body,
  index: number,
): boolean => {
  if (index < 0 || index >= body.getNumChildren()) return false;
  return hasInlineImage(body.getChild(index));
};

export const findMermaidSnippets = (): MermaidSnippet[] => {
  const body = DocumentApp.getActiveDocument().getBody();
  const n = body.getNumChildren();
  const results: MermaidSnippet[] = [];

  for (let i = 0; i < n; i++) {
    const child = body.getChild(i);
    const type = child.getType();

    // Native Google Docs code block (element type stringifies to "CODE_SNIPPET")
    // or any other non-standard block element that reads as Mermaid source.
    if (
      type !== DocumentApp.ElementType.TABLE &&
      type !== DocumentApp.ElementType.PARAGRAPH &&
      type !== DocumentApp.ElementType.LIST_ITEM
    ) {
      const def = tryExtractMermaidFromBlock(child);
      if (def) results.push({ definition: def, startIdx: i, endIdx: i });
      continue;
    }

    if (type === DocumentApp.ElementType.TABLE) {
      try {
        const tbl = child.asTable();
        if (tbl.getNumRows() !== 1) continue;
        const row = tbl.getRow(0);
        if (row.getNumCells() !== 1) continue;

        const cellText = row.getCell(0).editAsText().getText();
        const def = tryExtractFencedMermaid(cellText);
        if (def) {
          results.push({ definition: def, startIdx: i, endIdx: i });
        }
      } catch {
        /* skip malformed tables */
      }
      continue;
    }

    if (type !== DocumentApp.ElementType.PARAGRAPH) continue;

    // Paragraph-only fenced block: one paragraph for the opening fence, one per
    // source line, then a closing ``` paragraph.
    const fenced = readFenceBlockAt(body, i);
    if (fenced) {
      // A fence beside an image is that image's source carrier, not a snippet to
      // render. "Register Diagram Sources" adopts it; rendering it here would
      // produce a second image next to the one it belongs to.
      if (
        hasInlineImageAt(body, i - 1) ||
        hasInlineImageAt(body, fenced.endIdx + 1)
      ) {
        i = fenced.endIdx;
        continue;
      }

      results.push({
        definition: fenced.definition,
        startIdx: i,
        endIdx: fenced.endIdx,
      });
      i = fenced.endIdx;
      continue;
    }
  }

  return results;
};

/** Called from Preview dialog via google.script.run */
export function getMermaidSnippetsForPreview(): MermaidSnippet[] {
  return timeServer("scan:mermaid-snippets", () => findMermaidSnippets());
}
