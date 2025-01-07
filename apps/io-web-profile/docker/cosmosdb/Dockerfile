FROM node:18.13.0-alpine

WORKDIR /opt/cosmosdb

USER root

RUN npm install -g @zeit/cosmosdb-server ts-node

CMD ["sh", "-c", "cosmosdb-server -p 3000"]
