FROM rust:1.79.0
WORKDIR /usr/src/myapp
ENV REPO_NAME=ff
COPY Cargo.lock .
COPY Cargo.toml .
COPY rust-toolchain.toml .
COPY fragments ./fragments/
RUN cargo build -v --bin fragments

ENTRYPOINT ["cargo"]
CMD ["run", "--bin", "fragments"]