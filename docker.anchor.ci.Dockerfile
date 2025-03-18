FROM pjlangley/ff_solana_builder:2.1.9

WORKDIR /anchor
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli

# see https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-in-docker
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV BASH_ENV=/root/.bash_env
RUN touch "${BASH_ENV}"
RUN echo '. "${BASH_ENV}"' >> ~/.bashrc
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | PROFILE="${BASH_ENV}" bash
RUN nvm install 22.14.0
ENV PATH="/root/.nvm/versions/node/v22.14.0/bin:${PATH}"

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