import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";

type ScenarioLayers = {
  readonly normalization: unknown;
  readonly request: unknown;
  readonly response: unknown;
  readonly sideEffects: unknown;
  readonly topology: unknown;
};

const cassetteRoot = path.resolve(
  process.cwd(),
  "src/__backend__/record-replay/cassettes",
);

const toJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export const isRecordMode = () => process.env.IO_SESSION_MANAGER_RECORD === "1";

export const recordOrVerifyScenario = async (
  scenarioName: string,
  layers: ScenarioLayers,
) => {
  const scenarioDirectory = path.join(cassetteRoot, scenarioName);
  const fileEntries = Object.entries(layers) as ReadonlyArray<
    readonly [keyof ScenarioLayers, unknown]
  >;

  if (isRecordMode()) {
    await mkdir(scenarioDirectory, { recursive: true });
    await Promise.all(
      fileEntries.map(([layerName, value]) =>
        writeFile(path.join(scenarioDirectory, `${layerName}.json`), toJson(value)),
      ),
    );
    return;
  }

  const expectedEntries = await Promise.all(
    fileEntries.map(async ([layerName]) => [
      layerName,
      JSON.parse(
        await readFile(path.join(scenarioDirectory, `${layerName}.json`), "utf8"),
      ),
    ]),
  );

  expect(Object.fromEntries(expectedEntries)).toEqual(layers);
};

export const replaceDeep = (
  input: unknown,
  replacements: Readonly<Record<string, string>>,
): unknown => {
  if (typeof input === "string") {
    return Object.entries(replacements).reduce(
      (currentValue, [searchValue, replacementValue]) =>
        currentValue.split(searchValue).join(replacementValue),
      input,
    );
  }

  if (typeof input === "number") {
    return replacements[String(input)] ?? input;
  }

  if (Array.isArray(input)) {
    return input.map((value) => replaceDeep(value, replacements));
  }

  if (input !== null && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, replaceDeep(value, replacements)]),
    );
  }

  return input;
};
