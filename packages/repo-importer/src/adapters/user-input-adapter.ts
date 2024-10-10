import prompts from "prompts";
import { extractRepoName } from "../utils/repositories";
import { UserInputPort, UserInput } from "../ports";

export const userInputAdapter: UserInputPort = {
  getUserInput: async (): Promise<UserInput> => {
    const { repoUrl, workspaceType } = await prompts([
      {
        type: "text",
        name: "repoUrl",
        message: "Enter the remote repository URL:",
        validate: (value) => (value ? true : "The URL cannot be empty"),
      },
      {
        type: "select",
        name: "workspaceType",
        message: "Select the workspace type:",
        choices: [
          { title: "apps", value: "apps" },
          { title: "packages", value: "packages" },
        ],
        initial: 0, // Default: apps
      },
    ]);

    const defaultWorkspaceName = extractRepoName(repoUrl);

    const { workspaceName, branchName, squashHistory } = await prompts([
      {
        type: "text",
        name: "workspaceName",
        message: "Enter the workspace name:",
        initial: defaultWorkspaceName,
      },
      {
        type: "text",
        name: "branchName",
        message: "Enter the branch name to import:",
        initial: "main", // Default: main
      },
      {
        type: "toggle",
        name: "squashHistory",
        message: "Do you want to squash the commit history?",
        initial: false,
        active: "yes",
        inactive: "no",
      },
    ]);

    return {
      repoUrl,
      workspaceType,
      workspaceName,
      branchName,
      squashHistory,
    };
  },

  confirmImportOnExistingDirectory: async (dir: string): Promise<boolean> => {
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: `The directory "${dir}" already exists. Do you want to proceed with the import?`,
      initial: false, // Default: no
    });

    return proceed;
  },
};
