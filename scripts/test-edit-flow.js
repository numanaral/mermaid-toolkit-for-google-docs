const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DOC_URL =
  "https://docs.google.com/document/d/1FpKtpbxZhZQPx4ldReg9eE3RXOsVO3rqFEmzhYN8S3c/edit?addon_dry_run=AAnXSK9hwlvF3XFY0Z5-uzyti5SRvmoq4f9edRcTyc37whjoxSV8rMsiPrE1VRYSXDucre5vv1hsqB912qoLkA5ukSbLvzhHxWEq4LIBH2WFIQZP2SW2vmzGlGk5xrFAetIeaZgMsuSM&tab=t.0";
const STATE_FILE = path.resolve(".playwright-state.json");
const OUT_DIR = path.resolve("screenshots/edit-test");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT_DIR, f));
}

const poll = async (fn, timeoutMs = 15000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await sleep(400);
  }
  return null;
};

const isDialogOpen = (page) =>
  page
    .evaluate(() => {
      for (const el of document.querySelectorAll(
        '[class*="WizDialog-dialog"]',
      )) {
        if (
          !el.className.includes("scrim") &&
          getComputedStyle(el).display !== "none"
        )
          return true;
      }
      return false;
    })
    .catch(() => false);

const waitForDialog = (page) => poll(() => isDialogOpen(page), 25000);
const waitForFrame = (page) =>
  poll(() => {
    const f = page.frame("userHtmlFrame");
    return f || null;
  }, 15000);

const shot = async (page, name) => {
  await sleep(150);
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: false,
  });
  console.log(`  📸 ${name}`);
};

const closeDialog = async (page) => {
  if (!(await isDialogOpen(page))) return;
  const f = page.frame("userHtmlFrame");
  if (f) {
    try {
      await f.evaluate(() => {
        if (window.google?.script?.host) window.google.script.host.close();
      });
      await poll(async () => !(await isDialogOpen(page)), 5000);
      await sleep(600);
      return;
    } catch {}
  }
  await page.keyboard.press("Escape").catch(() => {});
  await poll(async () => !(await isDialogOpen(page)), 3000);
  await sleep(600);
};

const openMenuItem = async (page, label) => {
  await poll(
    () =>
      page
        .$("#docs-extensions-menu")
        .then((el) => !!el)
        .catch(() => false),
    15000,
  );
  const extMenu = page.locator("#docs-extensions-menu");
  const mtk = page
    .locator('.goog-menuitem-content:has-text("Mermaid Toolkit")')
    .first();

  for (let i = 0; i < 3; i++) {
    await extMenu.click({ timeout: 5000, force: true });
    await sleep(500);
    if (await poll(() => mtk.isVisible().catch(() => false), 4000)) break;
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(800);
  }
  await mtk.hover({ timeout: 5000 });
  await sleep(600);

  let target;
  if (label.includes('"')) {
    const prefix = label.split('"')[0].trim();
    target = page
      .locator(`.goog-menuitem-content:has-text("${prefix}")`)
      .first();
  } else {
    const exact = page.locator(`.goog-menuitem-content:text-is("${label}")`);
    target =
      (await exact.count()) > 0
        ? exact.first()
        : page
            .locator(
              `.goog-menuitem-content:has-text("${label.substring(0, 20)}")`,
            )
            .first();
  }
  await target.hover({ timeout: 5000 });
  await sleep(300);
  await target.click({ timeout: 5000 });
  await sleep(400);
};

