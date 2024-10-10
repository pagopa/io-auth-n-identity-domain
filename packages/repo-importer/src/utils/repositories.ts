export const extractRepoName = (repoUrl: string): string => {
  const repoUrlParts = repoUrl.split("/");
  const repoNameWithGit = repoUrlParts[repoUrlParts.length - 1];
  return repoNameWithGit ? repoNameWithGit.replace(/\.git$/, "") : "repository";
};
