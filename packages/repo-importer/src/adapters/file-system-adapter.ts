import * as fs from "fs";
import { FileSystemPort } from "../ports";

export const fileSystemAdapter: FileSystemPort = {
  directoryExists: (path: string) => fs.existsSync(path),
};
