import { execSync } from "child_process";

const run = (cmd: string, label: string): void => {
  console.log(`==> ${label}...`);
  execSync(cmd, { stdio: "inherit" });
};

const t0 = Date.now();

run("eslint . --fix", "Lint (fix)");
run("tsx scripts/typecheck.ts", "Typecheck");

const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
console.log(`\n==> Verify (fix) passed in ${elapsed}s`);
