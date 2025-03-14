ARG APP="io-fast-login"

FROM monorepo AS builder
ARG APP
WORKDIR /usr/src/app
RUN turbo prune ${APP} --docker


FROM node:20.12.0 AS installer
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/out/json/ .
RUN yarn install --immutable
COPY --from=builder /usr/src/app/out/full/ .
RUN yarn turbo run build


FROM functions-node-20 AS runner
ARG APP
WORKDIR /usr/src/app
COPY --from=installer /usr/src/app/apps/${APP} .
RUN yarn extensions:install
CMD ["func", "start", "--javascript"]
