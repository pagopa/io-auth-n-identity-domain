import { GitPort, FileSystemPort, UserInputPort, LoggerPort } from "../ports";

export const importRepository = async (
  gitPort: GitPort,
  fsPort: FileSystemPort,
  userInputPort: UserInputPort,
  logger: LoggerPort,
) => {
  try {
    const { repoUrl, workspaceType, workspaceName, branchName, squashHistory } =
      await userInputPort.getUserInput();

    const targetDir = `${workspaceType}/${workspaceName}`;

    // Check if the directory already exists and ask for confirmation
    if (fsPort.directoryExists(targetDir)) {
      const confirm =
        await userInputPort.confirmImportOnExistingDirectory(targetDir);
      if (!confirm) {
        logger.info("Operation cancelled by the user.");
        return;
      }
    }

    gitPort.changeToTopLevelDirectory();

    logger.info(
      `Importing repository ${repoUrl} into ${targetDir} (branch: ${branchName}, squash: ${squashHistory})`,
    );

    gitPort.addSubtree(repoUrl, branchName, targetDir, squashHistory);

    logger.info(`Repository successfully imported into ${targetDir}`);
  } catch (error) {
    logger.error("An error occurred during repository import", error);
  }
};
