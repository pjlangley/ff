# need GLIBC >= 2.38 for `anchor build`
FROM ubuntu:24.04 AS builder

ARG AGAVE_VERSION=2.1.9
ENV AGAVE_VERSION=${AGAVE_VERSION}

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y \
    libssl-dev libudev-dev pkg-config zlib1g-dev llvm clang cmake make libprotobuf-dev protobuf-compiler \
    git build-essential curl

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN sh -c "$(curl -sSfL https://release.anza.xyz/v${AGAVE_VERSION}/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

FROM ubuntu:24.04 AS runtime
COPY --from=builder /root/.local/share/solana/install/active_release/bin /root/.local/share/solana/install/active_release/bin
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"
WORKDIR /usr/ff

ENTRYPOINT ["solana"]
CMD ["--help"]