FROM node:20.12.2-alpine as base

USER root

RUN apk update

COPY ./ /usr/src/app/

WORKDIR /usr/src/app

# RUN corepack enable && corepack prepare

RUN yarn install --immutable
RUN yarn build

FROM node:20.12.2-alpine as runner
WORKDIR /usr/src/app

# bug: yarn logs requires write permission for tmp folder
RUN chown -R node:node /tmp

COPY --from=base /usr/src/app/package.json ./
COPY --from=base /usr/src/app/turbo.json ./
COPY --from=base /usr/src/app/node_modules ./
COPY --from=base /usr/src/app/apps/io-session-manager/package.json ./apps/io-session-manager/
COPY --from=base /usr/src/app/apps/io-session-manager/node_modules ./apps/io-session-manager/node_modules
COPY --from=base /usr/src/app/apps/io-session-manager/dist ./apps/io-session-manager/dist

WORKDIR /usr/src/app/apps/io-session-manager

EXPOSE 80

USER node

CMD ["node", "dist/server.js"]
