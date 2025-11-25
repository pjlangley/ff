ARG RUST_VERSION=1.85.1

FROM rust:${RUST_VERSION}
WORKDIR /usr/src/myapp
COPY Cargo.lock .
COPY Cargo.toml .
COPY rust-toolchain.toml .
COPY fragments ./fragments/
RUN cargo build -v --bin api
EXPOSE 3001

ENTRYPOINT ["target/debug/api"]