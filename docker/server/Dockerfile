ARG SERVER_NAME

FROM node:20.12.2-alpine3.19 AS base
COPY . /usr/src/app


FROM base AS builder
ARG SERVER_NAME
WORKDIR /usr/src/app
RUN yarn dlx turbo@^1.12.5 prune ${SERVER_NAME} --docker


FROM node:20.12.2-alpine3.19 AS installer
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/out/json/ .
RUN yarn install --immutable
COPY --from=builder /usr/src/app/out/full/ .
RUN yarn turbo run build


FROM node:20.12.2-alpine AS runner
ARG SERVER_NAME
WORKDIR /usr/src/app/apps/${SERVER_NAME}
COPY --from=installer --chown=node:node /usr/src/app /usr/src/app

# bug: yarn logs requires write permission for tmp folder
RUN chown -R node:node /tmp

USER node
CMD ["node", "dist/server.js"]
