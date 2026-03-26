ARG SOLANA_BUILDER_VERSION=latest

FROM pjlangley/ff_solana_builder:${SOLANA_BUILDER_VERSION}

ARG ANCHOR_VERSION=0.31.1
ENV ANCHOR_VERSION=${ANCHOR_VERSION}
ARG RUST_VERSION=1.94.0
ENV RUST_VERSION=${RUST_VERSION}

WORKDIR /anchor
RUN rustup install ${RUST_VERSION} && rustup default ${RUST_VERSION}
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v${ANCHOR_VERSION} anchor-cli

RUN solana-keygen new --no-bip39-passphrase

WORKDIR /usr/ff
COPY fragments/blockchain/solana .
COPY solana-cli.docker.yml /root/.config/solana/cli/config.yml
RUN anchor clean
RUN rm -rf target/ .anchor/
RUN anchor build --provider.wallet /root/.config/solana/id.json
RUN anchor keys sync
RUN anchor build --provider.wallet /root/.config/solana/id.json
ENTRYPOINT ["anchor"]
CMD ["--help"]