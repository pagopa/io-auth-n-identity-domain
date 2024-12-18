FROM functions-node-20 AS base

WORKDIR /usr/src/app
COPY . /usr/src/app

RUN yarn install --immutable
RUN yarn build

FROM functions-node-20 AS runner
COPY --from=base /usr/src/app/package.json ./package.json
COPY --from=base /usr/src/app/turbo.json ./turbo.json
COPY --from=base /usr/src/app/node_modules ./node_modules

COPY --from=base /usr/src/app/packages/typescript-config-node ./packages/typescript-config-node

COPY --from=base /usr/src/app/apps/io-lollipop ./apps/io-lollipop

WORKDIR /usr/src/app/apps/io-lollipop

RUN yarn extensions:install

CMD ["func", "start", "--javascript"]
