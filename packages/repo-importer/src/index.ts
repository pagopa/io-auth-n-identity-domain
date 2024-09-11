import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

const extractRepoName = (repoUrl: string): string => {
  const repoUrlParts = repoUrl.split("/");
  const repoNameWithGit = repoUrlParts[repoUrlParts.length - 1];
  return repoNameWithGit ? repoNameWithGit.replace(/\.git$/, "") : "repository";
};

const repoUrl = process.argv[2];
const folderName = extractRepoName(repoUrl);
const targetDir = `apps/${folderName}`;

const rootDir = execSync("git rev-parse --show-toplevel").toString().trim();
process.chdir(rootDir);

const runCommand = (command: string) => {
  try {
    logger.info(`Eseguendo comando: ${command}`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    logger.error(`Errore durante l'esecuzione del comando: ${command}`, error);
    runCommand(`git remote remove import-${folderName}`);
    process.exit(1);
  }
};

const checkOrCreateTargetDirectory = () => {
  if (!fs.existsSync(targetDir)) {
    logger.info(`Creazione della directory ${targetDir}...`);
    fs.mkdirSync(path.join(rootDir, targetDir), { recursive: true });
  }
};

const importRepository = () => {
  runCommand("git fetch origin");
  runCommand(`git remote add import-${folderName} ${repoUrl}`);
  runCommand(`git fetch import-${folderName}`);
  runCommand(`git checkout import-${folderName}/main`);

  const filterBranchCmd = `
    git filter-branch -f --index-filter \
    'git ls-files -s | sed "s|\\t|&${targetDir}/|" | GIT_INDEX_FILE=$GIT_INDEX_FILE.new git update-index --index-info; mv "$GIT_INDEX_FILE.new" "$GIT_INDEX_FILE"' \
    -- --all
  `;
  runCommand(filterBranchCmd);

  runCommand(`git merge --allow-unrelated-histories import-${folderName}/main`);
  runCommand(`git remote remove import-${folderName}`);
  logger.info(`Repository importato correttamente in ${targetDir}`);
};

checkOrCreateTargetDirectory();
importRepository();
