ARG FUNCTION_NAME
# BuildKit performs static validation before args injection,
# so we need to set a default value to avoid build failures.
# We use a value that is unlikely to be used in practice in order to catch missing args.
ARG NODE_VERSION=__unset__

FROM node:${NODE_VERSION} AS base
COPY . /usr/src/app


FROM base AS builder
ARG FUNCTION_NAME
WORKDIR /usr/src/app
RUN corepack enable pnpm && pnpm dlx turbo@^2.5.5 prune ${FUNCTION_NAME} --docker


FROM node:${NODE_VERSION} AS installer
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/out/json/ .
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY --from=builder /usr/src/app/out/full/ .
RUN pnpm exec turbo run build


FROM node:${NODE_VERSION} AS functions-node
RUN npm i -g azure-functions-core-tools@4 --unsafe-perm true


FROM functions-node AS runner
ARG FUNCTION_NAME
ENV AzureWebJobsScriptRoot=/usr/src/app \
  AzureFunctionsJobHost__Logging__Console__IsEnabled=true

WORKDIR /usr/src/app/apps/${FUNCTION_NAME}
COPY --from=installer /usr/src/app /usr/src/app

RUN corepack enable pnpm && pnpm run extensions:install

CMD ["func", "start", "--javascript"]