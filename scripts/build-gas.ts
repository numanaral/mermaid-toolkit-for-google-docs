import * as esbuild from "esbuild";
import * as sass from "sass";
import fs from "fs";
import path from "path";

const SRC = "src/gas";
const DIST = "dist/gas";
const TMP = ".gas-build-tmp";

const DIALOG_NAME_MAP: Record<string, string> = {
  about: "About",
  convert: "Convert",
  devtools: "DevTools",
  editdiagrams: "EditDiagrams",
  editor: "Editor",
  exportmd: "ExportMarkdown",
  extract: "Extract",
  fixmarkdown: "FixMarkdown",
  importmd: "ImportMarkdown",
  preview: "Preview",
  quickguide: "QuickGuide",
};

const clean = (): void => {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
};

const buildServer = async (): Promise<void> => {
  console.log("==> Compiling server TypeScript...");

  const absCodePath = path.resolve(SRC, "server/Code.ts").replace(/\\/g, "/");
  const entryContent = [
    `import * as Code from "${absCodePath}";`,
    `(globalThis as any).__gas = Code;`,
  ].join("\n");

  const entryFile = path.join(TMP, "_gas_entry.ts");
  fs.writeFileSync(entryFile, entryContent);

  await esbuild.build({
    entryPoints: [entryFile],
    bundle: true,
    outfile: path.join(TMP, "Code.js"),
    format: "iife",
    target: "es2020",
    platform: "neutral",
  });

  let bundled = fs.readFileSync(path.join(TMP, "Code.js"), "utf8");

  bundled = bundled
    .replace(/^"use strict";\n/, "")
    .replace(/^\(\(\) => \{\n/, "")
    .replace(/\n\}\)\(\);\n?$/, "\n");

  bundled = bundled.replace(/^  /gm, "");

  bundled = bundled.replace(/^var __defProp = .*;\n/m, "");
  bundled = bundled.replace(
    /^var __export = \(target, all\) => \{[\s\S]*?\};\n/m,
    "",
  );
  bundled = bundled.replace(/^var \w+_exports = \{\};\n/m, "");
  bundled = bundled.replace(/^__export\(\w+_exports, \{[\s\S]*?\}\);\n/m, "");

  bundled = bundled.replace(/^\s*\(?globalThis\)?\.?__gas\s*=.*\n?/m, "");
  bundled = bundled.replace(/^\/\/ \.gas-build-tmp\/.*\n?/gm, "");

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

interface DialogAssets {
  name: string;
  css: string;
  js: string;
}

const buildDialogs = async (): Promise<DialogAssets[]> => {
  console.log("==> Compiling dialogs (SCSS + TS in parallel)...");

  const dialogsDir = path.join(SRC, "dialogs");
  const dialogNames = fs.readdirSync(dialogsDir).filter((name) => {
    return fs.statSync(path.join(dialogsDir, name)).isDirectory();
  });

  const results = await Promise.all(
    dialogNames.map(async (name): Promise<DialogAssets> => {
      let css = "";
      let js = "";

      const scssFile = path.join(dialogsDir, name, `${name}.scss`);
      const tsFile = path.join(dialogsDir, name, `${name}.ts`);

      const tasks: Promise<void>[] = [];

      if (fs.existsSync(scssFile)) {
        tasks.push(
          (async () => {
            const result = sass.compile(scssFile, {
              style: "compressed",
              sourceMap: false,
            });
            css = result.css.replace(/^\uFEFF/, "");
            console.log(`    ${name}.scss -> css`);
          })(),
        );
      }

      if (fs.existsSync(tsFile)) {
        const content = fs.readFileSync(tsFile, "utf8");
        const hasCode =
          /^\s*(import|export|const|let|var|function|class|async)/m.test(
            content,
          );

        if (hasCode) {
          tasks.push(
            (async () => {
              const result = await esbuild.build({
                entryPoints: [tsFile],
                bundle: true,
                write: false,
                format: "iife",
                target: "es2020",
                minify: true,
              });
              js = result.outputFiles![0].text;
              console.log(`    ${name}.ts -> js`);
            })(),
          );
        }
      }

      await Promise.all(tasks);
      return { name, css, js };
    }),
  );

  return results;
};

const getBuildVersion = (): string => {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `.${pad(now.getHours())}${pad(now.getMinutes())}`
  );
};

const getPackageVersion = (): string => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  return pkg.version || "0.0.0";
};

const assembleDialogs = (assets: DialogAssets[]): void => {
  console.log("==> Assembling HTML dialogs...");

  const footerHtml = fs
    .readFileSync(path.join(SRC, "shared/templates/footer.html"), "utf8")
    .trim();
  const version = getPackageVersion();

  const dialogsDir = path.join(SRC, "dialogs");
  for (const { name, css, js } of assets) {
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

    html = html.replace("/* BUILD:INLINE_CSS */", css);
    const safeJs = js.replace(/<\//g, "<\\/").replace(/<!--/g, "<\\!--");
    html = html.replace("/* BUILD:INLINE_JS */", safeJs);
    html = html.replace("<!-- BUILD:FOOTER -->", footerHtml);
    html = html.replace("<!-- BUILD:VERSION -->", version);

    fs.writeFileSync(path.join(DIST, `${gasName}.html`), html);
    console.log(`    ${name}.html -> ${gasName}.html`);
  }
};

const copyManifest = (): void => {
  fs.copyFileSync(
    path.join(SRC, "appsscript.json"),
    path.join(DIST, "appsscript.json"),
  );
  console.log("==> Copied appsscript.json");
};

const stampVersion = (): void => {
  const version = getBuildVersion();
  const codeFile = path.join(DIST, "Code.gs");
  let code = fs.readFileSync(codeFile, "utf8");
  code = code.replace('"Mermaid Toolkit"', `"Mermaid Toolkit (v${version})"`);
  fs.writeFileSync(codeFile, code);
  console.log(`==> Stamped build version: ${version}`);
};

const main = async (): Promise<void> => {
  const t0 = Date.now();
  console.log("Building GAS add-on...\n");

  clean();

  const [, dialogAssets] = await Promise.all([buildServer(), buildDialogs()]);

  assembleDialogs(dialogAssets);
  stampVersion();
  copyManifest();

  fs.rmSync(TMP, { recursive: true, force: true });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`\n==> Build complete in ${elapsed}s! Output:`);
  for (const f of fs.readdirSync(DIST).sort()) {
    const stat = fs.statSync(path.join(DIST, f));
    const kb = (stat.size / 1024).toFixed(1);
    console.log(`    ${f} (${kb} KB)`);
  }
};

main();
