import type { StepContext } from "../helpers";
import {
  sleep,
  poll,
  injectCursor,
  setCursor,
  setLastPos,
  openMenuItemDirect,
  isDialogOpen,
  dismissGasAlert,
  imageToolbarVisible,
  cleanBetween,
} from "../helpers";

/**
 * Convert Selected Diagram to Code — clicks a diagram, opens the menu item,
 * and watches the loading dialog auto-close as the diagram is replaced with
 * a fenced mermaid code block.
 *
 * Prerequisite: the document must have at least one Mermaid diagram visible
 * in the viewport (e.g. after step 01 insert).
 */
export const step04DiagramToCodeForOne = async (
  ctx: StepContext,
): Promise<void> => {
  const { page, shot } = ctx;
  console.log("\n[04] Convert Selected Diagram to Code");

  await injectCursor(page);
  await page.keyboard.press("Meta+ArrowUp");
  await sleep(400);
  await page.mouse.click(470, 165);
  await sleep(250);

  const attempts = [
    { x: 620, y: 300 },
    { x: 620, y: 320 },
    { x: 620, y: 280 },
    { x: 500, y: 300 },
  ];
  let selected = false;
  for (const a of attempts) {
    await page.mouse.move(a.x, a.y, { steps: 8 });
    await setCursor(page, a.x, a.y);
    await sleep(120);
    await page.mouse.click(a.x, a.y);
    await sleep(700);
    if (await imageToolbarVisible(page)) {
      selected = true;
      setLastPos(a.x, a.y);
      console.log(`   Selected image at (${a.x}, ${a.y})`);
      break;
    }
  }
  if (!selected) {
    console.log("   ⚠ Could not select a diagram image");
    await cleanBetween(page);
    return;
  }

  await shot("04-diagram-selected");
  await sleep(500);

  const opened = await openMenuItemDirect(
    page,
    "Convert Selected Diagram to Code",
  );
  if (!opened) {
    console.log("   ⚠ Could not open Convert Selected Diagram to Code");
    await cleanBetween(page);
    return;
  }

  const gasAlertBtn = page.locator('[role="button"]:has-text("OK")').first();
  await poll(
    async () =>
      (await isDialogOpen(page)) ||
      (await gasAlertBtn.isVisible({ timeout: 200 }).catch(() => false)),
    8000,
  );
  if (await dismissGasAlert(page)) {
    console.log("   ⚠ Got 'not a Mermaid diagram' alert — skipping");
    await cleanBetween(page);
    return;
  }

  console.log("   Loading dialog opened, waiting for auto-close...");
  const closed = await poll(async () => !(await isDialogOpen(page)), 15000);
  if (!closed) {
    console.log("   ⚠ DiagramToCode dialog did not auto-close");
  } else {
    console.log("   ✓ Diagram converted to code block");
  }

  await sleep(1500);
  await shot("04-after-diagram-to-code");
  await cleanBetween(page);
};
