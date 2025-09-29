ARG NODE_VERSION=22
ARG DENO_VERSION=2.1.6

FROM denoland/deno:bin-${DENO_VERSION} AS deno

FROM node:${NODE_VERSION}-bullseye
COPY --from=deno /deno /usr/local/bin/deno
ENV REPO_NAME=ff
WORKDIR /usr/src/app
COPY package*.json .
COPY tsconfig.json .
COPY tsconfig.api.json .
COPY .npmrc .
COPY deno.json .
COPY *.md .
COPY docker_hub/ docker_hub/
RUN npm ci
COPY fragments/ ./fragments/
RUN node --run api:build

ENTRYPOINT ["node"]
CMD ["--run", "fragments"]
