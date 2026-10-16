import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { resolveLocale, translate, zhCN } from "../src/lib/i18n/messages.ts";

test("explicit preference wins over browser language", () => {
  assert.equal(resolveLocale("en", "zh-CN"), "en");
  assert.equal(resolveLocale("zh-CN", "en-US"), "zh-CN");
});

test("new and invalid preferences follow browser language", () => {
  assert.equal(resolveLocale(null, "zh-TW"), "zh-CN");
  assert.equal(resolveLocale("invalid", "zh-HK"), "zh-CN");
  assert.equal(resolveLocale(null, "fr-FR"), "en");
});

test("translations interpolate counts and keep identity values intact", () => {
  assert.equal(
    translate("zh-CN", "{start}–{end} of {total}", {
      start: 1,
      end: 5,
      total: 20,
    }),
    "第 1–5 条，共 20 条",
  );
  assert.equal(
    translate("en", "{start}–{end} of {total}", {
      start: 1,
      end: 5,
      total: 20,
    }),
    "1–5 of 20",
  );
  assert.equal(
    translate("zh-CN", "Type {name} to confirm.", {
      name: "user-001::device-A",
    }),
    "请输入 user-001::device-A 以确认。",
  );
  assert.equal(
    translate("zh-CN", "A new untranslated label"),
    "A new untranslated label",
  );
});

test("all static translation calls have Chinese entries", () => {
  const root = fileURLToPath(new URL("../src", import.meta.url));
  function files(dir) {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? files(path.join(dir, entry.name))
          : [path.join(dir, entry.name)],
      );
  }
  let checked = 0;
  for (const file of files(root).filter((file) => /\.tsx?$/.test(file))) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "t" &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const key = node.arguments[0].text;
        assert.ok(Object.hasOwn(zhCN, key), `${file}: missing ${key}`);
        assert.ok(zhCN[key].length > 0, `Empty translation: ${key}`);
        checked++;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.ok(checked > 150, "Expected translation coverage across the app");
});
