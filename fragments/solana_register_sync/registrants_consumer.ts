import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DeleteMessageCommand, type Message, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  Address,
  address,
  createKeyPairSignerFromBytes,
  isSolanaError,
  isSome,
  KeyPairSigner,
  Signature,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from "@solana/kit";
import process, { env } from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { getEnvVar } from "../env_vars/env_vars_utils";
import { initRpcClient } from "../solana_rpc/solana_rpc_utils";
import {
  confirmRegistration,
  getRegistrationAccount,
  getRegistryStateAccount,
} from "../solana_program_register/solana_register_interface";
import {
  REGISTRATION_CONFIRMED_DETAIL_TYPE,
  REGISTRATION_DETECTED_DETAIL_TYPE,
  type RegistrationConfirmedDetail,
  type RegistrationDetectedDetail,
} from "./events";
import { registrantKey } from "./registrations_table";

// SQS's own maximum: a message that lands while the poll is open is received straight away.
const RECEIVE_WAIT_TIME_SECONDS = 20;

// One poll cycle every 30 minutes, whatever the queue holds. The poller publishes at most one
// registration an hour, so two cycles an hour keep up, and the consumer makes ~2 requests an hour
// rather than ~180. Tighten it with `POLL_INTERVAL_SECONDS` when testing; `0` means back-to-back long
// polls, which drains a backlog as fast as it can be processed.
export const DEFAULT_POLL_INTERVAL_SECONDS = 30 * 60;

// The queues keep SQS's default 30s visibility timeout, so the whole of `processMessage` has to fit
// inside it or the message reappears mid-flight. This leaves ~10s for the AWS calls either side.
export const CONFIRMATION_TIMEOUT_MS = 20_000;
const CONFIRMATION_POLL_INTERVAL_MS = 1_000;

export interface RegistrantsConsumerConfig {
  programId: string;
  queueUrl: string;
  tableName: string;
  eventBusName: string;
  eventSource: string;
  /** How long to sleep between poll cycles; each cycle handles at most one message. */
  pollIntervalSeconds: number;
}

/** Injected for the same reason as `PollerClients`: tests double them with `aws-sdk-client-mock`. */
export interface RegistrantsConsumerClients {
  sqs: SQSClient;
  documentClient: DynamoDBDocumentClient;
  eventBridge: EventBridgeClient;
}

export interface ProcessResult {
  registrant: Address;
  confirmedAt: bigint;
  /** Null when a previous attempt landed the confirmation, so this one never sent a transaction. */
  signature: Signature | null;
  /** False when the record was already `audited` and was deliberately left there. */
  statusUpdated: boolean;
}

/**
 * SQS carries the whole EventBridge envelope (the rules set no input transformer), so the payload
 * is under `detail`. Anything that is not a `RegistrationDetected` for this consumer's program is
 * rejected: it throws, and after `maxReceiveCount` lands in the DLQ rather than being confirmed
 * against the wrong instance.
 */
const parseMessage = (config: RegistrantsConsumerConfig, message: Message): RegistrationDetectedDetail => {
  const envelope = JSON.parse(message.Body ?? "");

  if (envelope["detail-type"] !== REGISTRATION_DETECTED_DETAIL_TYPE) {
    throw new Error(`Unexpected detail-type ${envelope["detail-type"]} on message ${message.MessageId}`);
  }

  const detail = envelope.detail as RegistrationDetectedDetail;

  if (detail.program_id !== config.programId) {
    throw new Error(`Message ${message.MessageId} is for program ${detail.program_id}, not ${config.programId}`);
  }

  return detail;
};

const isRegistrationAlreadyConfirmed = (e: unknown) =>
  isSolanaError(e, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE) &&
  (e.context.logs ?? []).some((log) => log.includes("RegistrationAlreadyConfirmed"));

/**
 * Polls the signature over plain HTTP JSON-RPC. `confirmRecentSignature` is not usable here: its
 * websocket client is fixed to the local validator and its RPC client is bound at import time, so
 * against Helius it would wait on the wrong node.
 */
const waitForSignature = async (signature: Signature) => {
  const client = initRpcClient();
  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { value: [status] } = await client.getSignatureStatuses([signature]).send();

    if (status?.err) {
      // Includes losing a race to an earlier attempt's confirmation: the retry then fails preflight
      // with `RegistrationAlreadyConfirmed`, which is handled as success.
      throw new Error(`confirm_registration ${signature} failed on-chain: ${JSON.stringify(status.err)}`);
    }

    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return;
    }

    await sleep(CONFIRMATION_POLL_INTERVAL_MS);
  }

  throw new Error(`confirm_registration ${signature} was not confirmed within ${CONFIRMATION_TIMEOUT_MS}ms`);
};

