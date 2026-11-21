import { describe, expect, it } from "vitest";
import { defaultFSRSParams, FSRS7_WEIGHT_COUNT } from "./fsrs";
import {
  FSRS_SETTINGS_KEY,
  formatLearningSteps,
  loadFSRSParameters,
  normalizeFSRSParameters,
  parseLearningSteps,
  parseMaximumInterval,
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
      learningSteps: [2],
      relearningSteps: [1],
      w: [1, 2],
    });
    expect(normalized.requestRetention).toBe(0.97);
    expect(normalized.maximumInterval).toBe(1);
    expect(normalized.learningSteps).toEqual(defaultFSRSParams.learningSteps);
    expect(normalized.relearningSteps).toEqual(defaultFSRSParams.relearningSteps);
    expect(normalized.w).toEqual(defaultFSRSParams.w);
  });

  it("parses and formats minute, hour, day and empty learning steps", () => {
    expect(parseLearningSteps("1m 10m 2h")).toEqual([1 / 1440, 10 / 1440, 1 / 12]);
    expect(parseLearningSteps("1m 10m 2h 1d")).toBeNull();
    expect(parseLearningSteps("")).toEqual([]);
    expect(parseLearningSteps("1m nope")).toBeNull();
    expect(formatLearningSteps([1 / 1440, 10 / 1440, 1 / 12])).toBe("1m 10m 2h");
  });

  it("devuelve arrays nuevos al normalizar null y no comparte referencias", () => {
    const normalized = normalizeFSRSParameters(null);
    expect(normalized).toEqual(defaultFSRSParams);
    expect(normalized.w).not.toBe(defaultFSRSParams.w);
    expect(normalized.learningSteps).not.toBe(defaultFSRSParams.learningSteps);
    expect(normalized.relearningSteps).not.toBe(defaultFSRSParams.relearningSteps);

    normalized.learningSteps.push(99);
    normalized.w.push(1);
    expect(defaultFSRSParams.learningSteps).toHaveLength(2);
    expect(defaultFSRSParams.w).toHaveLength(FSRS7_WEIGHT_COUNT);
  });

  it("rechaza pasos desordenados o duplicados y conserva los válidos", () => {
    expect(
      normalizeFSRSParameters({ ...defaultFSRSParams, learningSteps: [10 / 1440, 1 / 1440] })
        .learningSteps
    ).toEqual(defaultFSRSParams.learningSteps);
    expect(
      normalizeFSRSParameters({ ...defaultFSRSParams, relearningSteps: [1 / 1440, 1 / 1440] })
        .relearningSteps
    ).toEqual(defaultFSRSParams.relearningSteps);
    expect(
      normalizeFSRSParameters({ ...defaultFSRSParams, learningSteps: [2 / 1440, 20 / 1440] })
        .learningSteps
    ).toEqual([2 / 1440, 20 / 1440]);
  });

  it("parsea pasos rechazando desorden, duplicados y pasos de un día", () => {
    expect(parseLearningSteps("10m 1m")).toBeNull();
    expect(parseLearningSteps("1m 1m")).toBeNull();
    expect(parseLearningSteps("1d")).toBeNull();
    expect(parseLearningSteps("2m 2m 3m")).toBeNull();
  });

  it("parsea el intervalo máximo con vacío, inválido y acotado", () => {
    expect(parseMaximumInterval("")).toBe(defaultFSRSParams.maximumInterval);
    expect(parseMaximumInterval("abc")).toBeNull();
    expect(parseMaximumInterval("12.7")).toBe(13);
    expect(parseMaximumInterval("0")).toBe(1);
    expect(parseMaximumInterval("999999")).toBe(36500);
  });
});