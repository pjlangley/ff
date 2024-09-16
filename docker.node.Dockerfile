FROM node:22
ENV REPO_NAME=fullstack_fragments
WORKDIR /usr/src/app
COPY package*.json .
COPY tsconfig.json .
COPY .eslintrc.json .
COPY .npmrc .
COPY *.md .
RUN npm install
COPY fragments/ ./fragments/
ENTRYPOINT ["npm", "run", "fragment", "--"]
CMD ["fragments/main.node.ts"]
