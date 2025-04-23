FROM ubuntu:24.04
COPY --from=pjlangley/ff_solana_builder:2.2.6 /root/.local/share/solana/install/active_release/bin /root/.local/share/solana/install/active_release/bin
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"
WORKDIR /usr/ff

ENTRYPOINT ["solana"]
CMD ["--help"]