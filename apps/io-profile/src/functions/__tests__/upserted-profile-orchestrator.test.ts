/* eslint-disable @typescript-eslint/no-explicit-any */

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as df from "durable-functions";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { Profile } from "@pagopa/io-functions-commons/dist/generated/definitions/Profile";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import {
  OrchestratorName as EmailValidationWithTemplateProcessOrchestratorName,
  OrchestratorInput as EmailValidationProcessOrchestratorInput,
  OrchestratorResult as EmailValidationProcessOrchestratorResult,
} from "../email-validation-orchestrator";
import { context as contextMock } from "../__mocks__/durable-functions";
import {
  aEmailChanged,
  aFiscalCode,
  aName,
  aRetrievedProfile,
  autoProfileServicePreferencesSettings,
  manualProfileServicePreferencesSettings,
} from "../__mocks__/mocks";
import { consumeGenerator } from "../../utils/durable";
import {
  makeProfileCompletedEvent,
  makeServicePreferencesChangedEvent,
} from "../../utils/emitted-events";
import {
  getUpsertedProfileOrchestratorHandler,
  OrchestratorInput as UpsertedProfileOrchestratorInput,
} from "../upserted-profile-orchestrator";
import { ActivityName as UpdateSubscriptionFeedActivityName } from "../update-subscriptions-feed-activity";
import { ActivityName as SendWelcomeMessagesActivityName } from "../send-welcome-messages-activity";
import { ActivityName as GetServicesPreferencesActivityName } from "../get-services-preferences-activity";
import { ActivityName as EmitEventActivityName } from "../emit-event-activity";
const someRetryOptions = new df.RetryOptions(5000, 10);
// eslint-disable-next-line functional/immutable-data
someRetryOptions.backoffCoefficient = 1.5;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UpsertedProfileOrchestratorV2", () => {
  it("should not start the EmailValidationProcessOrchestrator if the email is not changed", () => {
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: { ...aRetrievedProfile, isWebhookEnabled: true },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date(),
        name: aName,
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: ReadonlyArray<unknown>) => tasks,
        },
        callSubOrchestratorWithRetry: vi.fn(() => undefined),
        getInput: vi.fn(() => upsertedProfileOrchestratorInput),
      },
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: false,
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).not.toBeCalled();
  });

  it("should enqueue a message if the notifyOn queue name is provided when an inbox become enabled", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date(),
        name: aName,
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS",
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: ReadonlyArray<unknown>) => tasks,
        },
        callActivityWithRetry: vi
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: vi.fn(
          () => emailValidationProcessOrchestratorResult,
        ),
        getInput: vi.fn(() => upsertedProfileOrchestratorInput),
      },
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: true,
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      EmailValidationWithTemplateProcessOrchestratorName,
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode,
        name: aName,
      }),
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      EmitEventActivityName,
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode,
      ),
    );
  });

  it("should not call UpdateSubscriptionFeedActivity if oldProfile and newProfile have the same servicePreferenceMode", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: autoProfileServicePreferencesSettings,
        },
        oldProfile: {
          ...aRetrievedProfile,
          servicePreferencesSettings: autoProfileServicePreferencesSettings,
        },
        updatedAt: new Date(),
        name: aName,
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS",
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: ReadonlyArray<unknown>) => tasks,
        },
        callActivityWithRetry: vi
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: vi.fn(
          () => emailValidationProcessOrchestratorResult,
        ),
        getInput: vi.fn(() => upsertedProfileOrchestratorInput),
      },
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: true,
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      EmailValidationWithTemplateProcessOrchestratorName,
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode,
        name: aName,
      }),
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).not.toHaveBeenCalledWith(
      UpdateSubscriptionFeedActivityName,
      someRetryOptions,
      {},
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      EmitEventActivityName,
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode,
      ),
    );
  });

  it("should not call UpdateSubscriptionFeedActivity switching from LEGACY to AUTO", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: autoProfileServicePreferencesSettings,
        },
        oldProfile: {
          ...aRetrievedProfile,
        },
        updatedAt: new Date(),
        name: aName,
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS",
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: ReadonlyArray<unknown>) => tasks,
        },
        callActivityWithRetry: vi
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: vi.fn(
          () => emailValidationProcessOrchestratorResult,
        ),
        getInput: vi.fn(() => upsertedProfileOrchestratorInput),
      },
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: true,
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      EmailValidationWithTemplateProcessOrchestratorName,
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode,
        name: aName,
      }),
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).not.toHaveBeenCalledWith(
      UpdateSubscriptionFeedActivityName,
      someRetryOptions,
      {},
    );
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      EmitEventActivityName,
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode,
      ),
    );
  });

  it("should call UpdateSubscriptionFeedActivity to unsubscribe the entire profile switching from LEGACY to MANUAL", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: manualProfileServicePreferencesSettings,
        },
        oldProfile: {
          ...aRetrievedProfile,
        },
        updatedAt: new Date(),
        name: aName,
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS",
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: ReadonlyArray<unknown>) => tasks,
        },
        callActivityWithRetry: vi
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: vi.fn(
          () => emailValidationProcessOrchestratorResult,
        ),
        getInput: vi.fn(() => upsertedProfileOrchestratorInput),
      },
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: true,
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      EmailValidationWithTemplateProcessOrchestratorName,
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode,
        name: aName,
      }),
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      UpdateSubscriptionFeedActivityName,
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "UNSUBSCRIBED",
        subscriptionKind: "PROFILE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version,
      },
    );
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      EmitEventActivityName,
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode,
      ),
    );
  });

  it("should call UpdateSubscriptionFeedActivity to unsubscribe the entire profile switching from AUTO to MANUAL", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: manualProfileServicePreferencesSettings,
        },
        oldProfile: {
          ...aRetrievedProfile,
          servicePreferencesSettings: autoProfileServicePreferencesSettings,
        },
        updatedAt: new Date(),
        name: aName,
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS",
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: ReadonlyArray<unknown>) => tasks,
        },
        callActivityWithRetry: vi
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // WELCOME
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // HOW TO
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // CASHBACK
          .mockImplementationOnce(() => ({
            kind: "SUCCESS",
            preferences: [],
          })),
        callSubOrchestratorWithRetry: vi.fn(
          () => emailValidationProcessOrchestratorResult,
        ),
        getInput: vi.fn(() => upsertedProfileOrchestratorInput),
      },
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: true,
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(
      contextMockWithDf.df.callSubOrchestratorWithRetry,
    ).toHaveBeenCalledWith(
      EmailValidationWithTemplateProcessOrchestratorName,
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode,
        name: aName,
      }),
    );

    let nth = 1;
    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      GetServicesPreferencesActivityName,
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        settingsVersion:
          upsertedProfileOrchestratorInput.oldProfile
            ?.servicePreferencesSettings.version,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      UpdateSubscriptionFeedActivityName,
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "UNSUBSCRIBED",
        subscriptionKind: "PROFILE",
        previousPreferences: [],
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      6,
      EmitEventActivityName,
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode,
      ),
    );
  });

  it("should call UpdateSubscriptionFeedActivity to subscribe the entire profile switching from MANUAL to AUTO", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: autoProfileServicePreferencesSettings,
        },
        oldProfile: {
          ...aRetrievedProfile,
          servicePreferencesSettings: manualProfileServicePreferencesSettings,
        },
        updatedAt: new Date(),
        name: aName,
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS",
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: ReadonlyArray<unknown>) => tasks,
        },
        callActivityWithRetry: vi
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // WELCOME
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // HOW TO
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // CASHBACK
          .mockReturnValueOnce({
            kind: "SUCCESS",
            preferences: [],
          }),
        callSubOrchestratorWithRetry: vi.fn(
          () => emailValidationProcessOrchestratorResult,
        ),
        getInput: vi.fn(() => upsertedProfileOrchestratorInput),
      },
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: true,
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      EmailValidationWithTemplateProcessOrchestratorName,
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode,
        name: aName,
      }),
    );

    let nth = 1;
    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      GetServicesPreferencesActivityName,
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        settingsVersion:
          upsertedProfileOrchestratorInput.oldProfile
            ?.servicePreferencesSettings.version,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      UpdateSubscriptionFeedActivityName,
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "SUBSCRIBED",
        subscriptionKind: "PROFILE",
        previousPreferences: [],
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      EmitEventActivityName,
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode,
      ),
    );
  });

  it("should call UpdateSubscriptionFeedActivity with the difference between blockedInboxOrchannels when servicePreferenceMode is LEGACY", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: {
          ...aRetrievedProfile,
          blockedInboxOrChannels: {
            service1: [BlockedInboxOrChannelEnum.INBOX],
            service2: [BlockedInboxOrChannelEnum.INBOX],
          },
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: {
          ...aRetrievedProfile,
          blockedInboxOrChannels: {
            service3: [BlockedInboxOrChannelEnum.INBOX],
          },
        },
        updatedAt: new Date(),
        name: aName,
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS",
      }),
      E.getOrElseW((errs) =>
        assert.fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs,
          )}`,
        ),
      ),
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: ReadonlyArray<unknown>) => tasks,
        },
        callActivityWithRetry: vi
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: vi.fn(
          () => emailValidationProcessOrchestratorResult,
        ),
        getInput: vi.fn(() => upsertedProfileOrchestratorInput),
      },
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: true,
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      EmailValidationWithTemplateProcessOrchestratorName,
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode,
        name: aName,
      }),
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      SendWelcomeMessagesActivityName,
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      UpdateSubscriptionFeedActivityName,
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "SUBSCRIBED",
        serviceId: "service3",
        subscriptionKind: "SERVICE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      UpdateSubscriptionFeedActivityName,
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "UNSUBSCRIBED",
        serviceId: "service1",
        subscriptionKind: "SERVICE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      UpdateSubscriptionFeedActivityName,
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "UNSUBSCRIBED",
        serviceId: "service2",
        subscriptionKind: "SERVICE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version,
      },
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      EmitEventActivityName,
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode,
      ),
    );
  });
});

describe("UpsertedProfileOrchestrator |> emitted events", () => {
  const anyProfileCompletedEvent = {
    ...makeProfileCompletedEvent(
      aFiscalCode,
      ServicesPreferencesModeEnum.AUTO /* any value */,
    ),
    payload: expect.objectContaining({ fiscalCode: aFiscalCode }),
  };

  const anyPreferenceModeChangedEvent = {
    ...makeServicePreferencesChangedEvent(
      aFiscalCode,
      ServicesPreferencesModeEnum.AUTO /* any value */,
      ServicesPreferencesModeEnum.AUTO /* any value */,
    ),
    payload: expect.objectContaining({ fiscalCode: aFiscalCode }),
  };

  const { AUTO, MANUAL, LEGACY } = ServicesPreferencesModeEnum;

  const withInboxEnabled = (p: RetrievedProfile) => ({
    ...p,
    isInboxEnabled: true,
  });
  const withInboxDisabled = (p: RetrievedProfile) => ({
    ...p,
    isInboxEnabled: false,
  });
  const withEmailChanged = (p: RetrievedProfile) => ({
    ...p,
    email: aEmailChanged,
  });
  const withPreferences =
    (mode: ServicesPreferencesModeEnum) => (p: RetrievedProfile) =>
      ({
        ...p,
        servicePreferencesSettings: {
          mode,
          version: mode === LEGACY ? -1 : 0,
        },
      }) as RetrievedProfile;

  // just a helper to compose profile attributes
  const profile = (
    ...transformers: Array<(p: RetrievedProfile) => RetrievedProfile>
  ) =>
    // @ts-ignore
    pipe(aRetrievedProfile, ...transformers);

  const mockUpdateSubscriptionsFeedActivity = vi.fn();
  const mockGetServicesPreferencesActivity = vi.fn().mockReturnValue({
    kind: "SUCCESS",
    preferences: [],
  });
  const mockSendWelcomeMessagesActivity = vi.fn();
  const mockEmitEventActivity = vi.fn();

  const callActivityBase = (name: string, input: any) => {
    switch (name) {
      case UpdateSubscriptionFeedActivityName:
        return mockUpdateSubscriptionsFeedActivity(input);
      case GetServicesPreferencesActivityName:
        return mockGetServicesPreferencesActivity(input);
      case SendWelcomeMessagesActivityName:
        return mockSendWelcomeMessagesActivity(input);
      case EmitEventActivityName:
        return mockEmitEventActivity(input);
    }
  };

  it.each`
    scenario                                                                       | newProfile                                             | oldProfile                                             | expectedEvents
    ${"profile just enabled its inbox"}                                            | ${profile(withInboxEnabled, withEmailChanged)}         | ${profile(withInboxDisabled)}                          | ${[anyProfileCompletedEvent]}
    ${"profile just enabled its inbox and no old profile"}                         | ${profile(withInboxEnabled, withEmailChanged)}         | ${undefined}                                           | ${[anyProfileCompletedEvent]}
    ${"profile already had inbox enabled"}                                         | ${profile(withInboxEnabled)}                           | ${profile(withInboxEnabled)}                           | ${[]}
    ${"profile already had inbox enabled and email changed"}                       | ${profile(withInboxEnabled, withEmailChanged)}         | ${profile(withInboxEnabled)}                           | ${[]}
    ${"preference mode is changed from AUTO to MANUAL with inbox already enabled"} | ${profile(withInboxEnabled, withPreferences(MANUAL))}  | ${profile(withInboxEnabled, withPreferences(AUTO))}    | ${[anyPreferenceModeChangedEvent]}
    ${"preference mode is changed from MANUAL to AUTO with inbox already enabled"} | ${profile(withInboxEnabled, withPreferences(AUTO))}    | ${profile(withInboxEnabled, withPreferences(MANUAL))}  | ${[anyPreferenceModeChangedEvent]}
    ${"preference mode is changed from AUTO to MANUAL with inbox not enabled"}     | ${profile(withInboxDisabled, withPreferences(MANUAL))} | ${profile(withInboxDisabled, withPreferences(AUTO))}   | ${[]}
    ${"preference mode is changed from MANUAL to AUTO with inbox not enabled"}     | ${profile(withInboxDisabled, withPreferences(AUTO))}   | ${profile(withInboxDisabled, withPreferences(MANUAL))} | ${[]}
  `(
    "should emit expected events when $scenario",
    ({
      expectedEvents,
      newProfile,
      oldProfile,
    }: {
      expectedEvents: ReadonlyArray<typeof anyProfileCompletedEvent>;
      newProfile: Profile;
      oldProfile: Profile;
    }) => {
      const orchestratorInput = pipe(
        {
          newProfile,
          updatedAt: new Date(),
          oldProfile,
          name: aName,
        },
        UpsertedProfileOrchestratorInput.decode,
        E.getOrElseW((errs) =>
          assert.fail(
            `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
              errs,
            )}`,
          ),
        ),
      );

      const mockContextWithDf = {
        ...contextMock,
        df: {
          Task: {
            all: (tasks: ReadonlyArray<unknown>) => tasks,
          },
          callActivityWithRetry: vi
            .fn()
            .mockImplementation((name, _, input) =>
              callActivityBase(name, input),
            ),
          callSubOrchestratorWithRetry: vi.fn(),
          getInput: vi.fn(() => orchestratorInput),
        },
      } as unknown as df.OrchestrationContext;

      const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
        sendCashbackMessage: true,
      })(mockContextWithDf);

      consumeGenerator(orchestratorHandler);

      // expect every event to be emitted
      expectedEvents.forEach((evt) => {
        expect(mockEmitEventActivity).toBeCalledWith(evt);
      });

      expect(mockEmitEventActivity).toBeCalledTimes(expectedEvents.length);
    },
  );
});
