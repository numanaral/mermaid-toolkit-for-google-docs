import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const CHANGELOG_PATH = path.resolve(__dirname, "../../CHANGELOG.md");

interface ChangelogVersion {
  version: string;
  date: string;
  tagline: string;
  id: string;
  html: string;
}

interface ChangelogData {
  intro: string;
  versions: ChangelogVersion[];
}

interface VersionBlock {
  rawTitle: string;
  bodyLines: string[];
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/\./g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const parseTitle = (
  raw: string,
): { version: string; date: string; tagline: string } => {
  const match = raw.match(
    /^\[([^\]]+)\](?:\s*[-—:]\s*(.+?))?(?:\s*\(([^)]+)\))?\s*$/,
  );
  if (!match) return { version: raw.trim(), date: "", tagline: "" };
  const version = match[1].trim();
  const rest = (match[2] || "").trim();
  const parenDate = (match[3] || "").trim();
  const dateMatch = rest.match(/^(\d{4}-\d{2}-\d{2})(?:\s*[-—:]\s*)?(.*)$/);
  if (dateMatch) {
    return { version, date: dateMatch[1], tagline: dateMatch[2].trim() };
  }
  return { version, date: parenDate, tagline: rest };
};

export default async (): Promise<ChangelogData> => {
  if (!fs.existsSync(CHANGELOG_PATH)) return { intro: "", versions: [] };

  const raw = fs.readFileSync(CHANGELOG_PATH, "utf8");
  const lines = raw.split("\n");

  const introLines: string[] = [];
  const versionBlocks: VersionBlock[] = [];
  let current: VersionBlock | null = null;
  let inRefs = false;

  for (const line of lines) {
    if (/^\[v[^\]]+\]:\s/.test(line)) {
      inRefs = true;
      continue;
    }
    if (inRefs) continue;

    const versionMatch = line.match(/^##\s+(.+)$/);
    if (versionMatch) {
      if (current) versionBlocks.push(current);
      current = { rawTitle: versionMatch[1], bodyLines: [] };
      continue;
    }

    if (current) {
      current.bodyLines.push(line);
    } else if (!/^#\s/.test(line)) {
      introLines.push(line);
    }
  }
  if (current) versionBlocks.push(current);

  const versions: ChangelogVersion[] = versionBlocks.map((block) => {
    const { version, date, tagline } = parseTitle(block.rawTitle);
    const body = block.bodyLines.join("\n").trim();
    const html = marked.parse(body, { breaks: false }) as string;
    return {
      version,
      date,
      tagline,
      id: slugify(version),
      html,
    };
  });

  const intro = introLines.join("\n").trim();
  return {
    intro: intro ? (marked.parse(intro) as string) : "",
    versions,
  };
};
