import {
  applySharedHarnessEnv,
  startSharedHarness
} from "./support/shared-harness";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const harness = await startSharedHarness();
  applySharedHarnessEnv(harness);

  return async () => {
    await harness.stop();
  };
}
