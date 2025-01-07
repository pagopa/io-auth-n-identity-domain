FROM node:18.13.0-alpine as builder

WORKDIR /opt/azurite

USER root

RUN apk update && apk upgrade && \
  apk add --no-cache bash git openssh

RUN git config --global --add safe.directory /opt/azurite

RUN git clone https://github.com/Azure/Azurite /opt/azurite && \
  git checkout legacy-master

USER root

RUN npm install

FROM node:18.13.0-alpine

COPY --from=builder /opt/azurite /opt/azurite

WORKDIR /opt/azurite

VOLUME /opt/azurite/folder

ENV executable azurite

CMD ["sh", "-c", "node bin/${executable} -l /opt/azurite/folder"]
