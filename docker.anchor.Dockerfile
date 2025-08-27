ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-bullseye AS node

# depends on local ff_solana_builder image (from ./docker.solana.Dockerfile)
FROM ff_solana_builder
COPY --from=node /usr/local /usr/local

ARG ANCHOR_VERSION=0.31.1
ENV ANCHOR_VERSION=${ANCHOR_VERSION}
ARG RUST_VERSION=1.89.0
ENV RUST_VERSION=${RUST_VERSION}

WORKDIR /anchor
RUN rustup install ${RUST_VERSION} && rustup default ${RUST_VERSION}
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v${ANCHOR_VERSION} anchor-cli

RUN solana-keygen new --no-bip39-passphrase

WORKDIR /usr/ff
COPY fragments/blockchain/solana .
COPY .npmrc .
COPY solana-cli.docker.yml /root/.config/solana/cli/config.yml
RUN npm install
RUN anchor clean
RUN rm -rf target/ .anchor/
RUN anchor build --provider.wallet /root/.config/solana/id.json
RUN anchor keys sync
RUN anchor build --provider.wallet /root/.config/solana/id.json

ENTRYPOINT ["anchor"]
CMD ["--help"]