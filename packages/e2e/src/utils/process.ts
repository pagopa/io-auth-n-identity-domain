/* eslint-disable turbo/no-undeclared-env-vars */
import { ChildProcess, spawn, exec } from "child_process";
import util from "util";

export const envFlag = (e: unknown): boolean => e === "1" || e === "true";

export type ProcessResult = "ok" | "ko";

export const DRY_RUN = envFlag(process.env.DRY_RUN);

export const runProcess = (sh: string): ChildProcess => {
  if (DRY_RUN) return spawn("echo", [`DryRun for ${sh}`], { stdio: "inherit" });
  const [command, ...argv] = sh.split(" ");
  return spawn(command, argv, { stdio: "inherit" });
};

export const promisifyProcess = (cp: ChildProcess): Promise<ProcessResult> =>
  new Promise((resolve, reject) =>
    cp
      .on("exit", (code) => {
        resolve(code === 0 ? "ok" : "ko");
      })
      .on("error", reject),
  );

const execPromise = util.promisify(exec);

export const runCommand = async (command: string) => {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      // eslint-disable-next-line no-console
      console.error(`Errore: ${stderr}`);
    }
    // eslint-disable-next-line no-console
    console.log(`Output: ${stdout}`);
    return stdout;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Errore durante l'esecuzione del comando: ${error}`);
  }
};
