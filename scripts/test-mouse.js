/**
 * Test: prove cursor overlay tracks inside iframes during recording.
 *
 * Approach: instead of relying on mousemove events (which don't propagate
 * from iframe to parent), we explicitly set the cursor div position via
 * page.evaluate() after every mouse.move() call.
 *
 * Uses a self-contained data: URL — no server needed.
 */

const { chromium } = require("playwright");
const path = require("path");

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

const ensureCursor = async (page) => {
  await page.evaluate((style) => {
    if (document.getElementById("pw-cursor")) return;
    const d = document.createElement("div");
    d.id = "pw-cursor";
    d.style.cssText = style;
    document.documentElement.appendChild(d);
  }, CURSOR_STYLE);
};

const setCursorPos = async (page, x, y) => {
  await page.evaluate(([cx, cy]) => {
    const el = document.getElementById("pw-cursor");
    if (el) { el.style.left = cx + "px"; el.style.top = cy + "px"; }
  }, [x, y]);
};

const glide = async (page, toX, toY, steps = 25) => {
  const from = await page.evaluate(() => {
    const el = document.getElementById("pw-cursor");
    if (!el) return { x: 0, y: 0 };
    return { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 };
  });

  for (let i = 1; i <= steps; i++) {
    const px = from.x + ((toX - from.x) * i) / steps;
    const py = from.y + ((toY - from.y) * i) / steps;
    await page.mouse.move(px, py);
    await setCursorPos(page, px, py);
  }
};

const glideTo = async (page, locator) => {
  const box = await locator.boundingBox();
  if (!box) return;
  await glide(page, box.x + box.width / 2, box.y + box.height / 2);
};

const clickSmooth = async (page, locator) => {
  await glideTo(page, locator);
  await sleep(80);
  await locator.click({ timeout: 3000 });
  await sleep(150);
};

(async () => {
  console.log("\n🖱️  Mouse tracking test — no server needed\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: SCREENSHOTS_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(PAGE_HTML, { waitUntil: "domcontentloaded" });
    await sleep(500);
    await ensureCursor(page);

    // 1. Move around main page
    console.log("1. Gliding around main page...");
    await glide(page, 100, 100);
    await sleep(200);
    await glide(page, 600, 60);
    await sleep(200);
    await glide(page, 400, 300);
    await sleep(300);
    console.log("   ✓ Main page cursor visible");

    // 2. Move over the dialog mock (still main page)
    console.log("2. Moving over dialog titlebar...");
    const titlebar = page.locator(".titlebar");
    await glideTo(page, titlebar);
    await sleep(300);
    console.log("   ✓ Titlebar");

    // 3. Move into iframe content — this is the key test
    console.log("3. Moving into iframe content...");
    const frame = page.frame({ url: /.*/ });
    const iframeEl = page.locator("#testFrame");
    const iframeBox = await iframeEl.boundingBox();

    if (iframeBox) {
      // Glide into the iframe area
      await glide(page, iframeBox.x + 100, iframeBox.y + 30);
      await sleep(200);
      await glide(page, iframeBox.x + 400, iframeBox.y + 80);
      await sleep(200);
      console.log("   ✓ Cursor moving over iframe area");
    }

    // 4. Click buttons inside the iframe using boundingBox coords
    console.log("4. Clicking iframe buttons with cursor tracking...");
    const innerFrame = page.frameLocator("#testFrame");

    const btn1 = innerFrame.locator("#btn1");
    const btn1Box = await btn1.boundingBox();
    if (btn1Box) {
      await glide(page, btn1Box.x + btn1Box.width / 2, btn1Box.y + btn1Box.height / 2);
      await sleep(150);
      await btn1.click();
      await sleep(300);
      console.log("   ✓ Clicked 'Templates'");
    }

    const btn2 = innerFrame.locator("#btn2");
    const btn2Box = await btn2.boundingBox();
    if (btn2Box) {
      await glide(page, btn2Box.x + btn2Box.width / 2, btn2Box.y + btn2Box.height / 2);
      await sleep(150);
      await btn2.click();
      await sleep(300);
      console.log("   ✓ Clicked 'Insert After'");
    }

    const btn3 = innerFrame.locator("#btn3");
    const btn3Box = await btn3.boundingBox();
    if (btn3Box) {
      await glide(page, btn3Box.x + btn3Box.width / 2, btn3Box.y + btn3Box.height / 2);
      await sleep(150);
      await btn3.click();
      await sleep(300);
      console.log("   ✓ Clicked 'Replace'");
    }

    // 5. Move over textarea inside iframe
    console.log("5. Moving over textarea in iframe...");
    const ta = innerFrame.locator("#src");
    const taBox = await ta.boundingBox();
    if (taBox) {
      await glide(page, taBox.x + 30, taBox.y + 15);
      await sleep(150);
      await glide(page, taBox.x + taBox.width - 30, taBox.y + taBox.height - 15);
      await sleep(300);
      console.log("   ✓ Textarea sweep");
    }

    // 6. Move over preview area
    console.log("6. Moving over preview area...");
    const preview = innerFrame.locator(".preview");
    const pvBox = await preview.boundingBox();
    if (pvBox) {
      await glide(page, pvBox.x + pvBox.width / 2, pvBox.y + pvBox.height / 2);
      await sleep(500);
      console.log("   ✓ Preview area");
    }

    // 7. Glide back out to main page
    console.log("7. Gliding back to main page...");
    await glide(page, 200, 50);
    await sleep(500);

    console.log("\n✅ Done! Check screenshots/mouse-test.webm\n");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
})();
