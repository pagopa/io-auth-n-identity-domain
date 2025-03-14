ARG SERVER_NAME

FROM monorepo AS builder
ARG SERVER_NAME
WORKDIR /usr/src/app
RUN turbo prune ${SERVER_NAME} --docker


FROM node:20.12.0 AS installer
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/out/json/ .
RUN yarn install --immutable
COPY --from=builder /usr/src/app/out/full/ .
RUN yarn turbo run build


FROM node:20.12.2-alpine AS runner
ARG SERVER_NAME
WORKDIR /usr/src/app
COPY --from=installer /usr/src/app/apps/${SERVER_NAME} .

# bug: yarn logs requires write permission for tmp folder
RUN chown -R node:node /tmp

USER node
CMD ["node", "dist/server.js"]
