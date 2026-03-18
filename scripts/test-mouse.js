/**
 * Test: prove cursor overlay tracks inside iframes during recording.
 *
 * Key insight: a div on the parent page CANNOT render on top of iframe
 * content — iframes are replaced elements with their own paint layer.
 * So we inject the cursor into EVERY frame and update all of them.
 *
 * Uses a self-contained data: URL — no server needed.
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOTS_DIR = path.join(__dirname, "..", "screenshots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CURSOR_STYLE =
  "position:fixed;z-index:2147483647;pointer-events:none;" +
  "width:22px;height:22px;border-radius:50%;" +
  "background:rgba(0,137,123,0.55);border:2px solid rgba(0,137,123,0.85);" +
  "transform:translate(-50%,-50%);left:-100px;top:-100px;" +
  "box-shadow:0 0 8px rgba(0,137,123,0.3);" +
  "transition:left 0.04s linear, top 0.04s linear;";

const PAGE_HTML = `data:text/html,${encodeURIComponent(`<!DOCTYPE html>
<html><head><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: sans-serif; background: #f5f5f5; padding: 40px; }
  h2 { margin-bottom: 16px; }
  .dialog-mock {
    background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    width: 700px; margin: 0 auto; overflow: hidden;
  }
  .titlebar { padding: 12px 20px; border-bottom: 1px solid #e0e0e0; font-weight: 600; }
  iframe { width: 100%; height: 350px; border: none; display: block; }
</style></head>
<body>
  <h2>Mouse Tracking Test</h2>
  <div class="dialog-mock">
    <div class="titlebar">Mock Dialog</div>
    <iframe id="testFrame" srcdoc="
      <html><head><style>
        body { font-family: sans-serif; padding: 20px; }
        button { padding: 10px 24px; font-size: 14px; border-radius: 8px;
                 border: none; background: #1a73e8; color: #fff; cursor: pointer;
                 margin: 8px 4px; }
        button:hover { background: #1557b0; }
        textarea { width: 100%; height: 120px; margin: 12px 0; padding: 10px;
                   font-family: monospace; font-size: 13px; border: 1px solid #ccc;
                   border-radius: 8px; }
        .preview { background: #f0f0f0; border-radius: 8px; padding: 20px;
                   text-align: center; color: #666; margin-top: 12px; }
      </style></head>
      <body>
        <div style='display:flex;gap:8px'>
          <button id='btn1'>Templates</button>
          <button id='btn2'>Insert After</button>
          <button id='btn3'>Replace</button>
        </div>
        <textarea id='src' spellcheck='false'>flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Nope]</textarea>
        <div class='preview'>( Live Preview Area )</div>
      </body></html>
    "></iframe>
  </div>
</body></html>`)}`;

const injectCursorInFrame = async (frame, style) => {
  await frame.evaluate((s) => {
    if (document.getElementById("pw-cursor")) return;
    const d = document.createElement("div");
    d.id = "pw-cursor";
    d.style.cssText = s;
    document.documentElement.appendChild(d);
  }, style).catch(() => {});
};

const ensureCursorEverywhere = async (page) => {
  await injectCursorInFrame(page, CURSOR_STYLE);
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame()) {
      await injectCursorInFrame(frame, CURSOR_STYLE);
    }
  }
};

const getIframeOffset = async (page, iframeSelector) => {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y };
  }, iframeSelector).catch(() => null);
};

const setCursorInAllFrames = async (page, pageX, pageY, iframeSelector) => {
  await page.evaluate(([cx, cy]) => {
    const el = document.getElementById("pw-cursor");
    if (el) { el.style.left = cx + "px"; el.style.top = cy + "px"; }
  }, [pageX, pageY]).catch(() => {});

  if (iframeSelector) {
    const offset = await getIframeOffset(page, iframeSelector);
    if (offset) {
      const localX = pageX - offset.x;
      const localY = pageY - offset.y;
      for (const frame of page.frames()) {
        if (frame !== page.mainFrame()) {
          await frame.evaluate(([cx, cy]) => {
            const el = document.getElementById("pw-cursor");
            if (el) { el.style.left = cx + "px"; el.style.top = cy + "px"; }
          }, [localX, localY]).catch(() => {});
        }
      }
    }
  }
};

const hideCursorInFrame = async (frame) => {
  await frame.evaluate(() => {
    const el = document.getElementById("pw-cursor");
    if (el) { el.style.left = "-100px"; el.style.top = "-100px"; }
  }).catch(() => {});
};

const glide = async (page, toX, toY, iframeSelector = null, steps = 25) => {
  const from = await page.evaluate(() => {
    const el = document.getElementById("pw-cursor");
    if (!el) return { x: 0, y: 0 };
    return { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 };
  }).catch(() => ({ x: 0, y: 0 }));

  let isOverIframe = false;
  const iframeOffset = iframeSelector
    ? await getIframeOffset(page, iframeSelector)
    : null;

  for (let i = 1; i <= steps; i++) {
    const px = from.x + ((toX - from.x) * i) / steps;
    const py = from.y + ((toY - from.y) * i) / steps;
    await page.mouse.move(px, py);

    const nowOverIframe = iframeOffset
      ? px >= iframeOffset.x && py >= iframeOffset.y
      : false;

    if (nowOverIframe && !isOverIframe) {
      await hideCursorInFrame(page.mainFrame());
    } else if (!nowOverIframe && isOverIframe) {
      for (const frame of page.frames()) {
        if (frame !== page.mainFrame()) await hideCursorInFrame(frame);
      }
    }
    isOverIframe = nowOverIframe;

    await setCursorInAllFrames(page, px, py, nowOverIframe ? iframeSelector : null);
  }
};

const shot = async (page, name) => {
  await sleep(100);
  const p = path.join(SCREENSHOTS_DIR, `mouse-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`    📸 mouse-${name}.png`);
};

(async () => {
  console.log("\n🖱️  Mouse tracking test — with screenshots to prove it\n");

  for (const f of fs.readdirSync(SCREENSHOTS_DIR)) {
    if (f.startsWith("mouse-") && f.endsWith(".png")) {
      fs.unlinkSync(path.join(SCREENSHOTS_DIR, f));
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: SCREENSHOTS_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(PAGE_HTML, { waitUntil: "domcontentloaded" });
    await sleep(800);
    await ensureCursorEverywhere(page);

    // 1. Main page — cursor should be visible
    console.log("1. Gliding on main page...");
    await glide(page, 300, 30, "#testFrame");
    await sleep(200);
    await shot(page, "01-main-page");

    // 2. Titlebar — still main page
    console.log("2. Moving to titlebar...");
    await glide(page, 350, 105, "#testFrame");
    await sleep(200);
    await shot(page, "02-titlebar");

    // 3. INTO the iframe — this is the critical test
    console.log("3. Moving INTO iframe content...");
    await glide(page, 200, 200, "#testFrame");
    await sleep(300);
    await shot(page, "03-inside-iframe");

    // 4. Over buttons inside iframe
    console.log("4. Moving over iframe buttons...");
    const innerFrame = page.frameLocator("#testFrame");

    const btn1 = innerFrame.locator("#btn1");
    const btn1Box = await btn1.boundingBox();
    if (btn1Box) {
      await glide(page, btn1Box.x + btn1Box.width / 2, btn1Box.y + btn1Box.height / 2, "#testFrame");
      await sleep(200);
      await shot(page, "04-over-btn1");
    }

    const btn3 = innerFrame.locator("#btn3");
    const btn3Box = await btn3.boundingBox();
    if (btn3Box) {
      await glide(page, btn3Box.x + btn3Box.width / 2, btn3Box.y + btn3Box.height / 2, "#testFrame");
      await sleep(200);
      await shot(page, "05-over-btn3");
    }

    // 5. Over textarea inside iframe
    console.log("5. Moving over textarea...");
    const ta = innerFrame.locator("#src");
    const taBox = await ta.boundingBox();
    if (taBox) {
      await glide(page, taBox.x + taBox.width / 2, taBox.y + taBox.height / 2, "#testFrame");
      await sleep(200);
      await shot(page, "06-over-textarea");
    }

    // 6. Over preview area
    console.log("6. Moving over preview area...");
    const preview = innerFrame.locator(".preview");
    const pvBox = await preview.boundingBox();
    if (pvBox) {
      await glide(page, pvBox.x + pvBox.width / 2, pvBox.y + pvBox.height / 2, "#testFrame");
      await sleep(200);
      await shot(page, "07-over-preview");
    }

    // 7. Back to main page
    console.log("7. Back to main page...");
    await glide(page, 200, 30, "#testFrame");
    await sleep(200);
    await shot(page, "08-back-to-main");

    console.log("\n✅ Done! Check screenshots/mouse-*.png to verify cursor position\n");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    const videoPath = await page.video()?.path();
    await page.close();
    await context.close();
    await browser.close();
    if (videoPath) {
      const dest = path.join(SCREENSHOTS_DIR, "mouse-test.webm");
      try { fs.renameSync(videoPath, dest); } catch {}
      console.log(`🎬 Video: screenshots/mouse-test.webm`);
    }
  }
})();
