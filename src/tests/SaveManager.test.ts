import { beforeEach, expect, it, vi } from "vitest";
import { defaults, loadSave, saveData } from "../app/SaveManager";
let data: Record<string, string> = {};
beforeEach(() => {
  data = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  });
});
it("recovers from corrupt and incompatible saves", () => {
  data["rewind-room-v1"] = "{broken";
  expect(loadSave()).toEqual(defaults());
  data["rewind-room-v1"] = '{"version":2}';
  expect(loadSave()).toEqual(defaults());
});
it("validates values rather than trusting stored data", () => {
  data["rewind-room-v1"] = JSON.stringify({
    version: 1,
    unlocked: 99,
    completed: [0, 7, "bad"],
    master: 2,
    effects: -2,
    quality: "ultra",
    best: { 0: 15, 1: -1, 9: 30 },
  });
  const s = loadSave();
  expect(s.unlocked).toBe(4);
  expect(s.completed).toEqual([0]);
  expect(s.master).toBe(1);
  expect(s.effects).toBe(0);
  expect(s.quality).toBe("medium");
  expect(s.best).toEqual({ 0: 15 });
});
it("round trips progression and display preferences", () => {
  const s = defaults();
  s.unlocked = 4;
  s.completed = [0, 1, 2, 3, 4];
  s.best = { 4: 20 };
  s.reduced = true;
  saveData(s);
  expect(loadSave()).toEqual(s);
});
it("storage denial does not prevent playing", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
  });
  expect(loadSave()).toEqual(defaults());
  expect(() => saveData(defaults())).not.toThrow();
});
