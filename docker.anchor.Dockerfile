# depends on local ff_solana_builder image (from ./docker.solana.Dockerfile)
FROM ff_solana_builder

ARG ANCHOR_VERSION=0.30.1
ENV ANCHOR_VERSION=${ANCHOR_VERSION}
ARG NODE_VERSION=22.14.0
ENV NODE_VERSION=${NODE_VERSION}
ARG NVM_VERSION=0.39.2
ENV NVM_VERSION=${NVM_VERSION}

WORKDIR /anchor
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v${ANCHOR_VERSION} anchor-cli

# see https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-in-docker
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV BASH_ENV=/root/.bash_env
RUN touch "${BASH_ENV}"
RUN echo '. "${BASH_ENV}"' >> ~/.bashrc
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh | PROFILE="${BASH_ENV}" bash
RUN nvm install ${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin:${PATH}"

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

ENTRYPOINT ["anchor"]
CMD ["--help"]