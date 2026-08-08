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
const PAGES_CONFIG_FILE = path.join(REPO_ROOT, "_config.yml");
const PAGES_DEPLOY_ALLOWLIST = ["CNAME", "index.html", "buyer-interactive.html", "assets", "src"];
const PAGES_DEPLOY_DENYLIST = [
  ".superpowers",
  "apps-script",
  "docs",
  "node_modules",
  "output",
  "test-results",
  "tests",
  ".gitignore",
  "package-lock.json",
  "package.json",
  "playwright.config.js",
  "README.md"
];

function pagesExcludeEntries() {
  const config = fs.readFileSync(PAGES_CONFIG_FILE, "utf8");
  const lines = config.split(/\r?\n/u);
  const excludeStart = lines.findIndex(line => line.trim() === "exclude:");
  if (excludeStart < 0) return [];

  const entries = [];
  for (const line of lines.slice(excludeStart + 1)) {
    const match = line.match(/^\s{2}-\s+['"]?(.+?)['"]?\s*$/u);
    if (!match) {
      if (line.trim() && !line.trimStart().startsWith("#")) break;
      continue;
    }
    entries.push(match[1].replace(/\/$/u, ""));
  }
  return entries;
}

function productionCodeFiles() {
  const files = PAGES_DEPLOY_ALLOWLIST
    .filter(relativePath => /\.(?:html|js|css)$/u.test(relativePath))
    .map(relativePath => path.join(REPO_ROOT, relativePath));

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

test("Pages deployment publishes only frontend paths and excludes development artifacts", () => {
  assert.equal(fs.existsSync(PAGES_CONFIG_FILE), true, "legacy Pages branch build requires _config.yml");
  const excludes = pagesExcludeEntries();

  assert.deepEqual(
    PAGES_DEPLOY_DENYLIST.filter(relativePath => !excludes.includes(relativePath)),
    [],
    "every development artifact must be excluded from the Pages build"
  );
  for (const relativePath of PAGES_DEPLOY_ALLOWLIST) {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, relativePath)), true, `${relativePath} must remain publishable`);
    assert.equal(excludes.includes(relativePath), false, `${relativePath} must not be excluded`);
  }
});

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
