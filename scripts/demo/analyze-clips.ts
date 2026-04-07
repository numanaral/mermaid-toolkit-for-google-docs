/**
 * Analyze demo recording vs timestamps to diagnose GIF timing drift.
 *
 * Usage:
 *   tsx scripts/demo/analyze-clips.ts [timestamps.json] [video.webm]
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

const SCREENSHOTS_DIR = path.resolve("temp/demo");

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

const probe = (file: string): number => {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`,
      { encoding: "utf8" },
    ).trim();
    return parseFloat(out) * 1000;
  } catch {
    return -1;
  }
};

const getKeyframes = (file: string): number[] => {
  try {
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries packet=pts_time,flags -of csv=p=0 "${file}" | grep ",K"`,
      { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
    );
    return out
      .split("\n")
      .filter(Boolean)
      .map((l) => parseFloat(l.split(",")[0]) * 1000);
  } catch {
    return [];
  }
};

const main = (): void => {
  const tsFile = process.argv[2] || findLatestTimestamps();
  const videoFile =
    process.argv[3] || path.join(SCREENSHOTS_DIR, "demo-recording.webm");

  if (!fs.existsSync(tsFile) || !fs.existsSync(videoFile)) {
    console.error(
      `File not found: ${!fs.existsSync(tsFile) ? tsFile : videoFile}`,
    );
    process.exit(1);
  }

  const timestamps: StepTimestamp[] = JSON.parse(
    fs.readFileSync(tsFile, "utf8"),
  );
  const videoDurationMs = probe(videoFile);
  const keyframes = getKeyframes(videoFile);

  console.log(`\nVideo: ${videoFile}`);
  console.log(`Duration: ${(videoDurationMs / 1000).toFixed(1)}s`);
  console.log(`Keyframes: ${keyframes.length} found\n`);

  const header = [
    "Step".padEnd(6),
    "Name".padEnd(22),
    "Start(s)".padStart(9),
    "End(s)".padStart(9),
    "Expected".padStart(9),
    "PrevKF".padStart(9),
    "KF-Delta".padStart(9),
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const ts of timestamps) {
    const expectedDur = (ts.endMs - ts.startMs) / 1000;
    const prevKf = keyframes.filter((k) => k <= ts.startMs).pop() ?? 0;
    const kfDelta = (ts.startMs - prevKf) / 1000;

    console.log(
      [
        String(ts.step).padEnd(6),
        ts.name.padEnd(22),
        (ts.startMs / 1000).toFixed(1).padStart(9),
        (ts.endMs / 1000).toFixed(1).padStart(9),
        `${expectedDur.toFixed(1)}s`.padStart(9),
        (prevKf / 1000).toFixed(1).padStart(9),
        `${kfDelta.toFixed(1)}s`.padStart(9),
      ].join("  "),
    );
  }

  console.log(
    "\nKF-Delta = how many seconds before the step start the nearest keyframe is.",
  );
  console.log(
    "With -c copy, ffmpeg snaps to PrevKF, so each clip bleeds KF-Delta seconds of the previous step.\n",
  );
};

main();
