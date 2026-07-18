import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const LEGACY_BACKEND_FILE = "google-apps-script-backend.js";
const FORBIDDEN_REFERENCES = [
  "1T32661HLRNWSz0vfm5Y3tBYt9XQ58QDLoopYW1WlA5s",
  "AKfycbxEDeuBcfgv9T9eJ7VnGYCWP5VALRv0JwF5dRiOwPPpcYQadmtInBs0-ithXkBhR1Fv"
];

function productionCodeFiles() {
  const files = fs.readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:html|js|css)$/u.test(entry.name))
    .map(entry => path.join(REPO_ROOT, entry.name));

  for (const directory of ["assets", "src"]) {
    const directoryPath = path.join(REPO_ROOT, directory);
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      if (entry.isFile() && /\.(?:html|js|css)$/u.test(entry.name)) {
        files.push(path.join(directoryPath, entry.name));
      }
    }
  }

  return files;
}

test("production artifacts exclude the legacy backend and old backend references", () => {
  const violations = [];
  const files = productionCodeFiles();

  if (files.some(file => path.basename(file) === LEGACY_BACKEND_FILE)) {
    violations.push(`legacy file: ${LEGACY_BACKEND_FILE}`);
  }

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const reference of FORBIDDEN_REFERENCES) {
      if (content.includes(reference)) {
        violations.push(`legacy reference in ${path.relative(REPO_ROOT, file)}: ${reference}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
