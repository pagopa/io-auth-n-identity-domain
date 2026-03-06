/* eslint-disable no-console */
import { DefaultAzureCredential } from "@azure/identity";
import { ServiceBusClient } from "@azure/service-bus";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type EventType = "login" | "logout" | "mixed";

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
  })
  .strict()
  .help()
  .parseSync();

const numberOfMessages = argv.n;
const desiredEventType = argv.t as EventType;
const fullyQualifiedNamespace = argv.fqdn;
const topicName = argv.topic;
const fiscalCode = argv.fc;

const generateEventType = (): "login" | "logout" =>
  Math.random() > 0.5 ? "login" : "logout";

const generateLogoutBody = (fiscalCode: string) => ({
  eventType: "logout",
  fiscalCode,
  scenario: "web",
  ts: Date.now(),
});

const generateLoginBody = (fiscalCode: string) => ({
  eventType: "login",
  fiscalCode,
  expiredAt: Date.now(),
  // NOTE: edit this as you need
  // TODO: edit this part (IOPID-3777)
  _loginType: "legacy",
  _badProp: "standard",
  idp: "xx_servizicie",
  ts: Date.now(),
});

const generateMessage = (
  fiscalCode: string,
  eventType: "login" | "logout",
) => ({
  body:
    eventType === "login"
      ? generateLoginBody(fiscalCode)
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

    const message = generateMessage(fiscalCode, eventType);

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