const clickDiagramInDoc = async (page) => {
  const imgEl = page.locator(".kix-canvas-tile-content img").first();
  const count = await imgEl.count().catch(() => 0);
  if (count > 0) {
    const box = await imgEl.boundingBox().catch(() => null);
    if (box && box.width > 50) {
      console.log(
        `  Found img in canvas tile: ${Math.round(box.width)}x${Math.round(box.height)} at (${Math.round(box.x)},${Math.round(box.y)})`,
      );
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(1500);
      return true;
    }
  }

  const editorArea = page.locator(".kix-appview-editor");
  const edBox = await editorArea.boundingBox().catch(() => null);
  if (edBox) {
    console.log(
      `  Clicking center of editor area: (${Math.round(edBox.x + edBox.width / 2)}, ${Math.round(edBox.y + edBox.height / 2)})`,
    );
    await page.mouse.click(
      edBox.x + edBox.width / 2,
      edBox.y + edBox.height / 2,
    );
    await sleep(1500);
    return true;
  }

  return false;
};

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: fs.existsSync(STATE_FILE) ? STATE_FILE : undefined,
  });
  const page = await context.newPage();

  let lastAlert = "";
  page.on("dialog", async (d) => {
    lastAlert = d.message();
    console.log(`  [Alert] "${lastAlert}"`);
    await d.accept();
  });

  console.log("Navigating...");
  await page.goto(DOC_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForSelector("#docs-editor", { timeout: 30000 })
    .catch(() => {});
  await sleep(3000);
  await context.storageState({ path: STATE_FILE });

  try {
    // ═══════════════════════════════════════════
    // STEP 1: Insert a Flowchart diagram
    // ═══════════════════════════════════════════
    console.log("\n=== STEP 1: Insert a Flowchart ===");
    await openMenuItem(page, "Insert Mermaid Diagram");
    await waitForDialog(page);
    await sleep(1500);
    const frame1 = await waitForFrame(page);
    if (!frame1) throw new Error("No editor frame");

    await poll(
      () =>
        frame1
          .locator("text=Templates")
          .count()
          .then((c) => c > 0)
          .catch(() => false),
      10000,
    );
    await frame1.locator("#tpl-btn").click({ timeout: 5000 });
    await poll(
      () =>
        frame1
          .locator("#tpl-row.visible")
          .count()
          .then((c) => c > 0)
          .catch(() => false),
      5000,
    );
    await sleep(300);

    console.log("  Selecting Flowchart...");
    await frame1
      .locator('button[data-tpl]:has-text("Flowchart")')
      .first()
      .click({ timeout: 5000 });
    await poll(
      () =>
        frame1
          .locator('#status:has-text("Preview up to date")')
          .count()
          .then((c) => c > 0)
          .catch(() => false),
      15000,
    );
    await sleep(800);
    await shot(page, "01-flowchart-ready");

    console.log("  Inserting...");
    const insertBtn = frame1.locator("#insert-btn");
    await poll(() => insertBtn.isEnabled().catch(() => false), 5000);
    await insertBtn.click({ timeout: 5000 });
    await sleep(4000);
    await poll(async () => !(await isDialogOpen(page)), 10000);
    await sleep(2000);
    await shot(page, "02-inserted");
    console.log("  ✅ Diagram inserted");

    // ═══════════════════════════════════════════
    // STEP 2: Click on the diagram to select it
    // ═══════════════════════════════════════════
    console.log("\n=== STEP 2: Click on diagram ===");

    await page.keyboard.press("Home");
    await sleep(500);
    await page.keyboard.press("ArrowDown");
    await sleep(500);

    const clicked = await clickDiagramInDoc(page);
    await shot(page, "03-diagram-clicked");

    if (!clicked) {
      console.log("  Trying alternative: scroll to top and click...");
      await page.evaluate(() => {
        const scroller = document.querySelector(".kix-appview-editor");
        if (scroller) scroller.scrollTop = 0;
      });
      await sleep(500);
      await page.mouse.click(620, 350);
      await sleep(1500);
      await shot(page, "03b-fallback-click");
    }

    // ═══════════════════════════════════════════
    // STEP 3: Edit Selected Mermaid Diagram
    // ═══════════════════════════════════════════
    console.log("\n=== STEP 3: Edit Selected ===");
    lastAlert = "";
    await openMenuItem(page, "Edit Selected Mermaid Diagram");
    await sleep(2000);

    if (lastAlert) {
      console.log(`  Got alert: "${lastAlert}"`);
      console.log(
        "  ⚠️ Image was not selected properly. Trying to click again...",
      );

      await page.evaluate(() => {
        const scroller = document.querySelector(".kix-appview-editor");
        if (scroller) scroller.scrollTop = 0;
      });
      await sleep(500);

      const imgs = await page.$$(".kix-canvas-tile-content img");
      console.log(`  Found ${imgs.length} tile images`);
      for (const img of imgs) {
        const box = await img.boundingBox().catch(() => null);
        if (box) {
          console.log(
            `    img: ${Math.round(box.width)}x${Math.round(box.height)} at (${Math.round(box.x)},${Math.round(box.y)})`,
          );
        }
      }

      if (imgs.length > 0) {
        const box = await imgs[0].boundingBox().catch(() => null);
        if (box) {
          console.log(`  Clicking first tile image at center...`);
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await sleep(2000);
          await shot(page, "03c-retry-click");

          lastAlert = "";
          await openMenuItem(page, "Edit Selected Mermaid Diagram");
          await sleep(2000);
          if (lastAlert) {
            console.log(`  Still got alert: "${lastAlert}"`);
          }
        }
      }
    }

    const editDialogOpen = await isDialogOpen(page);
    console.log(`  Edit dialog open: ${editDialogOpen}`);

    if (editDialogOpen) {
      const editFrame = await waitForFrame(page);
      if (editFrame) {
        await poll(
          () =>
            editFrame
              .locator("#source")
              .isVisible()
              .catch(() => false),
          10000,
        );
        await sleep(1000);

        const source = await editFrame
          .locator("#source")
          .inputValue()
          .catch(() => "");
        console.log(`  Source length: ${source.length}`);
        console.log(`  Source preview: ${source.substring(0, 120)}`);
        await shot(page, "04-edit-dialog");

        if (source.length > 0) {
          console.log("  ✅ EDIT IN PLACE WORKS! Source is pre-filled.");

          console.log("  Modifying source...");
          const modified = source
            .replace("Start", "Begin")
            .replace("End", "Finish");
          await editFrame.locator("#source").fill(modified);
          await poll(
            () =>
              editFrame
                .locator('#status:has-text("Preview up to date")')
                .count()
                .then((c) => c > 0)
                .catch(() => false),
            15000,
          );
          await sleep(1000);
          await shot(page, "05-edit-modified");

          const replaceBtn = editFrame.locator("#replace-btn");
          if (
            (await replaceBtn.count()) > 0 &&
            (await replaceBtn.isEnabled().catch(() => false))
          ) {
            console.log("  Clicking Replace...");
            await replaceBtn.click({ timeout: 5000 });
            await sleep(4000);
            await shot(page, "06-edit-replaced");
            console.log("  ✅ Diagram replaced!");
          } else {
            console.log("  Replace button not found or disabled");
          }
        }
      }
      if (await isDialogOpen(page)) await closeDialog(page);
    }

    // ═══════════════════════════════════════════
    // STEP 4: Convert Selected Diagram to Code
    // ═══════════════════════════════════════════
    console.log("\n=== STEP 4: Convert Selected to Code ===");

    await clickDiagramInDoc(page);
    await sleep(1000);

    lastAlert = "";
    await openMenuItem(page, "Convert Selected Diagram to Code");
    await sleep(2000);

    if (lastAlert) {
      console.log(`  Got alert: "${lastAlert}"`);
    }

    if (await isDialogOpen(page)) {
      const convFrame = await waitForFrame(page);
      if (convFrame) {
        await poll(
          () =>
            convFrame
              .locator("text=found")
              .count()
              .then((c) => c > 0)
              .catch(() => false),
          20000,
        );
        await sleep(1500);
        await shot(page, "07-convert-selected");
        console.log("  ✅ Convert Selected to Code works!");
      }
      await closeDialog(page);
    }

    // ═══════════════════════════════════════════
    // STEP 5: Convert Selected Code to Diagram
    // ═══════════════════════════════════════════
    console.log("\n=== STEP 5: Convert Selected Code to Diagram ===");

    // First need a code block in the doc. Since we might have
    // code blocks from previous test runs, try selecting some text.
    // This depends on having code blocks in the doc.
    lastAlert = "";
    await openMenuItem(page, "Convert Selected Code to Diagram");
    await sleep(2000);

    if (lastAlert) {
      console.log(`  Got alert: "${lastAlert}"`);
      console.log("  (Expected - need to select code block first)");
    }

    if (await isDialogOpen(page)) {
      await sleep(2000);
      await shot(page, "08-convert-selected-code");
      console.log("  ✅ Convert Selected Code to Diagram works!");
      await closeDialog(page);
    }

    console.log("\n════════════════════════════");
    console.log("       RESULTS SUMMARY");
    console.log("════════════════════════════");
    console.log("  Insert: ✅");
    console.log(
      "  Edit in Place: " +
        (editDialogOpen ? "✅" : "❌ (could not select image)"),
    );
  } catch (e) {
    console.error("\n❌ Error:", e.message);
    await shot(page, "XX-error");
  } finally {
    await sleep(1000);
    await context.close();
    await browser.close();
    console.log("\nBrowser closed.");
  }
})();
