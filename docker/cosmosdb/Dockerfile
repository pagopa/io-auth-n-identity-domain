FROM node:22-alpine@sha256:7342a94c926da5486caf3d477ac8f57a63041d92f7574ea318c27b67ed36aedd

WORKDIR /opt/cosmosdb

RUN npm install -g @zeit/cosmosdb-server ts-node

CMD ["sh", "-c", "cosmosdb-server -p 3000"]
