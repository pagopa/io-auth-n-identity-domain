import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type ScenarioCassette = {
  readonly normalization: unknown;
  readonly request: unknown;
  readonly response: unknown;
  readonly sideEffects: unknown;
  readonly topology: unknown;
};

const cassetteRoot = fileURLToPath(
  new URL("../characterization/cassettes", import.meta.url)
);

const sortJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortJson(nested)])
    );
  }

  return value;
};

const cassettePath = (scenario: string, fileName: string): string =>
  path.join(cassetteRoot, scenario, fileName);

const assertNoSensitiveValues = (
  scenario: string,
  layers: ScenarioCassette,
  sensitiveValues: ReadonlyArray<string>
): void => {
  const serialized = JSON.stringify(layers);

  const leaked = sensitiveValues.filter(
    value => value.length > 0 && serialized.includes(value)
  );

  if (leaked.length > 0) {
    throw new Error(
      `Cassette ${scenario} still contains sensitive values that should have been normalized`
    );
  }
};

export const readScenarioCassette = async (
  scenario: string
): Promise<ScenarioCassette> => ({
  normalization: JSON.parse(
    await readFile(cassettePath(scenario, "normalization.json"), "utf8")
  ) as unknown,
  request: JSON.parse(
    await readFile(cassettePath(scenario, "request.json"), "utf8")
  ) as unknown,
  response: JSON.parse(
    await readFile(cassettePath(scenario, "response.json"), "utf8")
  ) as unknown,
  sideEffects: JSON.parse(
    await readFile(cassettePath(scenario, "side-effects.json"), "utf8")
  ) as unknown,
  topology: JSON.parse(
    await readFile(cassettePath(scenario, "topology.json"), "utf8")
  ) as unknown
});

export const writeScenarioCassette = async (
  scenario: string,
  layers: ScenarioCassette,
  sensitiveValues: ReadonlyArray<string>
): Promise<void> => {
  assertNoSensitiveValues(scenario, layers, sensitiveValues);

  const fileEntries = [
    ["normalization.json", layers.normalization],
    ["request.json", layers.request],
    ["response.json", layers.response],
    ["side-effects.json", layers.sideEffects],
    ["topology.json", layers.topology]
  ] as const;

  await Promise.all(
    fileEntries.map(async ([fileName, payload]) => {
      await mkdir(path.dirname(cassettePath(scenario, fileName)), {
        recursive: true
      });
      await writeFile(
        cassettePath(scenario, fileName),
        `${JSON.stringify(sortJson(payload), null, 2)}\n`,
        "utf8"
      );
    })
  );
};
