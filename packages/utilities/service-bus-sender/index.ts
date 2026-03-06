/* eslint-disable no-console */
import { DefaultAzureCredential } from "@azure/identity";
import { ServiceBusClient } from "@azure/service-bus";
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
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

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
      choices: ["login", "logout", "mixed"],
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
    return true;
  })
  .strict()
  .help()
  .parseSync();

const numberOfMessages = argv.n;
const desiredEventType = argv.t as EventTypeEnum | "mixed";
const fullyQualifiedNamespace = argv.fqdn;
const topicName = argv.topic;
const fiscalCode = argv.fc;
const desiredLoginType = argv.lt as LoginTypeEnum | undefined;

const generateEventType = (): EventTypeEnum =>
  Math.random() > 0.5 ? EventTypeEnum.LOGIN : EventTypeEnum.LOGOUT;

const generateLoginType = (): LoginTypeEnum =>
  Math.random() > 0.5 ? LoginTypeEnum.LV : LoginTypeEnum.LEGACY;

const generateLogoutBody = (fiscalCode: FiscalCode): LogoutEvent => ({
  eventType: EventTypeEnum.LOGOUT,
  fiscalCode,
  scenario: LogoutScenarioEnum.WEB,
  ts: new Date(),
});

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

const generateMessage = (
  fiscalCode: string,
  eventType: EventTypeEnum,
  loginType: LoginTypeEnum,
) => ({
  body:
    eventType === EventTypeEnum.LOGIN
      ? generateLoginBody(fiscalCode as FiscalCode, loginType)
      : generateLogoutBody(fiscalCode as FiscalCode),
  contentType: "application/json",
  applicationProperties: {
    eventType,
  },
  sessionId: fiscalCode,
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

  console.log(
    `📤 Sending ${numberOfMessages} message(s) to topic '${topicName}', eventType ${desiredEventType}, cf ${fiscalCode}, fqdn ${fullyQualifiedNamespace}`,
  );

  for (let i = 0; i < numberOfMessages; i++) {
    const eventType =
      desiredEventType === "mixed" ? generateEventType() : desiredEventType;

    const loginType: LoginTypeEnum =
      desiredEventType === "mixed" ? generateLoginType() : desiredLoginType!;

    const message = generateMessage(fiscalCode, eventType, loginType);

    await sender.sendMessages(message);

    console.info(
      `✅ Message ${i + 1} sent => (${JSON.stringify(message.body)})`,
    );
  }

  if (sender.isClosed) {
    console.info("ServiceBus sender is closed =>", sender.isClosed);
  } else {
    console.info("ServiceBus sender is state =>", sender.isClosed);
    await sender.close();
    await client.close();
    console.info("🚪 Connection closed.");
  }
}

main().catch((err) => {
  console.error("❌ Error sending messages:", err);
  process.exit(1);
});
