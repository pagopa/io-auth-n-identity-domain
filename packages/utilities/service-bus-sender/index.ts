/* eslint-disable no-console */
import { DefaultAzureCredential } from "@azure/identity";
import { ServiceBusClient, ServiceBusMessage } from "@azure/service-bus";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EventTypeEnum } from "@pagopa/io-auth-n-identity-commons/types/session-events/event-type";
import {
  LoginEvent,
  LoginScenarioEnum,
  LoginTypeEnum,
} from "@pagopa/io-auth-n-identity-commons/types/session-events/login-event";
import {
  LogoutEvent,
  LogoutScenarioEnum,
} from "@pagopa/io-auth-n-identity-commons/types/session-events/logout-event";
import {
  RejectedLoginCauseEnum,
  RejectedLoginEvent,
} from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";
import { FiscalCode, IPString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";

// All concrete event types supported by this tool, plus the "mixed" sentinel.
const EVENT_TYPE_CHOICES = [
  "login",
  "logout",
  "rejected_login",
  "mixed",
] as const;
type EventTypeChoice = (typeof EVENT_TYPE_CHOICES)[number];

// All concrete EventTypeEnum values — extend this array when adding new event types.
const ALL_EVENT_TYPES: EventTypeEnum[] = [
  EventTypeEnum.LOGIN,
  EventTypeEnum.LOGOUT,
  EventTypeEnum.REJECTED_LOGIN,
];

const argv = yargs(hideBin(process.argv))
  .options({
    n: {
      type: "number",
      alias: "number",
      default: 1,
      describe: "Number of messages to send",
    },
    t: {
      type: "string",
      alias: "type",
      demandOption: true,
      choices: EVENT_TYPE_CHOICES as unknown as string[],
      describe: "Type of event",
    },
    fqdn: {
      type: "string",
      demandOption: true,
      describe: "Fully qualified domain name of service bus",
    },
    topic: { type: "string", demandOption: true, describe: "Topic name" },
    fc: {
      type: "string",
      alias: "fiscalCode",
      demandOption: true,
      describe: "Fiscal code",
    },
    lt: {
      type: "string",
      alias: "loginType",
      choices: ["lv", "legacy"],
      describe:
        'Login type (required when --type=login, random when --type=mixed): "lv" or "legacy"',
    },
  })
  .check((args) => {
    if (args.t === "login" && !args.lt) {
      throw new Error('--lt (loginType) is required when --type is "login"');
    }
    const decodedFiscalCode = FiscalCode.decode(args.fc);
    if (E.isLeft(decodedFiscalCode)) {
      throw new Error(
        `--fc (fiscalCode) input is invalid: ${readableReportSimplified(decodedFiscalCode.left)}`,
      );
    }
    return true;
  })
  .strict()
  .help()
  .parseSync();

const numberOfMessages = argv.n;
const desiredEventType = argv.t as EventTypeChoice;
const fullyQualifiedNamespace = argv.fqdn;
const topicName = argv.topic;
// valid as fiscalCode by yargs check
const fiscalCode = argv.fc;
const desiredLoginType = argv.lt as LoginTypeEnum | undefined;
const clientIp = "127.0.0.1";

const pickRandom = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

const generateEventType = (): EventTypeEnum => pickRandom(ALL_EVENT_TYPES);

const generateLoginType = (): LoginTypeEnum =>
  pickRandom([LoginTypeEnum.LV, LoginTypeEnum.LEGACY]);

const generateLoginBody = (
  fiscalCode: FiscalCode,
  loginType: LoginTypeEnum,
): LoginEvent => ({
  eventType: EventTypeEnum.LOGIN,
  fiscalCode,
  expiredAt: new Date(),
  loginType,
  scenario: LoginScenarioEnum.STANDARD,
  idp: "xx_servizicie",
  ts: new Date(),
});

const generateLogoutBody = (fiscalCode: FiscalCode): LogoutEvent => ({
  eventType: EventTypeEnum.LOGOUT,
  fiscalCode,
  scenario: LogoutScenarioEnum.WEB,
  ts: new Date(),
});

const generateRejectedLoginBody = (
  fc: FiscalCode,
  ip: IPString,
): RejectedLoginEvent => ({
  eventType: EventTypeEnum.REJECTED_LOGIN,
  fiscalCode: fc,
  ip,
  rejectionCause: RejectedLoginCauseEnum.AUTH_LOCK,
  ts: new Date(),
});

const generateBody = (
  fc: FiscalCode,
  eventType: EventTypeEnum,
  loginType: LoginTypeEnum,
  ip: IPString,
):
  | t.OutputOf<typeof LoginEvent>
  | t.OutputOf<typeof LogoutEvent>
  | t.OutputOf<typeof RejectedLoginEvent> => {
  switch (eventType) {
    case EventTypeEnum.LOGIN:
      return LoginEvent.encode(generateLoginBody(fc, loginType));
    case EventTypeEnum.LOGOUT:
      return LogoutEvent.encode(generateLogoutBody(fc));
    case EventTypeEnum.REJECTED_LOGIN:
      return RejectedLoginEvent.encode(generateRejectedLoginBody(fc, ip));
  }
};

const generateMessage = (
  fc: FiscalCode,
  eventType: EventTypeEnum,
  loginType: LoginTypeEnum,
  ip: IPString,
): ServiceBusMessage => ({
  body: generateBody(fc, eventType, loginType, ip),
  contentType: "application/json",
  applicationProperties: { eventType },
  sessionId: fc,
});

async function main(): Promise<void> {
  const credential = new DefaultAzureCredential();
  const client = new ServiceBusClient(fullyQualifiedNamespace, credential, {
    retryOptions: {
      maxRetries: 3,
      retryDelayInMs: 100,
      maxRetryDelayInMs: 0,
      timeoutInMs: 5000,
    },
  });
  const sender = client.createSender(topicName);

  try {
    console.log(
      `📤 Sending ${numberOfMessages} message(s) to topic '${topicName}', eventType ${desiredEventType}, cf ${fiscalCode}, fqdn ${fullyQualifiedNamespace}`,
    );

    for (let i = 0; i < numberOfMessages; i++) {
      const eventType: EventTypeEnum =
        desiredEventType === "mixed"
          ? generateEventType()
          : (desiredEventType as EventTypeEnum);

      const loginType =
        desiredEventType === "mixed" ? generateLoginType() : desiredLoginType;

      const message = generateMessage(
        fiscalCode as FiscalCode,
        eventType,
        loginType as LoginTypeEnum,
        clientIp as IPString,
      );

      await sender.sendMessages(message);

      console.info(
        `✅ Message ${i + 1} sent => (${JSON.stringify(message.body)})`,
      );
    }
  } finally {
    try {
      await sender.close();
    } catch (closeSenderError) {
      console.error("Error closing ServiceBus sender:", closeSenderError);
    }
    try {
      await client.close();
    } catch (closeClientError) {
      console.error("Error closing ServiceBus client:", closeClientError);
    }
  }
}

main().catch((err) => {
  console.error("❌ Error sending messages:", err);
  process.exit(1);
});
