import { importRepository } from "./domain/repository-service";
import { gitAdapter } from "./adapters/git-adapter";
import { fileSystemAdapter } from "./adapters/file-system-adapter";
import { userInputAdapter } from "./adapters/user-input-adapter";
import { loggerAdapter } from "./adapters/logger-adapter";

// Pass all the functional dependencies to the core logic function
const main = async () => {
  await importRepository(
    gitAdapter,
    fileSystemAdapter,
    userInputAdapter,
    loggerAdapter,
  );
};

main().catch((err) =>
  loggerAdapter.error(`Error executing the program: ${err}`),
);
