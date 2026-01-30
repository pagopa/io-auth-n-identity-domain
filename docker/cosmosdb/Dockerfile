FROM node:20.20.0-alpine

WORKDIR /opt/cosmosdb

RUN corepack enable
RUN pnpm install -g @zeit/cosmosdb-server ts-node

CMD ["sh", "-c", "cosmosdb-server -p 3000"]
