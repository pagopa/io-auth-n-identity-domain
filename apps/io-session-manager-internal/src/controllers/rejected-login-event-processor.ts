import { InvocationContext } from "@azure/functions";
import { RejectedLoginEvent } from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
import {
  RejectedLoginAuditLogService,
  RejectedLoginAuditLogServiceDeps,
} from "../services/rejected-login-audit-log-service";

type FunctionDependencies = {
  rejectedLoginAuditLogService: RejectedLoginAuditLogService;
} & RejectedLoginAuditLogServiceDeps;

const processRejectedLoginEvent: (
  document: unknown,
) => RTE.ReaderTaskEither<FunctionDependencies, Error, void> = (document) =>
  pipe(
    // TODO: this is temporary and will not be needed once we switch to HandlerKit
    RejectedLoginEvent.decode(document),
    E.mapLeft(
      (errors) =>
        new Error(
          `Failed to decode RejectedLoginEvent: ${JSON.stringify(errors)}`,
        ),
    ),
    RTE.fromEither,
    RTE.chainW(
      (rejectedLoginEvent) => (deps: FunctionDependencies) =>
        deps.rejectedLoginAuditLogService.saveRejectedLoginEvent(
          rejectedLoginEvent,
        )(deps),
    ),
  );

// TODO: replace with HandlerKit when new version with peerDependency sorted out will be releases
export const RejectedLoginEventProcessorFunction =
  (deps: FunctionDependencies) =>
  async (document: unknown, _context: InvocationContext): Promise<void> => {
    await pipe(
      processRejectedLoginEvent(document)(deps),
      TE.getOrElseW((error) => {
        throw error;
      }),
    )();
  };
