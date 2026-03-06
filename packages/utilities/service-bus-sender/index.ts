/* eslint-disable no-console */
import { DefaultAzureCredential } from "@azure/identity";
import { ServiceBusClient } from "@azure/service-bus";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type EventType = "login" | "logout" | "mixed";
type LoginType = "LV" | "LEGACY";

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
      choices: ["LV", "LEGACY"],
      describe:
        'Login type (required when --type=login, random when --type=mixed): "LV" or "LEGACY"',
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
const desiredEventType = argv.t as EventType;
const fullyQualifiedNamespace = argv.fqdn;
const topicName = argv.topic;
const fiscalCode = argv.fc;
const desiredLoginType = argv.lt as LoginType | undefined;

const generateEventType = (): "login" | "logout" =>
  Math.random() > 0.5 ? "login" : "logout";

const generateLoginType = (): LoginType =>
  Math.random() > 0.5 ? "LV" : "LEGACY";

const generateLogoutBody = (fiscalCode: string) => ({
  eventType: "logout",
  fiscalCode,
  scenario: "web",
  ts: Date.now(),
});

const generateLoginBody = (fiscalCode: string, loginType: LoginType) => ({
  eventType: "login",
  fiscalCode,
  expiredAt: Date.now(),
  loginType,
  idp: "xx_servizicie",
  ts: Date.now(),
});

const generateMessage = (
  fiscalCode: string,
  eventType: "login" | "logout",
  loginType: LoginType,
) => ({
  body:
    eventType === "login"
      ? generateLoginBody(fiscalCode, loginType)
      : generateLogoutBody(fiscalCode),
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

    const loginType: LoginType =
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
