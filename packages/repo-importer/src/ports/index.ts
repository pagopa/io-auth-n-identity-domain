export type GitPort = {
  addSubtree: (
    repoUrl: string,
    branch: string,
    prefix: string,
    squash: boolean,
  ) => void;
  changeToTopLevelDirectory: () => void;
};

export type FileSystemPort = {
  directoryExists: (path: string) => boolean;
};

export type UserInputPort = {
  getUserInput: () => Promise<UserInput>;
  confirmImportOnExistingDirectory: (dir: string) => Promise<boolean>;
};

export type UserInput = {
  repoUrl: string;
  workspaceType: string;
  workspaceName: string;
  branchName: string;
  squashHistory: boolean;
};

import { LoggerPort } from "./logger";
export { LoggerPort };
