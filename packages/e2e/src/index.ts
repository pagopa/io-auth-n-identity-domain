import { promisifyProcess, runProcess } from "./utils/process";

const main = async () => {
  console.log(process.cwd());
  const result = await promisifyProcess(
    runProcess(`docker compose --file ../../docker-compose.yml up -d`),
  );

  // Await that the container starts
  await new Promise((ok) => setTimeout(ok, 10000));

  const result2 = await promisifyProcess(runProcess(`yarn test`));

  const result3 = await promisifyProcess(
    runProcess(`docker compose --file ../../docker-compose.yml down`),
  );

  if (result === "ok") return;
  else throw new Error("at least one test scenario failed");
};

main()
  .then((_) => {
    console.log("All test completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
