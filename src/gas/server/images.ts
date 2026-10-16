import { MERMAID_ALT_TITLE } from "./constants";
import {
  readFenceBlockAt,
  resolveMermaidSourceFromAlt,
  setMermaidAlt,
} from "./doc-utils";
import type { MermaidImage } from "./types";
import { timeServer } from "./server-perf";

/**
 * Find the ```mermaid fence that belongs to the image at `childIndex`.
 *
 * The fence is expected immediately after the image, but a fence immediately
 * before it is accepted too.
 */
export const findCompanionFence = (
  body: GoogleAppsScript.Document.Body,
  childIndex: number,
): { definition: string; startIdx: number; endIdx: number } | null => {
  const n = body.getNumChildren();

  if (childIndex + 1 < n) {
    const after = readFenceBlockAt(body, childIndex + 1);
    if (after) return { ...after, startIdx: childIndex + 1 };
  }

  if (childIndex - 1 >= 0) {
    const before = readFenceBlockAt(body, childIndex - 1);
    if (before) return { ...before, startIdx: childIndex - 1 };
  }

  return null;
};

/**
 * Resolve one inline image to a diagram.
 *
 * The alt text is this add-on's native store and always wins. When it is absent
 * we fall back to a Markdown fence sitting beside the image, because tools that
 * drive Google Docs through the REST APIs (gws, gog) can insert paragraphs but
 * cannot write an InlineImage's alt text. A diagram resolved this way carries
 * `fence` and is promoted to the native form by `bakeMermaidImage`.
 */
const resolveImage = (
  body: GoogleAppsScript.Document.Body,
  image: GoogleAppsScript.Document.InlineImage,
  childIndex: number,
): MermaidImage | null => {
  if (image.getAltTitle() === MERMAID_ALT_TITLE) {
    const source = resolveMermaidSourceFromAlt(image.getAltDescription());
    if (source) return { source, childIndex };
  }

  const fence = findCompanionFence(body, childIndex);
  if (!fence) return null;

  return {
    source: fence.definition,
    childIndex,
    fence: { startIdx: fence.startIdx, endIdx: fence.endIdx },
  };
};

/** Body child index of an inline image, whether it is top-level or nested. */
const indexOfImage = (
  image: GoogleAppsScript.Document.InlineImage,
  body: GoogleAppsScript.Document.Body,
): number => {
  const parent = image.getParent();
  return parent.getType() === DocumentApp.ElementType.BODY_SECTION
    ? body.getChildIndex(image)
    : body.getChildIndex(parent);
};

const findMermaidImageElement = (
  el: GoogleAppsScript.Document.Element,
  body: GoogleAppsScript.Document.Body,
): {
  image: GoogleAppsScript.Document.InlineImage;
  mermaid: MermaidImage;
} | null => {
  if (el.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
    const image = el.asInlineImage();
    const mermaid = resolveImage(body, image, indexOfImage(image, body));
    return mermaid ? { image, mermaid } : null;
  }

  try {
    const container = el as GoogleAppsScript.Document.ContainerElement;
    const n = container.getNumChildren();
    for (let j = 0; j < n; j++) {
      const found = findMermaidImageElement(container.getChild(j), body);
      if (found) return found;
    }
  } catch {
    /* not a container element */
  }

  return null;
};

export const findMermaidImages = (): MermaidImage[] => {
  const body = DocumentApp.getActiveDocument().getBody();
  const n = body.getNumChildren();
  const results: MermaidImage[] = [];

  for (let i = 0; i < n; i++) {
    const child = body.getChild(i);
    const type = child.getType();

    if (type === DocumentApp.ElementType.INLINE_IMAGE) {
      const mermaid = resolveImage(body, child.asInlineImage(), i);
      if (mermaid) results.push(mermaid);
      continue;
    }

    if (type !== DocumentApp.ElementType.PARAGRAPH) continue;

    const para = child.asParagraph();
    const nc = para.getNumChildren();
    for (let j = 0; j < nc; j++) {
      const pc = para.getChild(j);
      if (pc.getType() !== DocumentApp.ElementType.INLINE_IMAGE) continue;

      const mermaid = resolveImage(body, pc.asInlineImage(), i);
      if (mermaid) results.push(mermaid);
    }
  }

  return results;
};

