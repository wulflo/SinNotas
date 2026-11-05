import { describe, expect, it } from "vitest";
import { defaultFSRSParams } from "./fsrs";
import {
  FSRS_SETTINGS_KEY,
  formatLearningSteps,
  loadFSRSParameters,
  normalizeFSRSParameters,
  parseLearningSteps,
  saveFSRSParameters,
  type StorageLike,
} from "./fsrs-settings";

function makeStorage(initial: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("FSRS settings", () => {
  it("loads defaults and persists normalized settings", () => {
    const storage = makeStorage();
    expect(loadFSRSParameters(storage)).toEqual(defaultFSRSParams);

    const saved = saveFSRSParameters(storage, {
      ...defaultFSRSParams,
      requestRetention: 0.94,
      maximumInterval: 1000,
    });
    expect(saved.requestRetention).toBe(0.94);
    expect(saved.maximumInterval).toBe(1000);
    expect(JSON.parse(storage.getItem(FSRS_SETTINGS_KEY) || "{}")).toEqual(saved);
    expect(loadFSRSParameters(storage)).toEqual(saved);
  });

  it("clamps scalar settings and falls back from an invalid weight vector", () => {
    const normalized = normalizeFSRSParameters({
      ...defaultFSRSParams,
      requestRetention: 1.2,
      maximumInterval: 0,
      w: [1, 2],
    });
    expect(normalized.requestRetention).toBe(0.97);
    expect(normalized.maximumInterval).toBe(1);
    expect(normalized.w).toEqual(defaultFSRSParams.w);
  });

  it("parses and formats minute, hour, day and empty learning steps", () => {
    expect(parseLearningSteps("1m 10m 2h 1d")).toEqual([1 / 1440, 10 / 1440, 1 / 12, 1]);
    expect(parseLearningSteps("")).toEqual([]);
    expect(parseLearningSteps("1m nope")).toBeNull();
    expect(formatLearningSteps([1 / 1440, 10 / 1440, 1 / 12, 1])).toBe("1m 10m 2h 1d");
  });
});