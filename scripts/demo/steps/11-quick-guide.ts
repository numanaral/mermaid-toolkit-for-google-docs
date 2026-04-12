import type { StepContext } from "../helpers";
import {
  sleep,
  openMenuItem,
  enterDialog,
  closeDialog,
  cleanBetween,
} from "../helpers";

export const step11QuickGuide = async (ctx: StepContext): Promise<void> => {
  const { page, shot } = ctx;
  console.log("\n[11] Quick Guide");
  await openMenuItem(page, "Quick Guide");
  const d = await enterDialog(page, (f) =>
    f.evaluate(() => document.body && document.body.innerText.length > 50),
  );
  if (d) {
    const { iframe, iGlide } = d;
    await sleep(300);

    const cards = iframe.locator(".action-card");
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const cBox = await card.boundingBox().catch(() => null);
      if (cBox) {
        await iGlide(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2, 10);
        await sleep(300);
      }
    }

    const seeAll = iframe.locator('a:has-text("See all features")');
    const saBox = await seeAll.boundingBox().catch(() => null);
    if (saBox) {
      await iGlide(saBox.x + saBox.width / 2, saBox.y + saBox.height / 2, 12);
      await sleep(400);
    }
    await shot("25-quickguide");

    await closeDialog(page);
  }
  await cleanBetween(page);
};
