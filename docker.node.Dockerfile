FROM node:20
ENV REPO_NAME=fullstack_fragments
WORKDIR /usr/src/app
COPY fragments/ ./fragments/
COPY package*.json .
COPY tsconfig.json .
COPY .eslintrc.json .
RUN npm install
ENTRYPOINT ["npm", "run", "fragment", "--"]
CMD ["fragments/main.node.ts"]
