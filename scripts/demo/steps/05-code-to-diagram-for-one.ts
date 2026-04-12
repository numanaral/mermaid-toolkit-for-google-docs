import type { StepContext } from "../helpers";
import {
  sleep,
  poll,
  injectCursor,
  openMenuItemDirect,
  isDialogOpen,
  dismissGasAlert,
  cleanBetween,
} from "../helpers";

/**
 * Convert Selected Code to Diagram — opens the menu item while the cursor
 * is inside a mermaid code table (placed there by the preceding
 * diagram-to-code step), and watches the auto-converting dialog close.
 *
 * Prerequisite: cursor must be inside a mermaid code block table
 * (e.g. after step 04 diagram-to-code-for-one placed it there via setCursor).
 */
export const step05CodeToDiagramForOne = async (
  ctx: StepContext,
): Promise<void> => {
  const { page, shot } = ctx;
  console.log("\n[05] Convert Selected Code to Diagram");

  await injectCursor(page);
  await sleep(300);

  await shot("05-before-convert");

  const opened = await openMenuItemDirect(
    page,
    "Convert Selected Code to Diagram",
  );
  if (!opened) {
    console.log("   ⚠ Could not open Convert Selected Code to Diagram");
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
    console.log("   ⚠ Got 'no mermaid code' alert — cursor not in code block");
    await cleanBetween(page);
    return;
  }

  console.log("   Dialog opened, waiting for auto-close...");
  await shot("05-converting");

  const closed = await poll(async () => !(await isDialogOpen(page)), 30000);
  if (!closed) {
    console.log("   ⚠ Convert Selected dialog did not auto-close");
  } else {
    console.log("   ✓ Diagram replaced");
  }

  await sleep(1500);
  await shot("05-after-convert-selected");
  await cleanBetween(page);
};
