import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeImportPath } from "./import-path.ts";

test("sanitizeImportPath accepts normal repo paths", () => {
  assert.equal(sanitizeImportPath("src/app/page.tsx"), "src/app/page.tsx");
  assert.equal(sanitizeImportPath("src\\lib\\db\\schema.ts"), "src/lib/db/schema.ts");
  assert.equal(sanitizeImportPath("./README.md"), null); // leading "./" creates an empty segment
  assert.equal(sanitizeImportPath("docs/ARCHITECTURE.md"), "docs/ARCHITECTURE.md");
});

test("sanitizeImportPath rejects traversal, absolute and junk paths", () => {
  assert.equal(sanitizeImportPath("../../etc/passwd"), null);
  assert.equal(sanitizeImportPath("src/../../etc/passwd"), null);
  assert.equal(sanitizeImportPath("/etc/passwd"), null);
  assert.equal(sanitizeImportPath("C:/Windows/system32"), null);
  assert.equal(sanitizeImportPath("node_modules/foo/index.js"), null);
  assert.equal(sanitizeImportPath("app/src/node_modules/x.js"), null);
  assert.equal(sanitizeImportPath(".git/config"), null);
  assert.equal(sanitizeImportPath("src/bin\u0000ary"), null);
  assert.equal(sanitizeImportPath(""), null);
});
