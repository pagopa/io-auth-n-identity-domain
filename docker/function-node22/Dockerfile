ARG FUNCTION_NAME

FROM node:22.22.0 AS base
COPY . /usr/src/app


FROM base AS builder
ARG FUNCTION_NAME
WORKDIR /usr/src/app
RUN yarn dlx turbo@^2.5.5 prune ${FUNCTION_NAME} --docker


FROM node:22.22.0 AS installer
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/out/json/ .
RUN yarn install --immutable
COPY --from=builder /usr/src/app/out/full/ .
RUN yarn turbo run build


FROM node:22.22.0 AS functions-node-22
RUN npm i -g azure-functions-core-tools@4 --unsafe-perm true


FROM functions-node-22 AS runner
ARG FUNCTION_NAME
ENV AzureWebJobsScriptRoot=/usr/src/app \
  AzureFunctionsJobHost__Logging__Console__IsEnabled=true

WORKDIR /usr/src/app/apps/${FUNCTION_NAME}
COPY --from=installer /usr/src/app /usr/src/app

RUN npm run extensions:install

CMD ["func", "start", "--javascript"]