FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920

WORKDIR /opt/cosmosdb

RUN npm install -g @zeit/cosmosdb-server ts-node

CMD ["sh", "-c", "cosmosdb-server -p 3000"]
