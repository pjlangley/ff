ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-bullseye AS node

FROM pjlangley/ff_solana_builder:2.2.6
COPY --from=node /usr/local /usr/local

ARG ANCHOR_VERSION=0.31.1
ENV ANCHOR_VERSION=${ANCHOR_VERSION}

WORKDIR /anchor
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v${ANCHOR_VERSION} anchor-cli

RUN solana-keygen new --no-bip39-passphrase

WORKDIR /usr/ff
COPY fragments/blockchain/solana .
COPY .npmrc .
COPY solana-cli.ci.yml /root/.config/solana/cli/config.yml
RUN npm install
RUN anchor clean
RUN rm -rf target/ .anchor/
RUN anchor build --provider.wallet /root/.config/solana/id.json
RUN anchor keys sync
RUN anchor build --provider.wallet /root/.config/solana/id.json
RUN cargo clippy -- -D warnings
RUN cargo fmt --check -v
RUN anchor test --skip-build --skip-deploy --skip-local-validator

ENTRYPOINT ["anchor"]
CMD ["--help"]