const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const DOC_URL =
  "https://docs.google.com/document/d/1FpKtpbxZhZQPx4ldReg9eE3RXOsVO3rqFEmzhYN8S3c/edit?addon_dry_run=AAnXSK9hwlvF3XFY0Z5-uzyti5SRvmoq4f9edRcTyc37whjoxSV8rMsiPrE1VRYSXDucre5vv1hsqB912qoLkA5ukSbLvzhHxWEq4LIBH2WFIQZP2SW2vmzGlGk5xrFAetIeaZgMsuSM&tab=t.0";
const STATE_FILE = path.resolve(".playwright-state.json");
const SCREENSHOTS_DIR = path.resolve("screenshots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VP_W = 1920;
const VP_H = 1080;

if (fs.existsSync(SCREENSHOTS_DIR)) {
  for (const f of fs.readdirSync(SCREENSHOTS_DIR)) {
    if (f.endsWith(".png") || f.endsWith(".webm"))
      fs.unlinkSync(path.join(SCREENSHOTS_DIR, f));
  }
} else {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
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

const CURSOR_STYLE =
  "position:fixed;z-index:2147483647;pointer-events:none;" +
  "width:22px;height:22px;border-radius:50%;" +
  "background:rgba(0,137,123,0.55);border:2px solid rgba(0,137,123,0.85);" +
  "transform:translate(-50%,-50%);left:-100px;top:-100px;" +
  "box-shadow:0 0 8px rgba(0,137,123,0.3);" +
  "transition:left 0.04s linear, top 0.04s linear;";

const DEMO_FLOWCHART = `flowchart TD
    A[Open Google Doc] --> B[Extensions → Mermaid Toolkit]
    B --> C{New or Existing?}
    C -->|New| D[Insert Diagram]
    C -->|Existing| E[Edit Selected]
    D --> F[Write Mermaid Code]
    E --> F
    F --> G[Live Preview]
    G --> H[Insert into Doc]`;

const SAMPLE_MARKDOWN = `# Sample Document

## Overview

This is a **sample markdown** document with diagrams.

### Architecture

\`\`\`mermaid
graph TD
    A[User] --> B[Google Docs]
    B --> C[Mermaid Toolkit]
    C --> D[Rendered Diagram]
\`\`\`

### Features

- Live editor with preview
- Code to diagram conversion
- Import/export markdown

> Everything runs client-side in the browser.

| Feature | Status |
|---------|--------|
| Editor | Done |
| Import | Done |
| Export | Done |
`;

// Google Docs "Copy as Markdown" wraps fenced code blocks in
// quadruple-backticks and each line in single backticks.
// The regex: /```` ```mermaid ````...\n(body)\n```` ``` ````/
const BROKEN_MARKDOWN = [
  "# Architecture Doc",
  "",
  "Here is the system flow:",
  "",
  "```` ```mermaid ````",
  "`graph TD`",
  "`    A[Client] --> B[API Gateway]`",
  "`    B --> C[Auth Service]`",
  "`    B --> D[Data Service]`",
  "`    C --> E[Database]`",
  "`    D --> E`",
  "```` ``` ````",
  "",
  "And another one:",
  "",
  "```` ```mermaid ````",
  "`sequenceDiagram`",
  "`    Alice->>Bob: Hello Bob`",
  "`    Bob-->>Alice: Hi Alice`",
  "```` ``` ````",
  "",
  "This table should not be touched:",
  "",
  "| Name | Value |",
  "|------|-------|",
  "| Alpha | 100 |",
  "| Beta | 200 |",
].join("\n");

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
  try {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${name}.png`),
      fullPage: false,
    });
    console.log(`    📸 ${name}.png`);
  } catch (e) {
    console.log(`    ⚠️ Screenshot ${name} failed: ${e.message}`);
  }
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

const ensureCursor = async (page) => {
  await injectCursorInFrame(page);
  const f = page.frame("userHtmlFrame");
  if (f) await injectCursorInFrame(f);
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

const updateCursorAllFrames = async (page, px, py) => {
  const iframeFrame = page.frame("userHtmlFrame");
  if (!iframeFrame) {
    await setCursorIn(page, px, py);
    return;
  }

  const offset = await getIframeOffset(page);
  const overIframe =
    offset &&
    px >= offset.x &&
    px <= offset.x + offset.w &&
    py >= offset.y &&
    py <= offset.y + offset.h;

  if (overIframe) {
    await hideCursorIn(page);
    await setCursorIn(iframeFrame, px - offset.x, py - offset.y);
  } else {
    await hideCursorIn(iframeFrame);
    await setCursorIn(page, px, py);
  }
};

const glide = async (page, x, y, steps = 20) => {
  const from = await page
    .evaluate(() => {
      const el = document.getElementById("pw-cursor");
      if (!el) return { x: 0, y: 0 };
      return {
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
      };
    })
    .catch(() => ({ x: 0, y: 0 }));

  for (let i = 1; i <= steps; i++) {
    const px = from.x + ((x - from.x) * i) / steps;
    const py = from.y + ((y - from.y) * i) / steps;
    await page.mouse.move(px, py);
    await updateCursorAllFrames(page, px, py);
  }
  await sleep(60);
};

const glideTo = async (page, locator) => {
  try {
    const box = await locator.boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2);
  } catch {}
};

const clickSmooth = async (page, locator, opts = {}) => {
  await glideTo(page, locator);
  await sleep(100);
  await locator.click({ timeout: 5000, ...opts });
  await sleep(150);
};

const closeDialog = async (page) => {
  if (!(await isDialogOpen(page))) return;
  const f = page.frame("userHtmlFrame");
  if (f) {
    try {
      await f.evaluate(() => {
        if (window.google?.script?.host) window.google.script.host.close();
      });
      const closed = await poll(async () => !(await isDialogOpen(page)), 5000);
      if (closed) {
        console.log("    Closed via host.close()");
        await sleep(600);
        return;
      }
    } catch {}
  }
  try {
    await page.keyboard.press("Escape");
    const closed = await poll(async () => !(await isDialogOpen(page)), 3000);
    if (closed) {
      console.log("    Closed via Escape");
      await sleep(600);
      return;
    }
  } catch {}
  console.log("    Fallback: reloading...");
  await page
    .reload({ waitUntil: "domcontentloaded", timeout: 30000 })
    .catch(() => {});
  await page
    .waitForSelector("#docs-editor", { timeout: 20000 })
    .catch(() => {});
  await sleep(3000);
};

const openMenuItem = async (page, label, idx, slug) => {
  await poll(
    () =>
      page
        .$("#docs-extensions-menu")
        .then((el) => !!el)
        .catch(() => false),
    15000,
  );
  await ensureCursor(page);

  const extMenu = page.locator("#docs-extensions-menu");
  const mtk = page
    .locator('.goog-menuitem-content:has-text("Mermaid Toolkit")')
    .first();

  let target;
  if (label.includes('"')) {
    target = page
      .locator(
        `.goog-menuitem-content:has-text("${label.split('"')[0].trim()}")`,
      )
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

  for (let attempt = 0; attempt < 3; attempt++) {
    await clickSmooth(page, extMenu, { force: true });
    await sleep(500);
    if (!(await poll(() => mtk.isVisible().catch(() => false), 4000))) {
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(800);
      continue;
    }
    if (attempt === 0) await shot(page, `${idx}-${slug}-menu`);

    await mtk.hover({ timeout: 5000 });
    await sleep(800);

    const visible = await poll(
      () => target.isVisible().catch(() => false),
      5000,
    );
    if (!visible) {
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(800);
      continue;
    }
    if (attempt === 0) await shot(page, `${idx}-${slug}-submenu`);

    const box = await target.boundingBox().catch(() => null);
    const mtkBox = await mtk.boundingBox().catch(() => null);
    if (box && mtkBox) {
      await glide(page, mtkBox.x + mtkBox.width, box.y + box.height / 2, 5);
      await glide(page, box.x + box.width / 2, box.y + box.height / 2, 10);
      await sleep(300);
    }
    if (attempt === 0) await shot(page, `${idx}-${slug}-hover`);

    if (!(await target.isVisible().catch(() => false))) {
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(800);
      continue;
    }
    await target.click({ timeout: 5000 });
    await sleep(400);
    return;
  }
  throw new Error(`Failed to open menu item: ${label}`);
};

const waitDialogAndInjectCursor = async (page) => {
  await waitForDialog(page);
  await sleep(800);
  await ensureCursor(page);
  const f = page.frame("userHtmlFrame");
  if (f) await injectCursorInFrame(f);
  await sleep(200);
};

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    viewport: { width: VP_W, height: VP_H },
    storageState: fs.existsSync(STATE_FILE) ? STATE_FILE : undefined,
    recordVideo: { dir: SCREENSHOTS_DIR, size: { width: VP_W, height: VP_H } },
  });
  const page = await context.newPage();

  page.on("dialog", async (d) => {
    console.log(`    [Alert] "${d.message()}"`);
    await d.accept();
  });

  console.log("Navigating to Google Doc...");
  await page.goto(DOC_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForSelector("#docs-editor", { timeout: 30000 })
    .catch(() => {});
  await sleep(3000);
  await context.storageState({ path: STATE_FILE });
  await ensureCursor(page);
  await shot(page, "00-doc-baseline");

  try {
    // ═══════════════════════════════════════════
    // 1. INSERT MERMAID DIAGRAM
    // ═══════════════════════════════════════════
    console.log("\n[01] Insert Mermaid Diagram");
    await openMenuItem(page, "Insert Mermaid Diagram", "01", "insert");
    await waitDialogAndInjectCursor(page);
    const frame1 = await waitForFrame(page);
    if (frame1) {
      await poll(
        () =>
          frame1
            .locator("text=Templates")
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        10000,
      );
      await sleep(800);
      await shot(page, "01-insert-editor");

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
      await sleep(400);
      await shot(page, "01-insert-templates");

      const templates = ["Flowchart", "Sequence", "Gantt", "Architecture"];
      for (const tpl of templates) {
        await frame1
          .locator(`button[data-tpl]:has-text("${tpl}")`)
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
        await shot(page, `01-insert-${tpl.toLowerCase().replace(/ /g, "")}`);
      }

      console.log("    Entering custom diagram...");
      await frame1.locator("#source").fill(DEMO_FLOWCHART);
      await poll(
        () =>
          frame1
            .locator('#status:has-text("Preview up to date")')
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        15000,
      );
      await sleep(1000);
      await shot(page, "01-insert-custom");

      console.log("    Inserting diagram...");
      await poll(
        () =>
          frame1
            .locator("#insert-btn")
            .isEnabled()
            .catch(() => false),
        5000,
      );
      await frame1.locator("#insert-btn").click({ timeout: 5000 });
      await sleep(4000);
    }
    await poll(async () => !(await isDialogOpen(page)), 10000);
    await sleep(1500);
    await ensureCursor(page);
    await shot(page, "01-insert-done");

    // ═══════════════════════════════════════════
    // 1b. EDIT IN PLACE — click diagram, edit, replace
    // ═══════════════════════════════════════════
    console.log("\n[01b] Edit In Place");
    await page.keyboard.press("Home");
    await sleep(500);
    const editorArea = page.locator(".kix-appview-editor");
    const edBox = await editorArea.boundingBox().catch(() => null);
    if (edBox) {
      const cx = edBox.x + edBox.width / 2;
      const cy = edBox.y + edBox.height / 2;
      console.log(
        `    Clicking diagram at (${Math.round(cx)}, ${Math.round(cy)})`,
      );
      await glide(page, cx, cy);
      await page.mouse.click(cx, cy);
      await sleep(2000);
    }

    let lastAlertMsg = "";
    const alertListener = (d) => {
      lastAlertMsg = d.message();
      d.accept();
    };
    page.removeAllListeners("dialog");
    page.on("dialog", alertListener);

    await openMenuItem(page, "Edit Selected Mermaid Diagram", "01b", "edit");
    await sleep(2000);

    if (lastAlertMsg) {
      console.log(
        `    Alert: "${lastAlertMsg}" — image not selected, retrying...`,
      );
      if (edBox) {
        await page.evaluate(() => {
          const s = document.querySelector(".kix-appview-editor");
          if (s) s.scrollTop = 0;
        });
        await sleep(500);
        await page.mouse.click(
          edBox.x + edBox.width / 2,
          edBox.y + edBox.height * 0.4,
        );
        await sleep(2000);
        lastAlertMsg = "";
        await openMenuItem(
          page,
          "Edit Selected Mermaid Diagram",
          "01b",
          "edit-retry",
        );
        await sleep(2000);
      }
    }

    if (!lastAlertMsg && (await isDialogOpen(page))) {
      await ensureCursor(page);
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
        if (source.length > 0) {
          console.log("    ✅ Editor opened with pre-filled source");
          await shot(page, "01b-edit-prefilled");

          const modified = source
            .replace("Begin", "Start")
            .replace("Finish", "End");
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
          await shot(page, "01b-edit-modified");

          const replaceBtn = editFrame.locator("#replace-btn");
          if (
            (await replaceBtn.count()) > 0 &&
            (await replaceBtn.isEnabled().catch(() => false))
          ) {
            await replaceBtn.click({ timeout: 5000 });
            await sleep(4000);
            console.log("    ✅ Diagram replaced");
          }
        } else {
          console.log(
            "    ⚠️ Source was empty, editor may have opened in insert mode",
          );
        }
      }
      if (await isDialogOpen(page)) await closeDialog(page);
    } else if (lastAlertMsg) {
      console.log("    ⚠️ Skipping edit — could not select diagram");
    }

    page.removeAllListeners("dialog");
    page.on("dialog", async (d) => {
      console.log(`    [Alert] "${d.message()}"`);
      await d.accept();
    });

    await sleep(1200);
    await ensureCursor(page);
    await shot(page, "01b-edit-done");

    // ═══════════════════════════════════════════
    // 2. CONVERT ALL CODE TO DIAGRAMS
    // ═══════════════════════════════════════════
    console.log("\n[02] Convert Code to Diagrams");
    await openMenuItem(page, "Convert All Code to Diagrams", "02", "code2diag");
    await waitDialogAndInjectCursor(page);
    const frame2 = await waitForFrame(page);
    if (frame2) {
      console.log("    Waiting for render...");
      await poll(
        () =>
          frame2
            .locator("text=rendered. Choose an action")
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        30000,
      );
      await sleep(1200);
      await shot(page, "02-code2diag");

      const hasCards2 = await poll(
        () =>
          frame2
            .locator(".card-row")
            .first()
            .isVisible()
            .catch(() => false),
        5000,
      );
      if (hasCards2) {
        console.log("    Expanding first card (show source)...");
        const chevron2 = frame2.locator(".card-chevron").first();
        const chevBox2 = await chevron2.boundingBox().catch(() => null);
        if (chevBox2) {
          await glide(
            page,
            chevBox2.x + chevBox2.width / 2,
            chevBox2.y + chevBox2.height / 2,
          );
          await sleep(100);
          await chevron2.click({ timeout: 5000 });
          await sleep(1000);
          await shot(page, "02-code2diag-source");
        }
      }
    }
    await closeDialog(page);
    await sleep(1200);
    await ensureCursor(page);

    // ═══════════════════════════════════════════
    // 3. CONVERT ALL DIAGRAMS TO CODE
    // ═══════════════════════════════════════════
    console.log("\n[03] Convert Diagrams to Code");
    await openMenuItem(page, "Convert All Diagrams to Code", "03", "diag2code");
    await waitDialogAndInjectCursor(page);
    const frame3 = await waitForFrame(page);
    if (frame3) {
      console.log("    Waiting for render...");
      await poll(
        () =>
          frame3
            .locator("text=found. Choose an action")
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        30000,
      );
      await sleep(1200);
      await shot(page, "03-diag2code");

      const hasCards3 = await poll(
        () =>
          frame3
            .locator(".card-row")
            .first()
            .isVisible()
            .catch(() => false),
        5000,
      );
      if (hasCards3) {
        console.log("    Expanding first card (show source)...");
        const chevron3 = frame3.locator(".card-chevron").first();
        const chevBox3 = await chevron3.boundingBox().catch(() => null);
        if (chevBox3) {
          await glide(
            page,
            chevBox3.x + chevBox3.width / 2,
            chevBox3.y + chevBox3.height / 2,
          );
          await sleep(100);
          await chevron3.click({ timeout: 5000 });
          await sleep(1000);
          await shot(page, "03-diag2code-source");
        }
      }
    }
    await closeDialog(page);
    await sleep(1200);
    await ensureCursor(page);

    // ═══════════════════════════════════════════
    // 3b. EDIT MERMAID DIAGRAMS
    // ═══════════════════════════════════════════
    console.log("\n[03b] Edit All Mermaid Diagrams");
    await openMenuItem(page, "Edit All Mermaid Diagrams", "03b", "editdiags");
    await waitDialogAndInjectCursor(page);
    const frame3b = await waitForFrame(page);
    if (frame3b) {
      console.log("    Waiting for render...");
      await poll(
        () =>
          frame3b
            .locator("text=found. Click Edit")
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        30000,
      );
      await sleep(1200);
      await shot(page, "03b-editdiags");

      const hasEdit3b = await poll(
        () =>
          frame3b
            .locator("#edit-0")
            .isVisible()
            .catch(() => false),
        5000,
      );
      if (hasEdit3b) {
        console.log("    Opening inline editor...");
        const editBtn3b = frame3b.locator("#edit-0");
        const editBox3b = await editBtn3b.boundingBox().catch(() => null);
        if (editBox3b) {
          await glide(
            page,
            editBox3b.x + editBox3b.width / 2,
            editBox3b.y + editBox3b.height / 2,
          );
          await sleep(100);
          await editBtn3b.click({ timeout: 5000 });
          await sleep(1500);
          await shot(page, "03b-editdiags-editor");
        }
      }
    }
    await closeDialog(page);
    await sleep(1200);
    await ensureCursor(page);

    // ═══════════════════════════════════════════
    // 4. IMPORT FROM MARKDOWN
    // ═══════════════════════════════════════════
    console.log("\n[04] Import from Markdown");
    await openMenuItem(page, "Import from Markdown", "04", "import");
    await waitDialogAndInjectCursor(page);
    const frame4 = await waitForFrame(page);
    if (frame4) {
      await poll(
        () =>
          frame4
            .locator("#source")
            .isVisible()
            .catch(() => false),
        10000,
      );
      await sleep(600);
      await shot(page, "04-import-empty");
      await frame4.locator("#source").click({ timeout: 5000 });
      await frame4.locator("#source").fill(SAMPLE_MARKDOWN);
      await poll(
        () =>
          frame4
            .locator(
              "#preview-area img, #preview-area svg, text=Sample Document",
            )
            .first()
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        15000,
      );
      await sleep(2000);
      await shot(page, "04-import-filled");
    }
    await closeDialog(page);
    await sleep(1200);
    await ensureCursor(page);

    // ═══════════════════════════════════════════
    // 5. EXPORT AS MARKDOWN
    // ═══════════════════════════════════════════
    console.log("\n[05] Export as Markdown");
    await openMenuItem(page, "Export as Markdown", "05", "export");
    await waitDialogAndInjectCursor(page);
    const frame5 = await waitForFrame(page);
    if (frame5) {
      console.log("    Waiting for content...");
      await poll(
        () =>
          frame5
            .locator("text=lines,")
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        30000,
      );
      await sleep(1200);
    }
    await shot(page, "05-export");
    await closeDialog(page);
    await sleep(1200);
    await ensureCursor(page);

    // ═══════════════════════════════════════════
    // 6. FIX NATIVE "COPY AS MARKDOWN"
    // ═══════════════════════════════════════════
    console.log('\n[06] Fix "Copy as Markdown"');
    await openMenuItem(page, 'Fix Native "Copy as Markdown"', "06", "fix");
    await waitDialogAndInjectCursor(page);
    const frame6 = await waitForFrame(page);
    if (frame6) {
      await poll(
        () =>
          frame6
            .locator("#input")
            .isVisible()
            .catch(() => false),
        10000,
      );
      await sleep(600);
      await shot(page, "06-fix-empty");
      console.log("    Pasting broken markdown...");
      await frame6.locator("#input").click({ timeout: 5000 });
      await frame6.locator("#input").fill(BROKEN_MARKDOWN);
      await poll(
        () =>
          frame6
            .locator("text=Fixed")
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        10000,
      );
      await sleep(1200);
      await shot(page, "06-fix-result");
      console.log("    Switching to Diff...");
      await frame6
        .locator('button.tab:has-text("Diff")')
        .click({ timeout: 5000 });
      await sleep(1200);
      await shot(page, "06-fix-diff");
    }
    await closeDialog(page);
    await sleep(1200);
    await ensureCursor(page);

    // ═══════════════════════════════════════════
    // 7. QUICK GUIDE
    // ═══════════════════════════════════════════
    console.log("\n[07] Quick Guide");
    await openMenuItem(page, "Quick Guide", "07", "guide");
    await waitDialogAndInjectCursor(page);
    const frame7 = await waitForFrame(page);
    if (frame7) {
      await poll(
        () =>
          frame7
            .locator("text=Live Editor")
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        10000,
      );
      await sleep(800);
      await shot(page, "07-guide");
    }
    await closeDialog(page);
    await sleep(1200);
    await ensureCursor(page);

    // ═══════════════════════════════════════════
    // 8. DEV TOOLS + Inspector
    // ═══════════════════════════════════════════
    console.log("\n[08] Dev Tools");
    await openMenuItem(page, "Dev Tools", "08", "devtools");
    await waitDialogAndInjectCursor(page);
    const frame8 = await waitForFrame(page);
    if (frame8) {
      await poll(
        () =>
          frame8
            .locator("text=Document Inspector")
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        10000,
      );
      await sleep(800);
      await shot(page, "08-devtools");
      console.log("    Opening Document Inspector...");
      await frame8.locator("#btn-inspector").click({ timeout: 5000 });
      await sleep(4000);
      await waitForDialog(page);
      await ensureCursor(page);
      const inspFrame = await waitForFrame(page);
      if (inspFrame) {
        await poll(
          () =>
            inspFrame
              .evaluate(() => document.body?.innerText?.length > 50)
              .catch(() => false),
          20000,
        );
        await sleep(1500);
        await shot(page, "08-devtools-inspector");
        const tabs = inspFrame.locator('button.tab, .tab-btn, [role="tab"]');
        const tabCount = await tabs.count().catch(() => 0);
        if (tabCount > 1) {
          for (let i = 0; i < Math.min(tabCount, 3); i++) {
            await tabs
              .nth(i)
              .click({ timeout: 3000 })
              .catch(() => {});
            await sleep(1200);
            await shot(page, `08-devtools-tab${i + 1}`);
          }
        }
      }
    }
    while (await isDialogOpen(page)) {
      await closeDialog(page);
      await sleep(800);
    }
    await sleep(1200);
    await ensureCursor(page);

    // ═══════════════════════════════════════════
    // 9. ABOUT
    // ═══════════════════════════════════════════
    console.log("\n[09] About");
    await openMenuItem(page, "About", "09", "about");
    await waitDialogAndInjectCursor(page);
    const frame9 = await waitForFrame(page);
    if (frame9) {
      await poll(
        () =>
          frame9
            .locator("text=Mermaid Toolkit")
            .count()
            .then((c) => c > 0)
            .catch(() => false),
        10000,
      );
      await poll(
        () =>
          frame9
            .evaluate(() => {
              const img = document.getElementById("logo");
              return img && img.complete && img.naturalWidth > 0;
            })
            .catch(() => false),
        10000,
      );
      await sleep(1200);
    }
    await shot(page, "09-about");
    await closeDialog(page);

    console.log("\n✅ All done!");
  } catch (e) {
    console.error("\n❌ Error:", e.message);
    await shot(page, "XX-error-state");
  } finally {
    await sleep(2000);
    const videoPath = await page.video()?.path();
    await context.close();
    await browser.close();
    if (videoPath) {
      const dest = path.join(SCREENSHOTS_DIR, "demo-recording.webm");
      try {
        fs.renameSync(videoPath, dest);
        console.log(`🎬 Video saved: ${dest}`);
      } catch {
        console.log("Video file not found.");
      }
    }
    console.log("Browser closed.");
  }
})();
