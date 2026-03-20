ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /usr/src/app
COPY package*.json .
COPY tsconfig.json .
COPY tsconfig.api.json .
COPY .npmrc .
RUN npm ci
COPY fragments/ ./fragments/
RUN node --run api:build

FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
WORKDIR /usr/src/app
COPY package*.json .
COPY .npmrc .
ENV NODE_ENV=production
RUN npm ci

FROM node:${NODE_VERSION}-bookworm-slim
RUN adduser --disabled-password --gecos "" ff
WORKDIR /usr/src/app
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/fragments/apis/fastify/dist ./fragments/apis/fastify/dist
USER ff
EXPOSE 3000
CMD ["node", "./fragments/apis/fastify/dist/api.js"]
