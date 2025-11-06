ARG RUST_VERSION=1.85.1

FROM rust:${RUST_VERSION}
WORKDIR /usr/src/myapp
ENV REPO_NAME=ff
COPY Cargo.lock .
COPY Cargo.toml .
COPY rust-toolchain.toml .
COPY fragments ./fragments/
RUN cargo build -v --bin fragments
RUN cargo build -v --bin api
EXPOSE 3001

ENTRYPOINT ["cargo"]
CMD ["run", "--bin", "fragments"]