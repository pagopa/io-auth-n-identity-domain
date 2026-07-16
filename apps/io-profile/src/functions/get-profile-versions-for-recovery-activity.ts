import { InvocationContext } from "@azure/functions";
import {
  ProfileModel,
  RetrievedProfile,
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  asyncIteratorToArray,
  flattenAsyncIterator,
} from "@pagopa/io-functions-commons/dist/src/utils/async";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import { TransientFailure } from "../utils/durable";

export const ActivityInput = t.type({
  fiscalCode: FiscalCode,
  startTimestamp: t.number,
  endTimestamp: t.number,
});
export type ActivityInput = t.TypeOf<typeof ActivityInput>;

const ServicesPreferencesMode = t.union([
  t.literal(ServicesPreferencesModeEnum.AUTO),
  t.literal(ServicesPreferencesModeEnum.MANUAL),
  t.literal(ServicesPreferencesModeEnum.LEGACY),
]);

const ActivityResultFound = t.type({
  kind: t.literal("FOUND"),
  previousMode: t.union([ServicesPreferencesMode, t.undefined]),
  currentDayModes: t.readonlyArray(ServicesPreferencesMode),
  lastVersion: NonNegativeInteger,
  lastTimestamp: t.number,
});

const ActivityResultNotFound = t.type({
  kind: t.literal("NOT_FOUND"),
});

export const ActivityResult = t.union([
  ActivityResultFound,
  ActivityResultNotFound,
  TransientFailure,
]);
export type ActivityResult = t.TypeOf<typeof ActivityResult>;

export const ActivityName = "GetProfileVersionsForRecoveryActivity";

/**
 * Query all profile versions for a fiscal code inside a `_ts` window.
 */
const queryProfilesInWindow = async (
  profileModel: ProfileModel,
  fiscalCode: FiscalCode,
  startTimestamp: number,
  endTimestamp: number,
): Promise<ReadonlyArray<RetrievedProfile>> => {
  const iterator = profileModel
    .getQueryIterator({
      parameters: [
        {
          name: "@fiscalCode",
          value: fiscalCode,
        },
        {
          name: "@startTimestamp",
          value: startTimestamp,
        },
        {
          name: "@endTimestamp",
          value: endTimestamp,
        },
      ],
      query:
        "SELECT * FROM p WHERE p.fiscalCode = @fiscalCode AND p._ts >= @startTimestamp AND p._ts < @endTimestamp ORDER BY p.version ASC",
    })
    [Symbol.asyncIterator]() as AsyncIterator<
      ReadonlyArray<t.Validation<RetrievedProfile>>,
      unknown,
      undefined
    >;

  const profilesOrError = E.sequenceArray(
    await asyncIteratorToArray(flattenAsyncIterator(iterator)),
  );

  return pipe(
    profilesOrError,
    E.getOrElseW((errors) => {
      throw new Error(
        `Cannot decode profiles: ${readableReport(errors)}`,
      );
    }),
  );
};

/**
 * Query the profile version immediately before the given version.
 */
const queryPreviousProfileVersion = async (
  profileModel: ProfileModel,
  fiscalCode: FiscalCode,
  version: number,
): Promise<RetrievedProfile | undefined> => {
  const iterator = profileModel.getQueryIterator({
    parameters: [
      {
        name: "@fiscalCode",
        value: fiscalCode,
      },
      {
        name: "@version",
        value: version,
      },
    ],
    // TOP 1 is used to reduce the query RU consumption
    query:
      "SELECT TOP 1 * FROM p WHERE p.fiscalCode = @fiscalCode AND p.version = @version",
  });

  for await (const page of iterator) {
    const firstValidation = page[0];

    if (firstValidation === undefined) {
      return undefined;
    }

    if (E.isRight(firstValidation)) {
      return firstValidation.right;
    }

    throw new Error(
      `Cannot decode profile: ${readableReport(firstValidation.left)}`,
    );
  }

  return undefined;
};

/**
 * Activity handler that retrieves all profile versions inside a `_ts` window
 * plus the mode of the version immediately before the window, then maps the
 * result to the minimal fields required by the orchestrator.
 *
 * Returning only modes, last version and last timestamp keeps the data
 * persisted by the Durable Functions runtime in Table Storage to a minimum,
 * while leaving the original Cosmos queries unchanged.
 *
 * @param profileModel - the Cosmos DB profile model
 * @returns the activity handler
 */
export const getGetProfileVersionsForRecoveryActivityHandler =
  (profileModel: ProfileModel) =>
  async (
    input: unknown,
    context: InvocationContext,
  ): Promise<ActivityResult> => {
    const decodedInputOrError = ActivityInput.decode(input);
    if (E.isLeft(decodedInputOrError)) {
      context.error(
        `${ActivityName}|Cannot parse input|ERROR=${readableReport(
          decodedInputOrError.left,
        )}`,
      );
      return TransientFailure.encode({
        kind: "TRANSIENT_FAILURE",
        reason: "Invalid activity input",
      });
    }

    const { fiscalCode, startTimestamp, endTimestamp } =
      decodedInputOrError.right;

    try {
      const profiles = await queryProfilesInWindow(
        profileModel,
        fiscalCode,
        startTimestamp,
        endTimestamp,
      );

      if (profiles.length === 0) {
        return { kind: "NOT_FOUND" };
      }

      const [firstProfile] = profiles;
      const lastProfile = profiles[profiles.length - 1];

      const previousProfile =
        firstProfile.version === 0
          ? undefined
          : await queryPreviousProfileVersion(
              profileModel,
              fiscalCode,
              (firstProfile.version - 1) as NonNegativeInteger,
            );

      if (firstProfile.version > 0 && previousProfile === undefined) {
        return ActivityResultNotFound.encode({ kind: "NOT_FOUND" });
      }

      return {
        kind: "FOUND",
        lastTimestamp: lastProfile._ts,
        lastVersion: lastProfile.version,
        currentDayModes: profiles.map(
          (profile) => profile.servicePreferencesSettings.mode,
        ),
        previousMode: previousProfile?.servicePreferencesSettings.mode,
      };
    } catch (error) {
      context.error(
        `${ActivityName}|Unexpected error|ERROR=${String(error)}`,
      );
      return TransientFailure.encode({
        kind: "TRANSIENT_FAILURE",
        reason: "Unexpected activity error",
      });
    }
  };
