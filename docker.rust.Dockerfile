FROM rust:1.79.0
WORKDIR /usr/src/myapp
ENV REPO_NAME=fullstack_fragments
COPY Cargo.lock .
COPY Cargo.toml .
RUN rustup component add clippy
RUN rustup component add rustfmt
COPY fragments ./fragments/
ENTRYPOINT ["cargo"]
CMD ["run", "--bin", "fragments"]