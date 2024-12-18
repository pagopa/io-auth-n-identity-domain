FROM node:20.12.0 AS base

WORKDIR /usr/src/app
COPY . /usr/src/app

RUN yarn install --immutable
RUN yarn build

FROM functions-node-20 AS runner
COPY --from=base /usr/src/app/package.json .
COPY --from=base /usr/src/app/turbo.json .
COPY --from=base /usr/src/app/node_modules .
COPY --from=base /usr/src/app/apps/io-lollipop/package.json ./apps/io-lollipop/package.json
COPY --from=base /usr/src/app/apps/io-lollipop/node_modules ./apps/io-lollipop/node_modules
COPY --from=base /usr/src/app/apps/io-lollipop/dist ./apps/io-lollipop/dist
COPY --from=base /usr/src/app/apps/io-lollipop/src ./apps/io-lollipop/src

WORKDIR /usr/src/app/apps/io-lollipop

RUN yarn extensions:install

CMD ["func", "start", "--javascript"]
