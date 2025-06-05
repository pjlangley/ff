ARG SOLANA_BUILDER_VERSION=latest
FROM pjlangley/ff_solana_builder:${SOLANA_BUILDER_VERSION} AS solana_builder

FROM ubuntu:24.04
COPY --from=solana_builder /root/.local/share/solana/install/active_release/bin /root/.local/share/solana/install/active_release/bin

ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"
WORKDIR /usr/ff

ENTRYPOINT ["solana"]
CMD ["--help"]