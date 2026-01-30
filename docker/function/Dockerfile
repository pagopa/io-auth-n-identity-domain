ARG FUNCTION_NAME

FROM node:20.20.0 AS base
RUN corepack enable
COPY . /usr/src/app


FROM base AS builder
ARG FUNCTION_NAME
WORKDIR /usr/src/app
RUN pnpm dlx turbo@^2.5.5 prune ${FUNCTION_NAME} --docker


FROM node:20.20.0 AS installer
WORKDIR /usr/src/app
RUN corepack enable
COPY --from=builder /usr/src/app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=builder /usr/src/app/out/full/ .
RUN pnpm turbo run build


FROM node:20.20.0 AS functions-node-20
RUN corepack enable
RUN pnpm i -g azure-functions-core-tools@4 --unsafe-perm true


FROM functions-node-20 AS runner
ARG FUNCTION_NAME
ENV AzureWebJobsScriptRoot=/usr/src/app \
  AzureFunctionsJobHost__Logging__Console__IsEnabled=true

WORKDIR /usr/src/app/apps/${FUNCTION_NAME}
COPY --from=installer /usr/src/app /usr/src/app

RUN pnpm run extensions:install

CMD ["func", "start", "--javascript"]