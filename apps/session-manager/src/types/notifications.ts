import * as t from "io-ts";
import { enumType } from "@pagopa/ts-commons/lib/types";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

export enum NotificationMessageKindEnum {
  "Notify" = "Notify",

  "CreateOrUpdateInstallation" = "CreateOrUpdateInstallation",

  "DeleteInstallation" = "DeleteInstallation",
}

export type NotificationMessageKind = t.TypeOf<typeof NotificationMessageKind>;
export const NotificationMessageKind = enumType<NotificationMessageKindEnum>(
  NotificationMessageKindEnum,
  "NotificationMessageKind",
);

export enum DeleteInstallationKindEnum {
  "DeleteInstallation" = "DeleteInstallation",
}

/**
 * Message sent to the queue for a new Delete Installation event
 */
const DeleteInstallationMessage = t.exact(
  t.type({
    installationId: NonEmptyString,

    kind: enumType<DeleteInstallationKindEnum>(
      DeleteInstallationKindEnum,
      "kind",
    ),
  }),
);

export type DeleteInstallationMessage = t.TypeOf<
  typeof DeleteInstallationMessage
>;