/** Returns the confirming signature, or null when a previous attempt already confirmed. */
const confirmOnChain = async (
  authority: KeyPairSigner,
  programAddress: Address,
  registrant: Address,
): Promise<Signature | null> => {
  let signature: Signature;

  try {
    signature = await confirmRegistration(authority, programAddress, registrant);
  } catch (e) {
    if (isRegistrationAlreadyConfirmed(e)) {
      return null;
    }
    throw e;
  }

  await waitForSignature(signature);

  return signature;
};

/**
 * Returns false when the record is already `audited`. Replaying a message must not demote the
 * auditor's terminal state, and `confirmed_at` is already the on-chain value in that case.
 *
 * Throws when the record is missing. The poller writes it before publishing the event, so absence
 * means something outside the healthy path — a hand-deleted row, a hand-published event — and the
 * message belongs in the DLQ. `attribute_exists(pk)` is what stops `UpdateItem` creating a partial
 * row instead, and `ALL_OLD` is what tells the two condition failures apart.
 */
const markConfirmed = async (
  config: RegistrantsConsumerConfig,
  clients: RegistrantsConsumerClients,
  registrant: Address,
  confirmedAt: bigint,
  signature: Signature | null,
): Promise<boolean> => {
  // The signature is written only when this attempt has one. An attempt that saw
  // `RegistrationAlreadyConfirmed` must not write a null: a NULL attribute counts as present to
  // `if_not_exists`, so a racing consumer's null landing first would block the real signature. Only
  // one `confirm_registration` can ever succeed, so a real signature never overwrites another.
  const setSignature = signature ? ", confirmation_signature = :signature" : "";

  try {
    await clients.documentClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { pk: registrantKey(registrant) },
        UpdateExpression: `SET #status = :confirmed, confirmed_at = :confirmed_at, updated_at = :now${setSignature}`,
        ConditionExpression: "attribute_exists(pk) AND #status <> :audited",
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        // `status` is a DynamoDB reserved word.
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":confirmed": "confirmed",
          ":audited": "audited",
          ":confirmed_at": confirmedAt,
          ":now": new Date().toISOString(),
          // DynamoDB rejects a value the expression does not use, so it travels only with the SET.
          ...(signature ? { ":signature": signature } : {}),
        },
      }),
    );
    return true;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) {
      if (!e.Item) {
        throw new Error(`No ${registrantKey(registrant)} record to confirm; the poller should have written it`);
      }
      return false;
    }
    throw e;
  }
};

const publishRegistrationConfirmed = async (
  config: RegistrantsConsumerConfig,
  clients: RegistrantsConsumerClients,
  registrant: Address,
  registrationIndex: bigint,
  confirmedAt: bigint,
  signature: Signature | null,
) => {
  const result = await clients.eventBridge.send(
    new PutEventsCommand({
      Entries: [{
        EventBusName: config.eventBusName,
        Source: config.eventSource,
        DetailType: REGISTRATION_CONFIRMED_DETAIL_TYPE,
        Detail: JSON.stringify(
          {
            program_id: config.programId,
            registrant,
            registration_index: Number(registrationIndex),
            confirmed_at: Number(confirmedAt),
            signature,
          } satisfies RegistrationConfirmedDetail,
        ),
      }],
    }),
  );

  // PutEvents answers 200 even when an entry was rejected, so the per-entry result is the real one.
  if (result.FailedEntryCount) {
    const [entry] = result.Entries ?? [];
    throw new Error(
      `Failed to publish ${REGISTRATION_CONFIRMED_DETAIL_TYPE}: ${entry?.ErrorCode} ${entry?.ErrorMessage}`,
    );
  }
};

/**
 * Processes one `RegistrationDetected` message end to end and deletes it.
 *
 * Every step is safe to repeat, so any throw simply leaves the message on the queue: the visibility
 * timeout returns it for another attempt, and `maxReceiveCount` eventually routes it to the DLQ.
 */
export const processMessage = async (
  config: RegistrantsConsumerConfig,
  clients: RegistrantsConsumerClients,
  authority: KeyPairSigner,
  message: Message,
): Promise<ProcessResult> => {
  const detail = parseMessage(config, message);
  const programAddress = address(config.programId);
  const registrant = address(detail.registrant);
  const signature = await confirmOnChain(authority, programAddress, registrant);

  // `confirmed_at` is taken from the account, not the local clock or the event: it is the slot the
  // program stamped, and on the already-confirmed path it is the only source there is.
  const registration = await getRegistrationAccount(registrant, programAddress);

  if (!isSome(registration.confirmed_at)) {
    throw new Error(`Registration for ${registrant} has no confirmed_at after confirm_registration`);
  }

  const confirmedAt = registration.confirmed_at.value;
  const statusUpdated = await markConfirmed(config, clients, registrant, confirmedAt, signature);

  await publishRegistrationConfirmed(
    config,
    clients,
    registrant,
    registration.registration_index,
    confirmedAt,
    signature,
  );

  await clients.sqs.send(
    new DeleteMessageCommand({ QueueUrl: config.queueUrl, ReceiptHandle: message.ReceiptHandle }),
  );

  return { registrant, confirmedAt, signature, statusUpdated };
};

