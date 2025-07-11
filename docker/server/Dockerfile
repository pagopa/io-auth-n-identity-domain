ARG SERVER_NAME

FROM node:20.12.2-alpine3.19@sha256:7a91aa397f2e2dfbfcdad2e2d72599f374e0b0172be1d86eeb73f1d33f36a4b2 AS base
COPY . /usr/src/app


FROM base AS builder
ARG SERVER_NAME
WORKDIR /usr/src/app
RUN yarn dlx turbo@^1.12.5 prune ${SERVER_NAME} --docker


FROM node:20.12.2-alpine3.19@sha256:7a91aa397f2e2dfbfcdad2e2d72599f374e0b0172be1d86eeb73f1d33f36a4b2 AS installer
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/out/json/ .
RUN yarn install --immutable
COPY --from=builder /usr/src/app/out/full/ .
RUN yarn turbo run build


FROM node:20.12.2-alpine@sha256:7a91aa397f2e2dfbfcdad2e2d72599f374e0b0172be1d86eeb73f1d33f36a4b2 AS runner
ARG SERVER_NAME
WORKDIR /usr/src/app/apps/${SERVER_NAME}
COPY --from=installer --chown=node:node /usr/src/app /usr/src/app

# bug: yarn logs requires write permission for tmp folder
RUN chown -R node:node /tmp

USER node
CMD ["node", "dist/server.js"]
