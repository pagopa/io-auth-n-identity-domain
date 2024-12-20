FROM node:20.12.2-alpine@sha256:7a91aa397f2e2dfbfcdad2e2d72599f374e0b0172be1d86eeb73f1d33f36a4b2 as base

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
COPY --from=base /usr/src/app/apps/io-session-manager/package.json ./apps/io-session-manager/
COPY --from=base /usr/src/app/apps/io-session-manager/node_modules ./apps/io-session-manager/
COPY --from=base /usr/src/app/apps/io-session-manager/dist ./apps/io-session-manager/

WORKDIR /usr/src/app/apps/io-session-manager

EXPOSE 80

USER node

CMD ["node", "dist/server.js"]
