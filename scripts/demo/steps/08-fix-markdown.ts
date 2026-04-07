import type { StepContext } from "../helpers";
import {
  sleep, poll,
  openMenuItem, enterDialog, closeDialog, cleanBetween,
  BROKEN_MARKDOWN,
} from "../helpers";

export const step08FixMarkdown = async (ctx: StepContext): Promise<void> => {
  const { page, shot } = ctx;
  console.log('\n[08] Fix Native "Copy as Markdown"');
  await openMenuItem(page, 'Fix Native "Copy as Markdown"');
  const d = await enterDialog(page, (f) => f.locator("#input").isVisible());
  if (d) {
    const { iframe, iClick } = d;
    await sleep(300);

    console.log("   Clicking input...");
    await iClick(iframe.locator("#input"));
    await sleep(200);

    console.log("   Pasting broken markdown...");
    await iframe.locator("#input").fill(BROKEN_MARKDOWN);
    await poll(() => iframe.locator("text=Fixed").count().then((c) => c > 0).catch(() => false), 10000);
    await sleep(800);

    const fixedTab = iframe.locator('button.tab:has-text("Fixed")');
    if (await fixedTab.isVisible().catch(() => false)) {
      await iClick(fixedTab);
      await sleep(600);
    }

    console.log("   Switching to Diff...");
    const diffTab = iframe.locator('button.tab:has-text("Diff")');
    if (await diffTab.isVisible().catch(() => false)) {
      await iClick(diffTab);
      await sleep(800);
    }
    await shot("24-fixmarkdown-diff");

    const copyBtn = iframe.locator('button:has-text("Copy")').first();
    if (await copyBtn.isVisible().catch(() => false)) {
      console.log("   Clicking Copy...");
      await iClick(copyBtn);
      await sleep(500);
    }

    await closeDialog(page);
  }
  await cleanBetween(page);
};
