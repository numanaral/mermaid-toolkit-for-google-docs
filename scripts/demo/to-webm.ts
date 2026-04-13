/**
 * Generate optimized WebM clips for the site from the demo recording.
 * Same timestamp/trim logic as to-gif.ts but outputs VP9 WebM.
 *
 * Usage:
 *   yarn demo:webm                   # auto-detect timestamps + video
 *   yarn demo:webm <specific.webm>   # re-encode a specific clip file
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const CLIP_WIDTH = 720;
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

const encodeSingleFile = (webmPath: string, outDir: string): void => {
  const base = path.basename(webmPath, ".webm");
  const outFile = path.join(outDir, `${base}.webm`);

  console.log(`  ${base}.webm -> ${base}.webm (re-encode)`);

  execSync(
    `ffmpeg -y -i "${webmPath}" -c:v libvpx-vp9 -crf 40 -b:v 0 -vf "scale=${CLIP_WIDTH}:-1" -an "${outFile}"`,
    { stdio: "pipe" },
  );
  console.log(
    `    -> ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`,
  );
};

const encodeFromVideo = (
  videoFile: string,
  startSec: string,
  durationSec: string,
  outFile: string,
  label: string,
): void => {
  console.log(`  ${label} (${durationSec}s)`);

  execSync(
    `ffmpeg -y -ss ${startSec} -t ${durationSec} -i "${videoFile}" -c:v libvpx-vp9 -crf 40 -b:v 0 -vf "scale=${CLIP_WIDTH}:-1" -an "${outFile}"`,
    { stdio: "pipe" },
  );
  console.log(
    `    -> ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`,
  );
};

const main = (): void => {
  const specificFile = process.argv[2];

  if (
    specificFile &&
    fs.existsSync(specificFile) &&
    specificFile.endsWith(".webm")
  ) {
    encodeSingleFile(specificFile, path.dirname(specificFile));
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
  const clipDir = path.resolve("site/assets/clips");
  fs.mkdirSync(clipDir, { recursive: true });

  console.log(
    `Generating ${timestamps.length} WebM clips from ${path.basename(videoFile)}...\n`,
  );

  for (const ts of timestamps) {
    const stepLabel = String(ts.step).padStart(2, "0");
    const trim = trimOffsets[String(ts.step)] ?? DEFAULT_TRIM;
    const clipName = trim.name || ts.name;
    const outFile = path.join(clipDir, `${clipName}.webm`);

    const actualStartMs = ts.startMs + trim.trimStartMs;
    const actualEndMs = ts.endMs - trim.trimEndMs;
    const durationMs = Math.max(0, actualEndMs - actualStartMs);

    encodeFromVideo(
      videoFile,
      msToSec(actualStartMs),
      msToSec(durationMs),
      outFile,
      `[${stepLabel}] ${clipName}`,
    );
  }

  console.log(`\nDone! ${timestamps.length} WebM clips saved to ${clipDir}/`);
};

main();
