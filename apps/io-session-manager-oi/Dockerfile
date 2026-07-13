# syntax=docker/dockerfile:1

FROM public.ecr.aws/docker/library/node:24.16.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .

RUN npx turbo@^2.5.5 prune io-session-manager-oi --docker

FROM base AS builder

COPY --from=pruner /repo/out/json/ ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ ./
RUN pnpm --filter io-session-manager-oi... build

RUN pnpm --filter io-session-manager-oi --prod deploy --legacy /repo/deploy

FROM public.ecr.aws/docker/library/node:24.16.0-alpine AS runtime
WORKDIR /app

COPY --chown=node:node --from=builder /repo/deploy/node_modules ./node_modules
COPY --chown=node:node --from=builder /repo/deploy/dist ./dist
COPY --chown=node:node --from=builder /repo/deploy/package.json ./package.json

USER node
EXPOSE 8080

CMD ["pnpm", "run", "start"]
