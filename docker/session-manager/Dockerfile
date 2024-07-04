FROM node:20.12.2-alpine as base

USER root

RUN apk update

COPY ./ /usr/src/app/

WORKDIR /usr/src/app

# RUN corepack enable && corepack prepare

RUN yarn install --immutable
RUN yarn build

FROM base as runner
COPY --from=base /usr/src/app/package.json ./
COPY --from=base /usr/src/app/turbo.json ./
COPY --from=base /usr/src/app/node_modules ./
COPY --from=base /usr/src/app/apps/session-manager/package.json ./apps/session-manager/
COPY --from=base /usr/src/app/apps/session-manager/node_modules ./apps/session-manager/
COPY --from=base /usr/src/app/apps/session-manager/dist ./apps/session-manager/

WORKDIR /usr/src/app/apps/session-manager

EXPOSE 80

USER node

CMD ["node", "dist/server.js"]
