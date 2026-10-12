import { GetSecretValueCommand, type SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { type Message, ReceiveMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import process, { env } from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { getEnvVar } from "../env_vars/env_vars_utils";

// What the two consumers share: the receive loop and its cadence, the envelope check, startup config
// and secrets, and shutdown. Each consumer supplies only what it does with one message.

// SQS's own maximum: a message that lands while the poll is open is received straight away.
const RECEIVE_WAIT_TIME_SECONDS = 20;

// One poll cycle every 30 minutes, whatever the queue holds. The poller publishes at most one
// registration an hour, so two cycles an hour keep up, and a consumer makes ~2 requests an hour
// rather than ~180. Tighten it with `POLL_INTERVAL_SECONDS` when testing; `0` means back-to-back long
// polls, which drains a backlog as fast as it can be processed.
export const DEFAULT_POLL_INTERVAL_SECONDS = 30 * 60;

export interface ConsumeConfig {
  queueUrl: string;
  /** How long to sleep between poll cycles; each cycle handles at most one message. */
  pollIntervalSeconds: number;
}

/**
 * Processes one message end to end, deleting it on success, and returns its log line: an `outcome`
 * plus whatever fields diagnose it. Throwing leaves the message on the queue: the visibility timeout
 * returns it for another attempt, and `maxReceiveCount` eventually routes it to the DLQ.
 */
export type MessageHandler = (message: Message) => Promise<{ outcome: string } & Record<string, unknown>>;

/**
 * One poll cycle: receive at most one message and handle it. Never throws — every failure is logged,
 * and an unprocessed message stays on the queue for SQS to redeliver after its visibility timeout.
 */
const receiveAndHandle = async (
  config: ConsumeConfig,
  sqs: SQSClient,
  signal: AbortSignal,
  handleMessage: MessageHandler,
) => {
  let message: Message | undefined;

  try {
    const result = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: config.queueUrl,
        // One at a time, not a batch: every message in a batch starts its visibility timeout at
        // receive, and one confirmation can take most of the 30s, so the rest would reappear to
        // other consumers while still waiting here.
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: RECEIVE_WAIT_TIME_SECONDS,
      }),
      { abortSignal: signal },
    );
    message = result.Messages?.[0];
  } catch (e) {
    // An abort is shutdown, not a failure.
    if (!signal.aborted) {
      console.error(JSON.stringify({ outcome: "receive_failed", error: String(e) }));
    }
    return;
  }

  if (!message) {
    console.log(JSON.stringify({ outcome: "empty" }));
    return;
  }

  try {
    const { outcome, ...fields } = await handleMessage(message);
    console.log(JSON.stringify({ outcome, message_id: message.MessageId, ...fields }));
  } catch (e) {
    console.error(JSON.stringify({ outcome: "failed", message_id: message.MessageId, error: String(e) }));
  }
};

/**
 * Runs a poll cycle every `config.pollIntervalSeconds` until `signal` aborts.
 *
 * An abort cancels the long poll and the sleep, never a message already received: that is handled to
 * completion first, so a `SIGTERM` (e.g. `kubectl scale --replicas=0`) never abandons one half way
 * through — nor waits out a 30-minute interval.
 */
export const consumeQueue = async (
  config: ConsumeConfig,
  sqs: SQSClient,
  signal: AbortSignal,
  handleMessage: MessageHandler,
) => {
  while (!signal.aborted) {
    await receiveAndHandle(config, sqs, signal, handleMessage);
    await sleep(config.pollIntervalSeconds * 1000, undefined, { signal }).catch(() => {});
  }
};

/**
 * SQS carries the whole EventBridge envelope (the rules set no input transformer), so the payload is
 * under `detail`. Anything that is not `detailType` for this consumer's program is rejected: it
 * throws, and after `maxReceiveCount` lands in the DLQ rather than being acted on against the wrong
 * instance.
 */
export const parseDetail = <T extends { "program_id": string }>(
  message: Message,
  detailType: string,
  programId: string,
): T => {
  const envelope = JSON.parse(message.Body ?? "");

  if (envelope["detail-type"] !== detailType) {
    throw new Error(`Unexpected detail-type ${envelope["detail-type"]} on message ${message.MessageId}`);
  }

  const detail = envelope.detail as T;

  if (detail.program_id !== programId) {
    throw new Error(`Message ${message.MessageId} is for program ${detail.program_id}, not ${programId}`);
  }

  return detail;
};

export const requireEnvVar = (name: string) => {
  const value = getEnvVar(name);

  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }

  return value;
};

/** Optional: unset or empty means the default, anything but a non-negative integer fails startup. */
export const readPollIntervalSeconds = () => {
  const value = getEnvVar("POLL_INTERVAL_SECONDS");

  if (!value) {
    return DEFAULT_POLL_INTERVAL_SECONDS;
  }

  const seconds = Number(value);

  if (!Number.isInteger(seconds) || seconds < 0) {
    throw new Error(`Environment variable POLL_INTERVAL_SECONDS must be a non-negative integer, got ${value}`);
  }

  return seconds;
};

export const readSecretString = async (client: SecretsManagerClient, secretId: string) => {
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));

  if (!result.SecretString) {
    throw new Error(`Secret ${secretId} has no string value`);
  }

  return result.SecretString.trim();
};

/**
 * As in the poller: `initRpcClient` reads `SOLANA_RPC_URL` at call time, so seeding it once at startup
 * points every chain call at Helius without the API key ever being a plaintext env var.
 */
export const seedSolanaRpcUrl = async (client: SecretsManagerClient, secretId: string) => {
  env.SOLANA_RPC_URL = await readSecretString(client, secretId);
};

/** Aborts on `SIGTERM` (Kubernetes stopping the pod) or `SIGINT` (`Ctrl+C` when run locally). */
export const shutdownSignal = (): AbortSignal => {
  const controller = new AbortController();
  const stop = (signalName: string) => {
    console.log(JSON.stringify({ outcome: "stopping", signal: signalName }));
    controller.abort();
  };

  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);

  return controller.signal;
};
