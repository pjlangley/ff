FROM node:22-bullseye
COPY --from=denoland/deno:bin-2.1.6 /deno /usr/local/bin/deno
ENV REPO_NAME=ff
WORKDIR /usr/src/app
COPY package*.json .
COPY tsconfig.json .
COPY .npmrc .
COPY deno.json .
COPY *.md .
COPY docker_hub/ docker_hub/
RUN npm install
COPY fragments/ ./fragments/
ENTRYPOINT ["npm", "run", "fragment", "--"]
CMD ["fragments/main.ts"]
