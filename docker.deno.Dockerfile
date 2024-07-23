FROM denoland/deno:1.45.2
ENV REPO_NAME=fullstack_fragments
WORKDIR /app
COPY fragments/ ./fragments/
COPY README.md .
COPY deno.json .
COPY deno.lock .
ENTRYPOINT ["deno", "task", "fragment"]
CMD ["fragments/main.deno.ts"]