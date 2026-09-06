import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDirectory = path.join(frontendRoot, "dist", "assets");
const indexHtmlPath = path.join(frontendRoot, "dist", "index.html");
const largestChunkBudget = 700 * 1024;
const totalJavaScriptBudget = 2500 * 1024;

if (!fs.existsSync(assetsDirectory)) {
  console.error("Bundle budget check requires a completed Vite build in dist/assets.");
  process.exit(1);
}

const chunks = fs
  .readdirSync(assetsDirectory)
  .filter(fileName => fileName.endsWith(".js"))
  .map(fileName => ({ fileName, bytes: fs.statSync(path.join(assetsDirectory, fileName)).size }))
  .sort((left, right) => right.bytes - left.bytes);

const largestChunk = chunks[0];
const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
const problems = [];
const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");
const entryPath = indexHtml.match(/<script[^>]+src="([^"]+)"/u)?.[1];
const entrySource = entryPath ? fs.readFileSync(path.join(frontendRoot, "dist", entryPath), "utf8") : "";

if (!largestChunk) problems.push("No JavaScript chunks were emitted.");
if (largestChunk && largestChunk.bytes > largestChunkBudget) {
  problems.push(
    `Largest chunk ${largestChunk.fileName} is ${formatKiB(largestChunk.bytes)}; budget is ${formatKiB(largestChunkBudget)}.`,
  );
}
if (totalBytes > totalJavaScriptBudget) {
  problems.push(`Total JavaScript is ${formatKiB(totalBytes)}; budget is ${formatKiB(totalJavaScriptBudget)}.`);
}
if (!entryPath) problems.push("Vite entry script was not found in dist/index.html.");
if (entrySource.includes("items_cache") || entrySource.includes("OPFS database constructor is unavailable")) {
  problems.push(
    "The initial application entry eagerly contains the offline SQLite runtime; load it after authentication.",
  );
}

if (problems.length > 0) {
  console.error("Bundle budget check failed:\n");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(
  `Bundle budget passed: ${formatKiB(totalBytes)} total; largest chunk ${largestChunk.fileName} is ${formatKiB(largestChunk.bytes)}.`,
);

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
