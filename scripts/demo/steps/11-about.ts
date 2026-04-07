import type { StepContext } from "../helpers";
import {
  sleep, poll,
  openMenuItem, enterDialog, closeDialog,
} from "../helpers";

export const step11About = async (ctx: StepContext): Promise<void> => {
  const { page, shot } = ctx;
  console.log("\n[11] About");
  await openMenuItem(page, "About");
  const d = await enterDialog(page, (f) =>
    f.locator("text=Mermaid Toolkit").count().then((c) => c > 0),
  );
  if (d) {
    const { iframe, iGlide } = d;
    await poll(() =>
      iframe.evaluate(() => {
        const img = document.getElementById("logo") as HTMLImageElement | null;
        return img && img.complete && img.naturalWidth > 0;
      }).catch(() => false),
    10000);
    await sleep(400);

    const logo = iframe.locator("#logo");
    const logoBox = await logo.boundingBox().catch(() => null);
    if (logoBox) {
      await iGlide(logoBox.x + logoBox.width / 2, logoBox.y + logoBox.height / 2, 14);
      await sleep(400);
    }
    const body = iframe.locator("body");
    const bBox = await body.boundingBox().catch(() => null);
    if (bBox) {
      await iGlide(bBox.x + bBox.width / 2, bBox.y + bBox.height * 0.7, 18);
      await sleep(400);
    }
    await shot("30-about");
    await closeDialog(page);
  }
};
