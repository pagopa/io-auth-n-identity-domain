ARG SERVER_NAME

FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS base
COPY . /usr/src/app


FROM base AS builder
ARG SERVER_NAME
WORKDIR /usr/src/app
RUN corepack enable pnpm && pnpm dlx turbo@^2.5.5 prune ${SERVER_NAME} --docker


FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS installer
WORKDIR /usr/src/app
RUN apk add openssl
COPY --from=builder /usr/src/app/out/json/ .
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY --from=builder /usr/src/app/out/full/ .
RUN pnpm exec turbo run build


FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS runner
ARG SERVER_NAME
RUN corepack enable pnpm
WORKDIR /usr/src/app/apps/${SERVER_NAME}
COPY --from=installer --chown=node:node /usr/src/app /usr/src/app

# bug: npm logs requires write permission for tmp folder
RUN chown -R node:node /tmp

USER node
CMD ["node", "dist/server.js"]
