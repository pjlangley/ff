# ff_node

This image is publicly accessible so that the Kubernetes clusters for
[https://github.com/pjlangley/ff](https://github.com/pjlangley/ff) can pull it: k3s on EC2 in AWS, and a local KIND
cluster. Its purpose is not for general public usage.

Details:

- Compiles the Node.js fragments in
  [https://github.com/pjlangley/ff](https://github.com/pjlangley/ff/tree/main/fragments), including the Fastify API and
  the Solana register sync consumers
- See this [Dockerfile](https://github.com/pjlangley/ff/blob/main/docker.node.Dockerfile) for details of what's inside
- Multi-arch: the **amd64** and **arm64** OS/Archs are supported, and each tag resolves to the platform of the host
  pulling it

## Usage

The default command runs the Fastify API on port `3000`:

```sh
docker run --rm -p 3000:3000 pjlangley/ff_node:latest
```

The Solana register sync consumers run from the same image with a command override:

```sh
docker run --rm pjlangley/ff_node:latest node ./fragments/apis/fastify/dist/solana_register_sync/registrants_consumer.js
docker run --rm pjlangley/ff_node:latest node ./fragments/apis/fastify/dist/solana_register_sync/confirmed_consumer.js
```

For what each consumer does, and the configuration and AWS access it needs, see
[Solana register sync pipeline](https://github.com/pjlangley/ff#solana-register-sync-pipeline) in the project README.
