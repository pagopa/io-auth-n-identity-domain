## IO Auth n Identity domain utilities

This monorepo package contains a bunch of utilities and scripts to facilitate
some types of operations.

### How to run a script

From the root of the monorepo simply run
`pnpm --filter utilities <SCRIPT_NAME> <...ARGUMENTS>`

### Session expire queue insert script

This script inserts batch of items into a queue.
To run it launch from the monorepo root

`pnpm --filter utilities build && pnpm --filter utilities session:expire:insert <PARAMETERS>`

When `--help` is passed, an help message will greet the user with description for all parameters.

#### Limit the numbers of items visible to the queue hourly

Let's say you want to limit the hourly visible items in the queue.
The script uses the `visibilityTimeout` parameter (expressed in seconds) to determine
when an item will become visible.

To limit the visibility hourly you need to configure the parameters as such:

```
HOURLY_BATCHES = DESIRED_HOURLY_LIMIT / SINGLE_BATCH_SIZE
TIMEOUT_MULTIPLIER = 3600 / HOURLY_BACHES
```

With this in mind, we would call the script with `--singleBatchCount=... --timeoutMultiplier=...` according to the calculations made above.

### Using Service Bus Sender script

We include a tool to send test messages to an Azure Service Bus topic.

The tool uses `DefaultAzureCredential` for authentication, so you need to be logged in with an Azure account that has the appropriate permissions on the target Service Bus namespace.

```sh
pnpm build
pnpm --filter utilities service:bus:sender -- \
  --fqdn <service-bus-fqdn> \
  --topic <topic-name> \
  --fc <fiscal-code> \
  --type <login|logout|mixed> \
  [--loginType <LV|LEGACY>] \
  [--number <n>]
```

#### Examples

```sh
# Send a single login event with loginType=LV
pnpm --filter utilities service:bus:sender -- \
  --fqdn my-namespace.servicebus.windows.net \
  --topic my-topic \
  --fc ISPXNB32R82Y766D \
  --type login \
  --loginType LV

# Send a single login event with loginType=LEGACY
pnpm --filter utilities service:bus:sender -- \
  --fqdn my-namespace.servicebus.windows.net \
  --topic my-topic \
  --fc ISPXNB32R82Y766D \
  --type login \
  --loginType LEGACY

# Send 5 mixed events (loginType chosen randomly for each login event)
pnpm --filter utilities service:bus:sender -- \
  --fqdn my-namespace.servicebus.windows.net \
  --topic my-topic \
  --fc ISPXNB32R82Y766D \
  --type mixed \
  --number 5
```
