/**
 * Generate a combined demo GIF from the full recording, skipping the reset step.
 * Uses the same timestamp logic as site-video.ts but outputs an optimized GIF.
 *
 * Usage: yarn demo:demo-gif
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SCREENSHOTS_DIR = path.resolve("temp/demo");
const SITE_ASSETS = path.resolve("site/assets/demo");
const GIF_WIDTH = 720;
const GIF_FPS = 10;

interface StepTimestamp {
  step: number;
  name: string;
  startMs: number;
  endMs: number;
}

const findLatestTimestamps = (): string => {
  const files = fs
    .readdirSync(SCREENSHOTS_DIR)
    .filter((f) => f.startsWith("demo-") && f.endsWith("-timestamps.json"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(SCREENSHOTS_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) {
    console.error("No timestamps found in temp/demo/");
    process.exit(1);
  }
  return path.join(SCREENSHOTS_DIR, files[0].name);
};

const main = (): void => {
  const tsFile = findLatestTimestamps();
  const videoFile = path.join(SCREENSHOTS_DIR, "demo-recording.webm");
  if (!fs.existsSync(videoFile)) {
    console.error(
      "No demo-recording.webm found. Run 'yarn demo:record' first.",
    );
    process.exit(1);
  }

  const timestamps: StepTimestamp[] = JSON.parse(
    fs.readFileSync(tsFile, "utf8"),
  );
  const step1 = timestamps.find((t) => t.step === 1);
  const lastStep = timestamps[timestamps.length - 1];
  if (!step1 || !lastStep) {
    console.error("Could not find step 1 or last step in timestamps.");
    process.exit(1);
  }

  const startSec = (step1.startMs / 1000).toFixed(3);
  const durationSec = ((lastStep.endMs - 200 - step1.startMs) / 1000).toFixed(
    3,
  );
  const outFile = path.join(SITE_ASSETS, "demo.gif");
  const palettePath = path.join(SCREENSHOTS_DIR, "_demo_palette.png");

  console.log(
    `Generating demo GIF: start=${startSec}s, duration=${durationSec}s`,
  );
  console.log(`Skipping step 0 (reset)`);
  console.log(`Settings: ${GIF_WIDTH}px wide, ${GIF_FPS}fps\n`);

  const filters = `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`;

  execSync(
    `ffmpeg -y -ss ${startSec} -t ${durationSec} -i "${videoFile}" -vf "${filters},palettegen=stats_mode=diff" "${palettePath}"`,
    { stdio: "pipe" },
  );
  execSync(
    `ffmpeg -y -ss ${startSec} -t ${durationSec} -i "${videoFile}" -i "${palettePath}" -lavfi "${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "${outFile}"`,
    { stdio: "pipe" },
  );

  fs.unlinkSync(palettePath);

  const sizeMB = (fs.statSync(outFile).size / (1024 * 1024)).toFixed(1);
  console.log(`Done! Demo GIF saved to ${outFile} (${sizeMB} MB)`);
};

main();
