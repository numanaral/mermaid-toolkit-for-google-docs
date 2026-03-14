import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SRC = "src/gas";
const DIST = "dist/gas";
const TMP = ".gas-build-tmp";

const DIALOG_NAME_MAP: Record<string, string> = {
  about: "About",
  convert: "Convert",
  editor: "Editor",
  extract: "Extract",
  fixmarkdown: "FixMarkdown",
  preview: "Preview",
  quickguide: "QuickGuide",
};

const clean = (): void => {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.mkdirSync(path.join(TMP, "css"), { recursive: true });
  fs.mkdirSync(path.join(TMP, "js"), { recursive: true });
};

const buildServer = (): void => {
  console.log("==> Compiling server TypeScript...");

  // GAS requires top-level function declarations. esbuild tree-shakes
  // unexported/unused code, so we create a temporary wrapper that
  // re-exports everything from Code.ts as a side-effecting assignment
  // to a global object, preventing tree-shaking.
  const absCodePath = path.resolve(SRC, "server/Code.ts").replace(/\\/g, "/");
  const entryContent = [
    `import * as Code from "${absCodePath}";`,
    `(globalThis as any).__gas = Code;`,
  ].join("\n");

  const entryFile = path.join(TMP, "_gas_entry.ts");
  fs.writeFileSync(entryFile, entryContent);

  execSync(
    `npx esbuild ${entryFile} ` +
      `--bundle --outfile=${TMP}/Code.js --format=iife ` +
      `--target=es2020 --platform=neutral`,
    { stdio: "inherit" },
  );

  let bundled = fs.readFileSync(path.join(TMP, "Code.js"), "utf8");

  // Strip the IIFE wrapper esbuild generates:
  //   "use strict";
  //   (() => {
  //     ...code...
  //   })();
  bundled = bundled
    .replace(/^"use strict";\n/, "")
    .replace(/^\(\(\) => \{\n/, "")
    .replace(/\n\}\)\(\);\n?$/, "\n");

  // Remove 2-space indentation that esbuild adds inside the IIFE
  bundled = bundled.replace(/^  /gm, "");

  // Remove esbuild's module system boilerplate (not needed in GAS).
  bundled = bundled.replace(/^var __defProp = .*;\n/m, "");
  bundled = bundled.replace(
    /^var __export = \(target, all\) => \{[\s\S]*?\};\n/m,
    "",
  );
  bundled = bundled.replace(/^var \w+_exports = \{\};\n/m, "");
  bundled = bundled.replace(/^__export\(\w+_exports, \{[\s\S]*?\}\);\n/m, "");

  // Remove the globalThis assignment and entry file comment
  bundled = bundled.replace(/^\s*\(?globalThis\)?\.?__gas\s*=.*\n?/m, "");
  bundled = bundled.replace(/^\/\/ \.gas-build-tmp\/.*\n?/gm, "");

  // Convert arrow/const functions to GAS-compatible function declarations.
  bundled = bundled.replace(
    /(?:var|const|let)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g,
    (_match: string, name: string, params: string) => {
      return `function ${name}(${params}) {`;
    },
  );
  bundled = bundled.replace(
    /(?:var|const|let)\s+(\w+)\s*=\s*function\s*\(([^)]*)\)\s*\{/g,
    (_match: string, name: string, params: string) => {
      return `function ${name}(${params}) {`;
    },
  );

  bundled = bundled.replace(/\n{3,}/g, "\n\n").trim();

  fs.writeFileSync(path.join(DIST, "Code.gs"), bundled + "\n");
  console.log("    Code.ts -> Code.gs");
};

const buildDialogStyles = (): void => {
  console.log("==> Compiling dialog SCSS...");

  const dialogsDir = path.join(SRC, "dialogs");
  for (const name of fs.readdirSync(dialogsDir)) {
    const scssFile = path.join(dialogsDir, name, `${name}.scss`);
    if (!fs.existsSync(scssFile)) continue;

    const outFile = path.join(TMP, "css", `${name}.css`);
    execSync(
      `npx sass "${scssFile}" "${outFile}" --style=compressed --no-source-map`,
      { stdio: "inherit" },
    );
    console.log(`    ${name}.scss -> ${name}.css`);
  }
};

const buildDialogScripts = (): void => {
  console.log("==> Bundling dialog TypeScript...");

  const dialogsDir = path.join(SRC, "dialogs");
  for (const name of fs.readdirSync(dialogsDir)) {
    const tsFile = path.join(dialogsDir, name, `${name}.ts`);
    if (!fs.existsSync(tsFile)) {
      fs.writeFileSync(path.join(TMP, "js", `${name}.js`), "");
      continue;
    }

    const content = fs.readFileSync(tsFile, "utf8");
    const hasCode =
      /^\s*(import|export|const|let|var|function|class|async)/m.test(content);

    if (hasCode) {
      const outFile = path.join(TMP, "js", `${name}.js`);
      execSync(
        `npx esbuild "${tsFile}" --bundle --outfile="${outFile}" ` +
          `--format=iife --target=es2020 --minify`,
        { stdio: "inherit" },
      );
      console.log(`    ${name}.ts -> ${name}.js`);
    } else {
      fs.writeFileSync(path.join(TMP, "js", `${name}.js`), "");
    }
  }
};

const assembleDialogs = (): void => {
  console.log("==> Assembling HTML dialogs...");

  const footerHtml = fs
    .readFileSync(path.join(SRC, "shared/templates/footer.html"), "utf8")
    .trim();

  const dialogsDir = path.join(SRC, "dialogs");
  for (const name of fs.readdirSync(dialogsDir)) {
    const htmlFile = path.join(dialogsDir, name, `${name}.html`);
    if (!fs.existsSync(htmlFile)) continue;

    const gasName = DIALOG_NAME_MAP[name];
    if (!gasName) {
      console.warn(
        `    WARNING: No GAS name mapping for dialog "${name}", skipping.`,
      );
      continue;
    }

    let html = fs.readFileSync(htmlFile, "utf8");

    const cssFile = path.join(TMP, "css", `${name}.css`);
    const jsFile = path.join(TMP, "js", `${name}.js`);

    const css = fs.existsSync(cssFile)
      ? fs.readFileSync(cssFile, "utf8").trim()
      : "";
    const js = fs.existsSync(jsFile)
      ? fs.readFileSync(jsFile, "utf8").trim()
      : "";

    html = html.replace("/* BUILD:INLINE_CSS */", css);
    html = html.replace("/* BUILD:INLINE_JS */", js);
    html = html.replace("<!-- BUILD:FOOTER -->", footerHtml);

    fs.writeFileSync(path.join(DIST, `${gasName}.html`), html);
    console.log(`    ${name}.html -> ${gasName}.html`);
  }
};

const copyManifest = (): void => {
  console.log("==> Copying appsscript.json...");
  fs.copyFileSync(
    path.join(SRC, "appsscript.json"),
    path.join(DIST, "appsscript.json"),
  );
};

const main = (): void => {
  console.log("Building GAS add-on...\n");

  clean();
  buildServer();
  buildDialogStyles();
  buildDialogScripts();
  assembleDialogs();
  copyManifest();

  fs.rmSync(TMP, { recursive: true, force: true });

  console.log("\n==> Build complete! Output:");
  for (const f of fs.readdirSync(DIST).sort()) {
    const stat = fs.statSync(path.join(DIST, f));
    const kb = (stat.size / 1024).toFixed(1);
    console.log(`    ${f} (${kb} KB)`);
  }
};

main();
