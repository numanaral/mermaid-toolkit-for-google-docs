import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SRC = "src/gas";
const DEBOUNCE_MS = 500;

let timeout: ReturnType<typeof setTimeout> | null = null;
let building = false;

const rebuild = (): void => {
  if (building) return;
  building = true;
  console.log("\n[dev-gas] Rebuilding...\n");
  try {
    execSync("npx tsx scripts/build-gas.ts", { stdio: "inherit" });
    console.log("\n[dev-gas] Ready. Watching for changes...");
  } catch {
    console.error("\n[dev-gas] Build failed. Watching for changes...");
  }
  building = false;
};

const scheduleRebuild = (filename?: string): void => {
  if (filename) console.log(`[dev-gas] Changed: ${filename}`);
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(rebuild, DEBOUNCE_MS);
};

rebuild();

console.log(`[dev-gas] Watching ${SRC}/ for changes...`);
console.log("[dev-gas] Press Ctrl+C to stop.\n");

const watchDirs = ["server", "dialogs", "shared"];
for (const sub of watchDirs) {
  const dir = path.join(SRC, sub);
  if (!fs.existsSync(dir)) continue;

  try {
    fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      scheduleRebuild(path.join(sub, filename));
    });
  } catch {
    console.warn(`[dev-gas] Could not watch ${dir}.`);
  }
}