export const findMermaidImageIn = (
  el: GoogleAppsScript.Document.Element,
  body: GoogleAppsScript.Document.Body,
): MermaidImage | null => {
  return findMermaidImageElement(el, body)?.mermaid ?? null;
};

/** The first inline image in a body child, top-level or inside a paragraph. */
const imageAt = (
  body: GoogleAppsScript.Document.Body,
  childIndex: number,
): GoogleAppsScript.Document.InlineImage | null => {
  if (childIndex < 0 || childIndex >= body.getNumChildren()) return null;

  const child = body.getChild(childIndex);
  if (child.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
    return child.asInlineImage();
  }
  if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) return null;

  const para = child.asParagraph();
  for (let j = 0; j < para.getNumChildren(); j++) {
    const pc = para.getChild(j);
    if (pc.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      return pc.asInlineImage();
    }
  }

  return null;
};

/**
 * Promote a fence-carried diagram to the native form: write the source into the
 * alt text and drop the fence. Diagrams that already came from alt text are
 * left alone, so this is safe to call on any resolved diagram.
 */
export const bakeMermaidImage = (
  image: GoogleAppsScript.Document.InlineImage,
  mermaid: MermaidImage,
): void => {
  setMermaidAlt(image, mermaid.source);
  if (!mermaid.fence) return;

  const body = DocumentApp.getActiveDocument().getBody();

  // Delete from the bottom up so the remaining indices stay valid.
  for (let i = mermaid.fence.endIdx; i >= mermaid.fence.startIdx; i--) {
    try {
      body.getChild(i).removeFromParent();
    } catch {
      /* the fence was already removed */
    }
  }
};

/**
 * Bake every fence-carried diagram in the document.
 *
 * The document is re-scanned after each bake because removing a fence shifts
 * the body child indices of everything below it.
 */
export const bakeAllFenceSources = (): { baked: number } => {
  const body = DocumentApp.getActiveDocument().getBody();
  let baked = 0;

  for (let guard = 0; guard < 500; guard++) {
    const next = findMermaidImages().find((m) => m.fence);
    if (!next || !next.fence) break;

    const image = imageAt(body, next.childIndex);
    if (!image) break;

    bakeMermaidImage(image, next);
    baked++;
  }

  return { baked };
};

/** Called from Extract / Edit Diagrams dialogs via google.script.run */
export function getMermaidImagesForDialog(): MermaidImage[] {
  return timeServer("scan:mermaid-images", () => findMermaidImages());
}

const NOT_A_DIAGRAM_MSG =
  "Selection is not a Mermaid diagram.\n\n" +
  "This add-on recognises diagrams inserted by itself, and images paired with " +
  "a ```mermaid fence.";

/** Current selection → mermaid diagram metadata, or null after user alert. */
export function tryGetSelectedMermaidImage(): MermaidImage | null {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    DocumentApp.getUi().alert(
      "No diagram selected.\n\n" +
        "Click on a Mermaid diagram to select it, then try again.",
    );
    return null;
  }

  const body = doc.getBody();
  for (const re of selection.getRangeElements()) {
    const found = findMermaidImageElement(re.getElement(), body);
    if (!found) continue;

    const { image, mermaid } = found;

    if (mermaid.fence) {
      bakeMermaidImage(image, mermaid);
      // A fence above the image shifts its index, so read it back afterwards.
      return { ...mermaid, childIndex: indexOfImage(image, body) };
    }

    return mermaid;
  }

  DocumentApp.getUi().alert(NOT_A_DIAGRAM_MSG);
  return null;
}
