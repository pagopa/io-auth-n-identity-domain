# syntax=docker/dockerfile:1

FROM public.ecr.aws/docker/library/node:24.22.2-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@^2.9.16 prune io-web-auth-service --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ ./
RUN pnpm exec turbo run build --filter=io-web-auth-service...
RUN pnpm --filter io-web-auth-service --prod deploy --legacy /repo/deploy

FROM public.ecr.aws/docker/library/node:24.22.2-alpine AS runtime
WORKDIR /app
COPY --chown=node:node --from=builder /repo/deploy/node_modules ./node_modules
COPY --chown=node:node --from=builder /repo/deploy/dist ./dist
COPY --chown=node:node --from=builder /repo/deploy/package.json ./package.json
COPY --chown=node:node --from=builder /repo/deploy/applicationinsights.json ./applicationinsights.json

USER node
EXPOSE 8080
CMD ["npm", "start"]
