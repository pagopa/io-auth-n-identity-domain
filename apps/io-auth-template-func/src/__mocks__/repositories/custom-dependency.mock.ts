import * as TE from "fp-ts/lib/TaskEither";
import { CustomDependencyRepository } from "../../repositories/custom-dependency";

export const mockCustomDependencyRepository: CustomDependencyRepository = {
  ping: () => TE.of(true as const),
};
