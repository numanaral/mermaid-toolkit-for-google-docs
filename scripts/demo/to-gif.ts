/**
 * Generate optimized GIFs directly from the demo recording using timestamps.
 * Cuts and converts in a single pass -- no intermediate clips needed.
 *
 * Usage:
 *   yarn demo:gif                   # auto-detect timestamps + video
 *   yarn demo:gif <specific.webm>   # convert a specific clip file
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const GIF_WIDTH = 720;
const GIF_FPS = 12;
const SCREENSHOTS_DIR = path.resolve("temp/demo");

interface StepTimestamp {
  step: number;
  name: string;
  startMs: number;
  endMs: number;
}

interface TrimOffset {
  name?: string;
  trimStartMs: number;
  trimEndMs: number;
}

const DEFAULT_TRIM: TrimOffset = { trimStartMs: 500, trimEndMs: 300 };

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

const loadTrimOffsets = (): Record<string, TrimOffset> => {
  const offsetPath = path.join(__dirname, "trim-offsets.json");
  if (!fs.existsSync(offsetPath)) return {};
  return JSON.parse(fs.readFileSync(offsetPath, "utf8"));
};

const msToSec = (ms: number): string => (Math.max(0, ms) / 1000).toFixed(3);

const convertSingleFile = (webmPath: string, outDir: string): void => {
  const base = path.basename(webmPath, ".webm");
  const gifPath = path.join(outDir, `${base}.gif`);
  const palettePath = path.join(outDir, `_palette_${base}.png`);

  console.log(`  ${base}.webm -> ${base}.gif`);

  execSync(
    `ffmpeg -y -i "${webmPath}" -vf "fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff" "${palettePath}"`,
    { stdio: "pipe" },
  );
  execSync(
    `ffmpeg -y -i "${webmPath}" -i "${palettePath}" -lavfi "fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "${gifPath}"`,
    { stdio: "pipe" },
  );
  fs.unlinkSync(palettePath);
  console.log(
    `    -> ${(fs.statSync(gifPath).size / (1024 * 1024)).toFixed(1)} MB`,
  );
};

const convertFromVideo = (
  videoFile: string,
  startSec: string,
  durationSec: string,
  gifPath: string,
  label: string,
): void => {
  const palettePath = gifPath.replace(/\.gif$/, "_palette.png");

  console.log(`  ${label} (${durationSec}s)`);

  execSync(
    `ffmpeg -y -ss ${startSec} -t ${durationSec} -i "${videoFile}" -vf "fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff" "${palettePath}"`,
    { stdio: "pipe" },
  );
  execSync(
    `ffmpeg -y -ss ${startSec} -t ${durationSec} -i "${videoFile}" -i "${palettePath}" -lavfi "fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "${gifPath}"`,
    { stdio: "pipe" },
  );
  fs.unlinkSync(palettePath);
  console.log(
    `    -> ${(fs.statSync(gifPath).size / (1024 * 1024)).toFixed(1)} MB`,
  );
};

const main = (): void => {
  const specificFile = process.argv[2];

  if (
    specificFile &&
    fs.existsSync(specificFile) &&
    specificFile.endsWith(".webm")
  ) {
    convertSingleFile(specificFile, path.dirname(specificFile));
    return;
  }

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
  const trimOffsets = loadTrimOffsets();
  const gifDir = path.resolve("temp/demo/gifs");
  fs.mkdirSync(gifDir, { recursive: true });

  console.log(
    `Generating ${timestamps.length} GIFs from ${path.basename(videoFile)}...\n`,
  );

  for (const ts of timestamps) {
    const stepLabel = String(ts.step).padStart(2, "0");
    const cleanName = ts.name
      .replace(/^step\d+/, "")
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "");
    const gifPath = path.join(
      gifDir,
      `${stepLabel}-${cleanName || "step"}.gif`,
    );

    const trim = trimOffsets[String(ts.step)] ?? DEFAULT_TRIM;
    const actualStartMs = ts.startMs + trim.trimStartMs;
    const actualEndMs = ts.endMs - trim.trimEndMs;
    const durationMs = Math.max(0, actualEndMs - actualStartMs);

    convertFromVideo(
      videoFile,
      msToSec(actualStartMs),
      msToSec(durationMs),
      gifPath,
      `[${stepLabel}] ${trim.name || ts.name}`,
    );
  }

  console.log(`\nDone! ${timestamps.length} GIFs saved to ${gifDir}/`);
};

main();
