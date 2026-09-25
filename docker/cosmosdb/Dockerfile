FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

WORKDIR /opt/cosmosdb

RUN npm install -g @zeit/cosmosdb-server ts-node

CMD ["sh", "-c", "cosmosdb-server -p 3000"]
