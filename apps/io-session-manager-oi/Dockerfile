# syntax=docker/dockerfile:1@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89

FROM public.ecr.aws/docker/library/node:24.16.0-alpine@sha256:21f403ab171f2dc89bad4dd69d7721bfd15f084ccb46cdd225f31f2bc59b5c9a AS base
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
RUN pnpm exec turbo run build --filter io-session-manager-oi 

RUN pnpm --filter io-session-manager-oi --prod deploy --legacy /repo/deploy

FROM public.ecr.aws/docker/library/node:24.16.0-alpine@sha256:21f403ab171f2dc89bad4dd69d7721bfd15f084ccb46cdd225f31f2bc59b5c9a AS runtime
WORKDIR /app

COPY --chown=node:node --from=builder /repo/deploy/node_modules ./node_modules
COPY --chown=node:node --from=builder /repo/deploy/dist ./dist
COPY --chown=node:node --from=builder /repo/deploy/package.json ./package.json

USER node
EXPOSE 8080

CMD ["npm", "start"]
