ARG SERVER_NAME

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS base
COPY . /usr/src/app


FROM base AS builder
ARG SERVER_NAME
WORKDIR /usr/src/app
RUN corepack enable pnpm && pnpm dlx turbo@^2.5.5 prune ${SERVER_NAME} --docker


FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS installer
WORKDIR /usr/src/app
RUN apk add openssl
COPY --from=builder /usr/src/app/out/json/ .
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY --from=builder /usr/src/app/out/full/ .
RUN pnpm exec turbo run build


FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runner
ARG SERVER_NAME
RUN corepack enable pnpm
WORKDIR /usr/src/app/apps/${SERVER_NAME}
COPY --from=installer --chown=node:node /usr/src/app /usr/src/app

# bug: npm logs requires write permission for tmp folder
RUN chown -R node:node /tmp

USER node
CMD ["pnpm", "run", "start"]
