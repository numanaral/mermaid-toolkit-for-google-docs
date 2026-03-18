/**
 * Minimal test: open ONE dialog on real Google Doc, move cursor inside
 * the iframe, take screenshots to prove it works. Fast iteration.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DOC_URL =
  "https://docs.google.com/document/d/1FpKtpbxZhZQPx4ldReg9eE3RXOsVO3rqFEmzhYN8S3c/edit?addon_dry_run=AAnXSK9hwlvF3XFY0Z5-uzyti5SRvmoq4f9edRcTyc37whjoxSV8rMsiPrE1VRYSXDucre5vv1hsqB912qoLkA5ukSbLvzhHxWEq4LIBH2WFIQZP2SW2vmzGlGk5xrFAetIeaZgMsuSM&tab=t.0";
const STATE_FILE = path.resolve(".playwright-state.json");
const SCREENSHOTS_DIR = path.resolve("screenshots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CURSOR_STYLE =
  "position:fixed;z-index:2147483647;pointer-events:none;" +
  "width:22px;height:22px;border-radius:50%;" +
  "background:rgba(0,137,123,0.55);border:2px solid rgba(0,137,123,0.85);" +
  "transform:translate(-50%,-50%);left:-100px;top:-100px;" +
  "box-shadow:0 0 8px rgba(0,137,123,0.3);" +
  "transition:left 0.04s linear, top 0.04s linear;";

const poll = async (fn, timeoutMs = 15000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await sleep(400);
  }
  return null;
};

const injectCursorInFrame = async (frame) => {
  await frame
    .evaluate((style) => {
      if (document.getElementById("pw-cursor")) return;
      const d = document.createElement("div");
      d.id = "pw-cursor";
      d.style.cssText = style;
      document.documentElement.appendChild(d);
    }, CURSOR_STYLE)
    .catch(() => {});
};

const hideCursorIn = async (frame) => {
  await frame
    .evaluate(() => {
      const el = document.getElementById("pw-cursor");
      if (el) {
        el.style.left = "-100px";
        el.style.top = "-100px";
      }
    })
    .catch(() => {});
};

const setCursorIn = async (frame, x, y) => {
  await frame
    .evaluate(
      ([cx, cy]) => {
        const el = document.getElementById("pw-cursor");
        if (el) {
          el.style.left = cx + "px";
          el.style.top = cy + "px";
        }
      },
      [x, y],
    )
    .catch(() => {});
};

const getIframeOffset = async (page) => {
  return page
    .evaluate(() => {
      let el = document.querySelector('iframe[name="userHtmlFrame"]');
      if (!el) {
        let best = null,
          bestArea = 0;
        for (const f of document.querySelectorAll("iframe")) {
          const r = f.getBoundingClientRect();
          const area = r.width * r.height;
          if (area > bestArea && r.width > 200 && r.height > 200) {
            best = f;
            bestArea = area;
          }
        }
        el = best;
      }
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })
    .catch(() => null);
};

const updateCursor = async (page, iframeFrame, px, py) => {
  if (!iframeFrame) {
    await setCursorIn(page, px, py);
    return;
  }
  const offset = await getIframeOffset(page);
  const over =
    offset &&
    px >= offset.x &&
    px <= offset.x + offset.w &&
    py >= offset.y &&
    py <= offset.y + offset.h;

  if (over) {
    await hideCursorIn(page);
    await setCursorIn(iframeFrame, px - offset.x, py - offset.y);
  } else {
    await hideCursorIn(iframeFrame);
    await setCursorIn(page, px, py);
  }
};

const glide = async (page, iframeFrame, toX, toY, steps = 20) => {
  const from = await page
    .evaluate(() => {
      const el = document.getElementById("pw-cursor");
      if (!el) return { x: 0, y: 0 };
      const l = parseFloat(el.style.left),
        t = parseFloat(el.style.top);
      return { x: l > 0 ? l : 0, y: t > 0 ? t : 0 };
    })
    .catch(() => ({ x: 0, y: 0 }));

  for (let i = 1; i <= steps; i++) {
    const px = from.x + ((toX - from.x) * i) / steps;
    const py = from.y + ((toY - from.y) * i) / steps;
    await page.mouse.move(px, py);
    await updateCursor(page, iframeFrame, px, py);
  }
};

const shot = async (page, name) => {
  await sleep(150);
  const p = path.join(SCREENSHOTS_DIR, `cursor-${name}.png`);
  await page.screenshot({ path: p });
  console.log(`  📸 cursor-${name}.png`);
};

(async () => {
  console.log("\n🖱️  Cursor-in-dialog test (real Google Doc)\n");

  for (const f of fs.readdirSync(SCREENSHOTS_DIR)) {
    if (f.startsWith("cursor-") && f.endsWith(".png"))
      fs.unlinkSync(path.join(SCREENSHOTS_DIR, f));
  }

  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: fs.existsSync(STATE_FILE) ? STATE_FILE : undefined,
    recordVideo: { dir: SCREENSHOTS_DIR, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  page.on("dialog", async (d) => {
    await d.accept();
  });

  try {
    console.log("1. Loading doc...");
    await page.goto(DOC_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page
      .waitForSelector("#docs-editor", { timeout: 30000 })
      .catch(() => {});
    await sleep(3000);
    await context.storageState({ path: STATE_FILE });
    await injectCursorInFrame(page);

    // Move cursor on main page
    await glide(page, null, 500, 300);
    await shot(page, "01-main-page");

    // Open Extensions > Mermaid Toolkit > Insert Mermaid Diagram
    console.log("2. Opening Insert Mermaid Diagram...");
    const extMenu = page.locator("#docs-extensions-menu");
    await glide(
      page,
      null,
      (await extMenu.boundingBox()).x + 40,
      (await extMenu.boundingBox()).y + 10,
    );
    await extMenu.click({ force: true });
    await sleep(500);

    const mtk = page
      .locator('.goog-menuitem-content:has-text("Mermaid Toolkit")')
      .first();
    await poll(() => mtk.isVisible().catch(() => false), 5000);
    await mtk.hover({ timeout: 5000 });
    await sleep(800);

    const insertItem = page.locator(
      '.goog-menuitem-content:text-is("Insert Mermaid Diagram")',
    );
    await poll(() => insertItem.isVisible().catch(() => false), 5000);
    await insertItem.click({ timeout: 5000 });
    await sleep(400);

    // Wait for dialog
    console.log("3. Waiting for dialog...");
    await poll(
      () =>
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
          .catch(() => false),
      25000,
    );
    await sleep(1500);

    // Inject cursor in iframe
    const iframeFrame = await poll(() => {
      const f = page.frame("userHtmlFrame");
      return f || null;
    }, 15000);

    if (!iframeFrame) {
      console.log("❌ No iframe found!");
      await shot(page, "XX-no-iframe");
      return;
    }

    await injectCursorInFrame(iframeFrame);
    await sleep(500);

    // Wait for editor to load
    await poll(
      () =>
        iframeFrame
          .locator("text=Templates")
          .count()
          .then((c) => c > 0)
          .catch(() => false),
      10000,
    );
    await sleep(800);
    await shot(page, "02-dialog-open");

    console.log("4. Moving cursor INSIDE dialog iframe...");

    // Debug: list all iframes
    const iframeInfo = await page
      .evaluate(() => {
        return Array.from(document.querySelectorAll("iframe")).map((f) => ({
          name: f.name,
          id: f.id,
          src: f.src?.substring(0, 80),
          w: f.getBoundingClientRect().width,
          h: f.getBoundingClientRect().height,
        }));
      })
      .catch(() => []);
    console.log(`   iframes found: ${JSON.stringify(iframeInfo)}`);

    const offset = await getIframeOffset(page);
    console.log(
      `   iframe offset: x=${offset?.x}, y=${offset?.y}, w=${offset?.w}, h=${offset?.h}`,
    );

    // Move to center of iframe
    if (offset) {
      const cx = offset.x + offset.w / 2;
      const cy = offset.y + offset.h / 2;
      await glide(page, iframeFrame, cx, cy);
      await sleep(300);
      await shot(page, "02-center-of-iframe");

      // Move to Templates button
      const tplBtn = iframeFrame.locator("#tpl-btn");
      const tplBox = await tplBtn.boundingBox().catch(() => null);
      if (tplBox) {
        console.log(`   Templates btn at: ${tplBox.x}, ${tplBox.y}`);
        await glide(
          page,
          iframeFrame,
          tplBox.x + tplBox.width / 2,
          tplBox.y + tplBox.height / 2,
        );
        await sleep(300);
        await shot(page, "03-over-templates-btn");
      }

      // Move to source textarea
      const srcArea = iframeFrame.locator("#source");
      const srcBox = await srcArea.boundingBox().catch(() => null);
      if (srcBox) {
        await glide(
          page,
          iframeFrame,
          srcBox.x + srcBox.width / 2,
          srcBox.y + srcBox.height / 2,
        );
        await sleep(300);
        await shot(page, "04-over-source-textarea");
      }

      // Move to insert button
      const insBtn = iframeFrame.locator("#insert-btn");
      const insBox = await insBtn.boundingBox().catch(() => null);
      if (insBox) {
        await glide(
          page,
          iframeFrame,
          insBox.x + insBox.width / 2,
          insBox.y + insBox.height / 2,
        );
        await sleep(300);
        await shot(page, "05-over-insert-btn");
      }

      // Move back outside iframe to main page
      await glide(page, iframeFrame, 200, 100);
      await sleep(300);
      await shot(page, "06-back-to-main");
    }

    console.log("\n✅ Done! Check screenshots/cursor-*.png\n");
  } catch (err) {
    console.error("❌ Error:", err.message);
    await shot(page, "XX-error");
  } finally {
    const videoPath = await page.video()?.path();
    await page.close();
    await context.close();
    await browser.close();
    if (videoPath) {
      const dest = path.join(SCREENSHOTS_DIR, "cursor-dialog-test.webm");
      try {
        fs.renameSync(videoPath, dest);
      } catch {}
      console.log(`🎬 Video: screenshots/cursor-dialog-test.webm`);
    }
  }
})();
