import type { StepContext } from "../helpers";
import {
  sleep,
  openMenuItem,
  enterDialog,
  closeDialog,
  cleanBetween,
} from "../helpers";

export const step09Export = async (ctx: StepContext): Promise<void> => {
  const { page, shot } = ctx;
  console.log("\n[09] Export as Markdown");
  await openMenuItem(page, "Export as Markdown");
  const d = await enterDialog(page, (f) =>
    f.evaluate(() => {
      const btn = document.getElementById("copy-btn");
      return btn && !(btn as HTMLButtonElement).disabled;
    }),
  );
  if (d) {
    const { iframe, iGlide, iClick } = d;
    console.log("   Export ready");
    await shot("23-export-ready");

    const output = iframe.locator("#output");
    const oBox = await output.boundingBox().catch(() => null);
    if (oBox) {
      await iGlide(oBox.x + oBox.width / 2, oBox.y + 50, 14);
      await sleep(400);
      await iGlide(oBox.x + oBox.width / 2, oBox.y + oBox.height * 0.5, 16);
      await sleep(400);
    }

    const copyBtn = iframe.locator("#copy-btn");
    if (await copyBtn.isEnabled().catch(() => false)) {
      console.log("   Copying to clipboard...");
      await iClick(copyBtn, 16);
      await sleep(500);
    }
    await closeDialog(page);
  }
  await cleanBetween(page);
};
