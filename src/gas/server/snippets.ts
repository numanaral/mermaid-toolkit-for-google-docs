import type { MermaidSnippet } from "./types";
import { getParaText, isMermaidFirstLine, tryExtractFencedMermaid } from "./doc-utils";

export const findMermaidSnippets = (): MermaidSnippet[] => {
  const body = DocumentApp.getActiveDocument().getBody();
  const n = body.getNumChildren();
  const results: MermaidSnippet[] = [];

  for (let i = 0; i < n; i++) {
    const child = body.getChild(i);
    const type = child.getType();

    if (type.toString() === "CODE_SNIPPET") {
      const text = getParaText(child);
      if (!text.trim()) continue;

      const firstLine = text.split("\n")[0];
      if (isMermaidFirstLine(firstLine)) {
        results.push({ definition: text.trim(), startIdx: i, endIdx: i });
      }
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

    const text = getParaText(child);
    const trimmed = text.trim();

    const singleDef = tryExtractFencedMermaid(trimmed);
    if (singleDef) {
      results.push({ definition: singleDef, startIdx: i, endIdx: i });
      continue;
    }

    if (trimmed === "```mermaid" || trimmed.startsWith("```mermaid\n")) {
      const lines = [trimmed.replace(/^```mermaid\n?/, "")];
      let endIdx = i;
      let found = false;

      for (let j = i + 1; j < n; j++) {
        const jChild = body.getChild(j);
        if (jChild.getType() !== DocumentApp.ElementType.PARAGRAPH) break;

        const jText = getParaText(jChild).trim();
        if (jText === "```") {
          endIdx = j;
          found = true;
          break;
        }
        lines.push(jText);
      }

      if (!found) continue;

      const definition = lines.join("\n").trim();
      if (!definition) continue;

      const firstLine = definition.split("\n")[0];
      if (isMermaidFirstLine(firstLine)) {
        results.push({ definition, startIdx: i, endIdx });
        i = endIdx;
      }
    }
  }

  return results;
};
