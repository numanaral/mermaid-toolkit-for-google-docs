import { execSync } from "child_process";
import fs from "fs";

const TSCONFIGS = [
  "src/gas/server/tsconfig.json",
  "src/gas/tsconfig.dialogs.json",
];

let ok = true;

for (const tsconfig of TSCONFIGS) {
  if (!fs.existsSync(tsconfig)) continue;

  console.log(`==> tsc --noEmit -p ${tsconfig}`);
  try {
    execSync(`tsc --noEmit -p ${tsconfig}`, { stdio: "inherit" });
  } catch {
    ok = false;
  }
}

if (!ok) process.exit(1);
