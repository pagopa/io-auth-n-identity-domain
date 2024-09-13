import { execSync } from "child_process";
import { GitPort } from "../ports";

export const gitAdapter: GitPort = {
  changeToTopLevelDirectory: () => {
    const topLevelDir = execSync("git rev-parse --show-toplevel")
      .toString()
      .trim();
    process.chdir(topLevelDir);
  },

  addSubtree: (repoUrl, branch, prefix, squash) => {
    const command = `git subtree add --prefix=${prefix} ${repoUrl} ${branch} ${
      squash ? "--squash" : ""
    }`;
    execSync(command, { stdio: "inherit" });
  },
};
