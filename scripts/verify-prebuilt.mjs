import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "target", "wasm32v1-none", "release");
const prebuilt = path.join(root, "prebuilt");

function canonicalizeWasm(data) {
  const normalized = data
    .toString("latin1")
    .replace(/(?:[A-Za-z0-9_.-]+[\\/])+[A-Za-z0-9_.-]+\.rs/g, (sourcePath) => sourcePath.replaceAll("\\", "/"));
  return Buffer.from(normalized, "latin1");
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function firstDifference(left, right) {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? -1 : limit;
}

const artifacts = readdirSync(prebuilt)
  .filter((file) => file.endsWith(".wasm"))
  .sort();

if (artifacts.length === 0) {
  throw new Error("no committed prebuilt WASM artifacts found");
}

for (const artifact of artifacts) {
  const crate = artifact.slice(0, -5).replaceAll("-", "_");
  const freshPath = path.join(target, `${crate}.wasm`);
  const prebuiltPath = path.join(prebuilt, artifact);
  if (!existsSync(freshPath)) {
    throw new Error(`missing source-built WASM: ${freshPath}`);
  }

  const fresh = canonicalizeWasm(readFileSync(freshPath));
  const committed = canonicalizeWasm(readFileSync(prebuiltPath));
  if (!fresh.equals(committed)) {
    const offset = firstDifference(fresh, committed);
    const windowStart = Math.max(0, offset - 32);
    const windowEnd = Math.min(Math.max(fresh.length, committed.length), offset + 96);
    const freshWindow = fresh.subarray(windowStart, windowEnd).toString("latin1");
    const committedWindow = committed.subarray(windowStart, windowEnd).toString("latin1");
    throw new Error(
      `source-built WASM does not match committed artifact: ${artifact}; ` +
        `freshSha256=${sha256(fresh)} committedSha256=${sha256(committed)} ` +
        `firstDifference=${offset} freshWindow=${JSON.stringify(freshWindow)} ` +
        `committedWindow=${JSON.stringify(committedWindow)}`,
    );
  }
  console.log(`MATCH ${artifact} (${fresh.length} bytes)`);
}
