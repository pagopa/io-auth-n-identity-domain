import { DefaultAzureCredential } from "@azure/identity";
import { ServiceBusClient } from "@azure/service-bus";

// 🔧 Parsing CLI args
const args = process.argv;

const getArgValue = (flags: string[]): string | undefined => {
  const index = args.findIndex((arg) => flags.includes(arg));
  return index !== -1 ? args[index + 1] : undefined;
};

const validateString = (s: string | undefined): string => {
  if (s == undefined || s == "") {
    throw Error();
  }
  return s;
};

const numberOfMessages = parseInt(getArgValue(["-n", "--number"]) ?? "1", 10);
const desiredEventType = validateString(getArgValue(["-t", "--type"]));
const fullyQualifiedNamespace = validateString(
  getArgValue(["-fqdn", "--fqdn"]),
);
const topicName = validateString(getArgValue(["-topic", "--topic"]));
const fiscalCode = validateString(getArgValue(["-fc", "--fiscalCode"]));

if (isNaN(numberOfMessages) || numberOfMessages < 1) {
  console.error("❌ Invalid number of messages. Use -n <number>.");
  process.exit(1);
}

if (!["login", "logout", "mixed"].includes(desiredEventType)) {
  console.error("❌ Invalid type of messages. Use -t <login/logout/mixed>.");
  process.exit(1);
}

const generateEventType = () => (Math.random() > 0.5 ? "login" : "logout");

const generateMessage = (fiscalCode: string, eventType: string) => ({
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

const generateLogoutBody = (fiscalCode: string) => ({
  eventType: "logout",
  fiscalCode,
  scenario: "web",
  ts: new Date().getTime(),
});

const generateLoginBody = (fiscalCode: string) => ({
  eventType: "login",
  fiscalCode,
  expiredAt: new Date().getTime(),
  // NOTE: edit this as you need
  // TODO: edit this part (IOPID-3777)
  _loginType: "legacy",
  _badProp: "standard",
  idp: "xx_servizicie",
  ts: new Date().getTime(),
});

async function main() {
  try {
    const credential = new DefaultAzureCredential();
    const client = new ServiceBusClient(fullyQualifiedNamespace, credential, {
      retryOptions: {
        maxRetries: 0,
        retryDelayInMs: 0,
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

    // wai

    if (sender.isClosed) {
      console.info("ServiceBus sender is closed =>", sender.isClosed);
    } else {
      console.info("ServiceBus sender is state =>", sender.isClosed);
      await sender.close();
      await client.close();
      console.info("🚪 Connection closed.");
    }
  } catch (err) {
    console.error("❌ Error sending messages:", err);
  }
}

main();
