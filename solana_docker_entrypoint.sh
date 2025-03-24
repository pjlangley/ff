#!/bin/bash
set -e

solana-keygen new --no-bip39-passphrase

# run the original command
exec "$@"