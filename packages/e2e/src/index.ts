import { ProcessResult, promisifyProcess, runProcess } from "./utils/process";

const main = async () => {
  const results: ProcessResult[] = [];
  // eslint-disable-next-line functional/immutable-data
  results.push(
    await promisifyProcess(
      runProcess(`docker compose --file ../../docker-compose.yml up -d`),
    ),
  );

  // Await that the container starts
  await new Promise((ok) => setTimeout(ok, 10000));

  // eslint-disable-next-line functional/immutable-data
  results.push(await promisifyProcess(runProcess(`yarn test:e2e`)));

  // eslint-disable-next-line functional/immutable-data
  results.push(
    await promisifyProcess(
      runProcess(`docker compose --file ../../docker-compose.yml down`),
    ),
  );

  results.forEach((result) => {
    if (result === "ok") return;
    else throw new Error("at least one test scenario failed");
  });
};

main()
  .then((_) => {
    // eslint-disable-next-line no-console
    console.log("All test completed");
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
