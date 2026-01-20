FROM node:20.12.2-alpine

WORKDIR /opt/cosmosdb

RUNpnpm install -g @zeit/cosmosdb-server ts-node

CMD ["sh", "-c", "cosmosdb-server -p 3000"]
