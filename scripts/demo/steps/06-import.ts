import type { StepContext } from "../helpers";
import {
  sleep,
  poll,
  openMenuItem,
  enterDialog,
  isDialogOpen,
  cleanBetween,
  SAMPLE_MARKDOWN,
} from "../helpers";

const CHUNK_DELAY = 18;
const LINE_DELAY = 60;

const typeMarkdown = async (
  iframe: Awaited<ReturnType<typeof enterDialog>> extends infer D
    ? D extends { iframe: infer F }
      ? F
      : never
    : never,
  text: string,
): Promise<void> => {
  const sourceEl = iframe.locator("#source");
  await sourceEl.focus();

  const lines = text.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const chunks: string[] = [];
    for (let i = 0; i < line.length; i += 6) {
      chunks.push(line.slice(i, i + 6));
    }
    for (const chunk of chunks) {
      await iframe.evaluate(
        ([sel, c]) => {
          const el = document.querySelector(sel) as HTMLTextAreaElement;
          if (!el) return;
          const start = el.selectionStart;
          el.value = el.value.slice(0, start) + c + el.value.slice(start);
          el.selectionStart = el.selectionEnd = start + c.length;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        },
        ["#source", chunk] as const,
      );
      await sleep(CHUNK_DELAY);
    }
    if (li < lines.length - 1) {
      await iframe.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLTextAreaElement;
        if (!el) return;
        const start = el.selectionStart;
        el.value = el.value.slice(0, start) + "\n" + el.value.slice(start);
        el.selectionStart = el.selectionEnd = start + 1;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, "#source");
      await sleep(LINE_DELAY);
    }
  }
};

export const step06Import = async (ctx: StepContext): Promise<void> => {
  const { page, shot } = ctx;
  console.log("\n[06] Import from Markdown");
  await openMenuItem(page, "Import from Markdown");
  const d = await enterDialog(page, (f) => f.locator("#source").isVisible());
  if (d) {
    const { iframe, iGlide, iClick } = d;
    await sleep(300);

    console.log("   Clicking source area...");
    await iClick(iframe.locator("#source"));
    await sleep(200);

    console.log("   Typing markdown...");
    await typeMarkdown(iframe, SAMPLE_MARKDOWN);
    await sleep(500);

    await poll(
      () =>
        iframe
          .locator("#preview-area img, #preview-area svg")
          .first()
          .count()
          .then((c) => c > 0)
          .catch(() => false),
      8000,
    );
    const replaceBtn = iframe.locator("#replace-btn");
    const importReady = await poll(async () => {
      const enabled = await replaceBtn.isEnabled().catch(() => false);
      if (!enabled) return false;
      const statusText = await iframe
        .locator("#status")
        .textContent()
        .catch(() => "");
      return /Ready to import|Preview ready/i.test(statusText || "");
    }, 15000);
    if (!importReady)
      throw new Error("Import from Markdown never became ready to replace.");
    await shot("21-import-preview");
    await sleep(600);

    const pvArea = iframe.locator("#preview-area");
    const pvBox = await pvArea.boundingBox().catch(() => null);
    if (pvBox) {
      console.log("   Viewing preview...");
      await iGlide(pvBox.x + pvBox.width / 2, pvBox.y + 80, 14);
      await sleep(600);
      await iGlide(pvBox.x + pvBox.width / 2, pvBox.y + pvBox.height - 40, 20);
      await sleep(400);
    }

    console.log("   Replacing document...");
    await iClick(replaceBtn, 18);
    const closed = await poll(async () => !(await isDialogOpen(page)), 30000);
    if (!closed)
      throw new Error("Import from Markdown did not close after replace.");
    await sleep(1500);
    await shot("22-after-import");
    console.log("   ✓ Document replaced");
  }
  await cleanBetween(page);
};
