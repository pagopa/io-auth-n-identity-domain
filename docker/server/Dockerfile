ARG SERVER_NAME

FROM node:20.20.0-alpine3.19 AS base
RUN corepack enable
COPY . /usr/src/app


FROM base AS builder
ARG SERVER_NAME
WORKDIR /usr/src/app
RUN pnpm dlx turbo@^2.5.5 prune ${SERVER_NAME} --docker


FROM node:20.20.0-alpine3.19 AS installer
WORKDIR /usr/src/app
RUN corepack enable
RUN apk add openssl
COPY --from=builder /usr/src/app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=builder /usr/src/app/out/full/ .
RUN pnpm turbo run build


FROM node:20.20.0-alpine AS runner
ARG SERVER_NAME
WORKDIR /usr/src/app/apps/${SERVER_NAME}
COPY --from=installer --chown=node:node /usr/src/app /usr/src/app

# bug: pnpm logs requires write permission for tmp folder
RUN chown -R node:node /tmp

USER node
CMD ["node", "dist/server.js"]
