import assert from "node:assert/strict";
import test from "node:test";
import {
  APPEARANCE_RESET_EVENT,
  TEMP_LOCALE_KEY,
  TEMP_THEME_KEY,
  resetTemporaryAppearance,
} from "../src/lib/appearance-session.ts";

test("a login boundary clears temporary appearance without touching unrelated session data", () => {
  const data = new Map([
    [TEMP_LOCALE_KEY, "en"],
    [TEMP_THEME_KEY, "dark"],
    ["unrelated", "keep"],
  ]);
  const events = [];
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.sessionStorage;
  try {
    globalThis.window = { dispatchEvent: (event) => events.push(event.type) };
    globalThis.sessionStorage = { removeItem: (key) => data.delete(key) };
    resetTemporaryAppearance();
    assert.deepEqual([...data], [["unrelated", "keep"]]);
    assert.deepEqual(events, [APPEARANCE_RESET_EVENT]);
  } finally {
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalStorage;
  }
});

test("in-memory reset is dispatched even when session storage is blocked", () => {
  const events = [];
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.sessionStorage;
  try {
    globalThis.window = { dispatchEvent: (event) => events.push(event.type) };
    globalThis.sessionStorage = {
      removeItem: () => {
        throw new Error("Storage blocked");
      },
    };
    resetTemporaryAppearance();
    assert.deepEqual(events, [APPEARANCE_RESET_EVENT]);
  } finally {
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalStorage;
  }
});
