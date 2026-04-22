import type { StepContext } from "../helpers";
import { sleep, openMenuItem, enterDialog, closeFrameDialog } from "../helpers";

export const step12DevTools = async (ctx: StepContext): Promise<void> => {
  const { page, shot } = ctx;
  console.log("\n[12] Dev Tools");

  await openMenuItem(page, "Dev Tools");
  const d = await enterDialog(page, (f) =>
    f
      .locator("#btn-inspector")
      .count()
      .then((c) => c > 0),
  );
  if (d) {
    const browseDevToolsCards = async (
      frameCtx: typeof d,
      shotLabel: string,
    ): Promise<{
      inspectorBtn: ReturnType<typeof d.iframe.locator>;
      docInfoBtn: ReturnType<typeof d.iframe.locator>;
    }> => {
      const { iframe: toolsFrame } = frameCtx;
      await sleep(1100);
      const inspectorBtn = toolsFrame.locator("#btn-inspector");
      const docInfoBtn = toolsFrame.locator("#btn-doc-info");
      await shot(shotLabel);
      return { inspectorBtn, docInfoBtn };
    };

    const firstBrowse = await browseDevToolsCards(
      d,
      "26-devtools-cards-inspector",
    );
    console.log("   Clicking Inspector...");
    await d.iClick(firstBrowse.inspectorBtn);

    const inspCtx = await enterDialog(page, (f) =>
      f.evaluate(() => {
        const tc = document.getElementById("tc-docapp");
        return tc && tc.innerHTML.length > 50;
      }),
    );
    if (inspCtx) {
      const {
        iframe: inspFrame,
        iGlide: inspGlide,
        iClick: inspClick,
      } = inspCtx;
      console.log("   Inspector opened");
      await sleep(600);

      const bodyPane = inspFrame.locator("#tc-docapp");
      const bpBox = await bodyPane.boundingBox().catch(() => null);
      if (bpBox) {
        await inspGlide(bpBox.x + bpBox.width / 2, bpBox.y + 60, 14);
        await sleep(400);
        await inspGlide(
          bpBox.x + bpBox.width / 2,
          bpBox.y + bpBox.height * 0.4,
          16,
        );
        await sleep(400);
      }

      const copyBtn = inspFrame.locator("#copy-btn");
      if (await copyBtn.isVisible().catch(() => false)) {
        console.log("   Clicking Copy as Markdown...");
        await inspClick(copyBtn, 16);
        await sleep(500);
      }
      await shot("27-inspector");
      await closeFrameDialog(inspFrame, page, "Inspector dialog");
    }

    console.log("   Re-opening Dev Tools for Document Info...");
    await openMenuItem(page, "Dev Tools");
    const docInfoDialog = await enterDialog(page, (f) =>
      f
        .locator("#btn-doc-info")
        .count()
        .then((c) => c > 0),
    );
    if (!docInfoDialog)
      throw new Error("Could not reopen Dev Tools for Document Info.");
    const secondBrowse = await browseDevToolsCards(
      docInfoDialog,
      "28-devtools-cards-docinfo",
    );
    console.log("   Clicking Document Info...");
    await docInfoDialog.iClick(secondBrowse.docInfoBtn);

    const diCtx = await enterDialog(page, (f) =>
      f.evaluate(() => {
        const t = document.getElementById("info-table");
        return t && t.innerHTML.length > 50;
      }),
    );
    if (diCtx) {
      const { iframe: diFrame, iGlide: diGlide, iClick: diClick } = diCtx;
      console.log("   Document Info opened");
      await sleep(400);

      const table = diFrame.locator("#info-table");
      const tBox = await table.boundingBox().catch(() => null);
      if (tBox) {
        await diGlide(tBox.x + tBox.width / 2, tBox.y + 40, 12);
        await sleep(400);
        await diGlide(tBox.x + tBox.width / 2, tBox.y + tBox.height * 0.6, 14);
        await sleep(400);
      }

      const copyBtn = diFrame.locator("#copy-btn");
      if (await copyBtn.isVisible().catch(() => false)) {
        console.log("   Clicking Copy...");
        await diClick(copyBtn, 16);
        await sleep(600);
      }
      await shot("29-docinfo");
      await closeFrameDialog(diFrame, page, "Document Info dialog");
    }
  }
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(250);
};
