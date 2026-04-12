/**
 * Split a full demo recording into per-step clips using ffmpeg.
 * Uses re-encoding for frame-accurate cuts and per-step trim offsets.
 *
 * Usage:
 *   tsx scripts/demo/split-clips.ts [timestamps-json] [video-file]
 *
 * When no args are given, auto-detects the latest timestamps JSON
 * and demo-recording.webm from temp/demo/.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

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

const SCREENSHOTS_DIR = path.resolve("temp/demo");
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

const msToTimecode = (ms: number): string => {
  const totalSec = Math.max(0, ms) / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
};

const loadTrimOffsets = (): Record<string, TrimOffset> => {
  const offsetPath = path.join(__dirname, "trim-offsets.json");
  if (!fs.existsSync(offsetPath)) return {};
  return JSON.parse(fs.readFileSync(offsetPath, "utf8"));
};

const main = (): void => {
  const tsFile = process.argv[2] || findLatestTimestamps();
  const videoFile =
    process.argv[3] || path.join(SCREENSHOTS_DIR, "demo-recording.webm");

  if (!fs.existsSync(tsFile)) {
    console.error(`Timestamps file not found: ${tsFile}`);
    process.exit(1);
  }
  if (!fs.existsSync(videoFile)) {
    console.error(`Video file not found: ${videoFile}`);
    process.exit(1);
  }

  const timestamps: StepTimestamp[] = JSON.parse(
    fs.readFileSync(tsFile, "utf8"),
  );
  const trimOffsets = loadTrimOffsets();
  const outDir = path.join(path.dirname(videoFile), "clips");
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Splitting ${timestamps.length} steps from ${videoFile}...`);
  console.log(
    `Trim offsets: ${Object.keys(trimOffsets).length} custom, rest use defaults\n`,
  );

  for (const ts of timestamps) {
    const stepLabel = String(ts.step).padStart(2, "0");
    const trim = trimOffsets[String(ts.step)] ?? DEFAULT_TRIM;
    const clipName = trim.name || ts.name;
    const outFile = path.join(outDir, `${clipName}.webm`);

    const actualStart = ts.startMs + trim.trimStartMs;
    const actualEnd = ts.endMs - trim.trimEndMs;
    const durationMs = Math.max(0, actualEnd - actualStart);

    const start = msToTimecode(actualStart);
    const duration = msToTimecode(durationMs);

    console.log(
      `  [${stepLabel}] ${clipName}: ${start} (${(durationMs / 1000).toFixed(1)}s) [trim +${trim.trimStartMs}ms / -${trim.trimEndMs}ms]`,
    );

    execSync(
      `ffmpeg -y -ss ${start} -i "${videoFile}" -t ${duration} -c:v libvpx-vp9 -crf 30 -b:v 0 -an "${outFile}"`,
      { stdio: "pipe" },
    );
  }

  console.log(`\nDone! ${timestamps.length} clips saved to ${outDir}/`);
};

main();
