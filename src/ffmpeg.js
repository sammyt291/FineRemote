const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

let cachedStatus;

function getFfmpegStatus() {
  if (cachedStatus) return cachedStatus;

  const candidates = [
    process.env.FFMPEG_PATH,
    safelyLoadBundledFfmpeg(),
    "ffmpeg",
  ].filter(Boolean);

  for (const executable of candidates) {
    if (executable !== "ffmpeg" && !fs.existsSync(executable)) continue;
    try {
      const versionLine = execFileSync(executable, ["-version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).split("\n")[0];
      cachedStatus = { available: true, path: executable, version: versionLine };
      return cachedStatus;
    } catch {
      // Try the next source. ffmpeg-static is downloaded automatically by npm.
    }
  }

  cachedStatus = { available: false, path: null, version: null };
  return cachedStatus;
}

function safelyLoadBundledFfmpeg() {
  try {
    return require("ffmpeg-static");
  } catch {
    return null;
  }
}

module.exports = { getFfmpegStatus };
