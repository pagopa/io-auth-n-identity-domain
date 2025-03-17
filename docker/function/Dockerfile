ARG FUNCTION_NAME

FROM node:20.12.2 AS base
COPY . /usr/src/app


FROM base AS builder
ARG FUNCTION_NAME
WORKDIR /usr/src/app
RUN yarn dlx turbo@^1.12.5 prune ${FUNCTION_NAME} --docker


FROM node:20.12.2 AS installer
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/out/json/ .
RUN yarn install --immutable
COPY --from=builder /usr/src/app/out/full/ .
RUN yarn turbo run build


FROM functions-node-20 AS runner
ARG FUNCTION_NAME
WORKDIR /usr/src/app
COPY --from=installer /usr/src/app/apps/${FUNCTION_NAME} .
RUN yarn extensions:install
CMD ["func", "start", "--javascript"]
