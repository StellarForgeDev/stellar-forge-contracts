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
    throw new Error(`source-built WASM does not match committed artifact: ${artifact}`);
  }
  console.log(`MATCH ${artifact} (${fresh.length} bytes)`);
}
