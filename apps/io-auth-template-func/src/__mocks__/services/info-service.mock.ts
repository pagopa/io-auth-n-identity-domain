import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { InfoService } from "../../services/info";

export const mockInfoService: InfoService = {
  pingCustomDependency: RTE.right("PONG"),
};
