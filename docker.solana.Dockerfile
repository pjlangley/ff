# need GLIBC >= 2.38 for `anchor build`
FROM ubuntu:24.04 AS builder

ARG AGAVE_VERSION=2.2.6
ENV AGAVE_VERSION=${AGAVE_VERSION}

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y \
    libssl-dev libudev-dev pkg-config zlib1g-dev llvm clang cmake make libprotobuf-dev protobuf-compiler \
    git build-essential curl

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# build from source - arm64/aarch64 (i.e. macos m2) linux binary not in https://release.anza.xyz
# see https://github.com/anza-xyz/agave
RUN git clone --branch v${AGAVE_VERSION} --depth 1 https://github.com/anza-xyz/agave.git /agave
WORKDIR /agave
RUN ./scripts/cargo-install-all.sh --debug .
ENV PATH="/agave/bin:${PATH}"

FROM ubuntu:24.04 AS runtime
COPY --from=builder /agave/bin /agave/bin
ENV PATH="/agave/bin:${PATH}"
WORKDIR /usr/ff

ENTRYPOINT ["solana"]
CMD ["--help"]