/**
 * One poll cycle: receive at most one message and process it. Never throws — every failure is logged,
 * and an unprocessed message stays on the queue for SQS to redeliver after its visibility timeout.
 */
const receiveAndProcess = async (
  config: RegistrantsConsumerConfig,
  clients: RegistrantsConsumerClients,
  authority: KeyPairSigner,
  signal: AbortSignal,
) => {
  let message: Message | undefined;

  try {
    const result = await clients.sqs.send(
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
    const result = await processMessage(config, clients, authority, message);
    console.log(JSON.stringify({
      outcome: "confirmed",
      message_id: message.MessageId,
      registrant: result.registrant,
      confirmed_at: result.confirmedAt.toString(),
      signature: result.signature,
      status_updated: result.statusUpdated,
    }));
  } catch (e) {
    console.error(JSON.stringify({ outcome: "failed", message_id: message.MessageId, error: String(e) }));
  }
};

/**
 * Runs a poll cycle every `config.pollIntervalSeconds` until `signal` aborts.
 *
 * An abort cancels the long poll and the sleep, never a message already received: that is processed
 * to completion first, so a `SIGTERM` (e.g. `kubectl scale --replicas=0`) never abandons one half way
 * through its on-chain write — nor waits out a 30-minute interval.
 */
export const consume = async (
  config: RegistrantsConsumerConfig,
  clients: RegistrantsConsumerClients,
  authority: KeyPairSigner,
  signal: AbortSignal,
) => {
  while (!signal.aborted) {
    await receiveAndProcess(config, clients, authority, signal);
    await sleep(config.pollIntervalSeconds * 1000, undefined, { signal }).catch(() => {});
  }
};

const requireEnvVar = (name: string) => {
  const value = getEnvVar(name);

  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }

  return value;
};

/** Optional: unset or empty means the default, anything but a non-negative integer fails startup. */
const readPollIntervalSeconds = () => {
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

/**
 * Every value the process takes from its environment; these become the Kustomize
 * `configMapGenerator` keys. The region is not among them: the SDK reads `AWS_REGION` itself.
 */
export interface RegistrantsConsumerProcessConfig extends RegistrantsConsumerConfig {
  deployerKeypairSecretId: string;
  heliusRpcUrlSecretId: string;
}

export const readConfig = (): RegistrantsConsumerProcessConfig => ({
  programId: requireEnvVar("SOLANA_REGISTER_PROGRAM_ID"),
  queueUrl: requireEnvVar("REGISTRANTS_QUEUE_URL"),
  tableName: requireEnvVar("REGISTRATIONS_TABLE_NAME"),
  eventBusName: requireEnvVar("EVENT_BUS_NAME"),
  eventSource: requireEnvVar("EVENT_SOURCE"),
  pollIntervalSeconds: readPollIntervalSeconds(),
  deployerKeypairSecretId: requireEnvVar("DEPLOYER_KEYPAIR_SECRET_ID"),
  heliusRpcUrlSecretId: requireEnvVar("HELIUS_RPC_URL_SECRET_ID"),
});

export const createAwsClients = (): RegistrantsConsumerClients => ({
  sqs: new SQSClient({}),
  documentClient: DynamoDBDocumentClient.from(new DynamoDBClient({})),
  eventBridge: new EventBridgeClient({}),
});

const readSecretString = async (client: SecretsManagerClient, secretId: string) => {
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));

  if (!result.SecretString) {
    throw new Error(`Secret ${secretId} has no string value`);
  }

  return result.SecretString.trim();
};

export const main = async () => {
  const config = readConfig();
  const secretsManager = new SecretsManagerClient({});

  // As in the poller: `initRpcClient` reads `SOLANA_RPC_URL` at call time, so seeding it once here
  // points every chain call at Helius without the API key ever being a plaintext env var.
  env.SOLANA_RPC_URL = await readSecretString(secretsManager, config.heliusRpcUrlSecretId);

  // The secret holds the keypair file's contents: a JSON array of the 64 secret key bytes.
  const keypairBytes = JSON.parse(await readSecretString(secretsManager, config.deployerKeypairSecretId));
  const authority = await createKeyPairSignerFromBytes(new Uint8Array(keypairBytes));

  // Fail fast on a mismatched secret, rather than failing every message into the DLQ.
  const registryState = await getRegistryStateAccount(address(config.programId));

  if (registryState.authority !== authority.address) {
    throw new Error(`Keypair ${authority.address} is not the registry authority ${registryState.authority}`);
  }

  const controller = new AbortController();
  const stop = (signalName: string) => {
    console.log(JSON.stringify({ outcome: "stopping", signal: signalName }));
    controller.abort();
  };

  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);

  console.log(JSON.stringify({
    outcome: "started",
    program_id: config.programId,
    authority: authority.address,
    poll_interval_seconds: config.pollIntervalSeconds,
  }));

  await consume(config, createAwsClients(), authority, controller.signal);

  console.log(JSON.stringify({ outcome: "stopped" }));
};

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
