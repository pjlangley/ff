import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DeleteMessageCommand, type Message, SQSClient } from "@aws-sdk/client-sqs";
import { Address, address, isSome } from "@solana/kit";
import process from "node:process";
import { getRegistrationAccount, getRegistryStateAccount } from "../solana_program_register/solana_register_interface";
import { REGISTRATION_CONFIRMED_DETAIL_TYPE, type RegistrationConfirmedDetail } from "./events";
import { registrantKey } from "./registrations_table";
import {
  type ConsumeConfig,
  consumeQueue,
  parseDetail,
  readPollIntervalSeconds,
  requireEnvVar,
  seedSolanaRpcUrl,
  shutdownSignal,
} from "./shared";

export interface ConfirmedConsumerConfig extends ConsumeConfig {
  programId: string;
  tableName: string;
}

/** Injected for the same reason as `PollerClients`: tests double them with `aws-sdk-client-mock`. */
export interface ConfirmedConsumerClients {
  sqs: SQSClient;
  documentClient: DynamoDBDocumentClient;
}

/**
 * What the chain says, once `confirmed_at` is known to be set: the values the record is cross-checked
 * against, the audit is conditional on, and `processMessage` reports.
 */
export interface AuditResult {
  registrant: Address;
  registrationIndex: bigint;
  confirmedAt: bigint;
}

interface Mismatch {
  field: "registrant" | "registration_index" | "confirmed_at";
  record: unknown;
  chain: string;
}

/**
 * Consistent, because the registrants consumer wrote `confirmed` only seconds before this event
 * arrived, and an eventually consistent read could still return the `registered` row — a false
 * mismatch that would fail a healthy message.
 */
const readRecord = async (
  config: ConfirmedConsumerConfig,
  clients: ConfirmedConsumerClients,
  registrant: Address,
) => {
  const result = await clients.documentClient.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { pk: registrantKey(registrant) },
      ConsistentRead: true,
    }),
  );

  if (!result.Item) {
    throw new Error(`No ${registrantKey(registrant)} record to audit`);
  }

  return result.Item;
};

/** DynamoDB hands numbers back as `number`; anything else (a null `confirmed_at`, a missing attribute) mismatches. */
const asBigInt = (value: unknown) => typeof value === "number" ? BigInt(value) : undefined;

const findMismatches = (record: Record<string, unknown>, chain: AuditResult): Mismatch[] => {
  const mismatches: Mismatch[] = [];

  if (record.registrant !== chain.registrant) {
    mismatches.push({ field: "registrant", record: record.registrant, chain: chain.registrant });
  }

  if (asBigInt(record.registration_index) !== chain.registrationIndex) {
    mismatches.push({
      field: "registration_index",
      record: record.registration_index,
      chain: chain.registrationIndex.toString(),
    });
  }

  if (asBigInt(record.confirmed_at) !== chain.confirmedAt) {
    mismatches.push({ field: "confirmed_at", record: record.confirmed_at, chain: chain.confirmedAt.toString() });
  }

  return mismatches;
};

/**
 * Conditional on the very values just cross-checked, so the record marked `audited` is exactly the
 * one that matched: a write that moved any of them between the read and here fails the audit
 * instead. The comparisons also fail on a missing item, so no partial row can be created.
 * `audited_at` keeps the first audit's time when a replay re-audits an already audited record.
 */
const markAudited = async (
  config: ConfirmedConsumerConfig,
  clients: ConfirmedConsumerClients,
  chain: AuditResult,
) => {
  const now = new Date().toISOString();

  try {
    await clients.documentClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { pk: registrantKey(chain.registrant) },
        UpdateExpression: "SET #status = :audited, audited_at = if_not_exists(audited_at, :now), updated_at = :now",
        ConditionExpression:
          "registrant = :registrant AND registration_index = :registration_index AND confirmed_at = :confirmed_at",
        // `status` is a DynamoDB reserved word.
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":audited": "audited",
          ":now": now,
          ":registrant": chain.registrant,
          ":registration_index": chain.registrationIndex,
          ":confirmed_at": chain.confirmedAt,
        },
      }),
    );
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) {
      throw new Error(`${registrantKey(chain.registrant)} changed after it was cross-checked; not audited`);
    }
    throw e;
  }
};

/**
 * Audits one `RegistrationConfirmed` message and deletes it.
 *
 * Only the registrant is taken from the event; the rest of its payload is deliberately ignored, since
 * an audit that trusted the event would only check the registrants consumer against itself. The
 * DynamoDB record and the on-chain `Registration` PDA are each loaded afresh and must agree. Any
 * disagreement throws without auditing, so the message retries and lands in the DLQ for inspection.
 * Nothing here writes to the chain, and the one table write is idempotent, so every step is safe to
 * repeat.
 */
export const processMessage = async (
  config: ConfirmedConsumerConfig,
  clients: ConfirmedConsumerClients,
  message: Message,
): Promise<AuditResult> => {
  const detail = parseDetail<RegistrationConfirmedDetail>(
    message,
    REGISTRATION_CONFIRMED_DETAIL_TYPE,
    config.programId,
  );
  const registrant = address(detail.registrant);
  const record = await readRecord(config, clients, registrant);
  const registration = await getRegistrationAccount(registrant, address(config.programId));

  if (!isSome(registration.confirmed_at)) {
    throw new Error(`Registration for ${registrant} is not confirmed on-chain; not audited`);
  }

  const chain: AuditResult = {
    registrant: registration.registrant,
    registrationIndex: registration.registration_index,
    confirmedAt: registration.confirmed_at.value,
  };
  const mismatches = findMismatches(record, chain);

  if (mismatches.length > 0) {
    const diverged = mismatches.map(({ field, record, chain }) => `${field} record=${record} chain=${chain}`);
    throw new Error(`${registrantKey(registrant)} disagrees with the chain; not audited: ${diverged.join(", ")}`);
  }

  await markAudited(config, clients, chain);

  await clients.sqs.send(
    new DeleteMessageCommand({ QueueUrl: config.queueUrl, ReceiptHandle: message.ReceiptHandle }),
  );

  return chain;
};

/** The shared receive loop, handling each message with `processMessage`. */
export const consume = (config: ConfirmedConsumerConfig, clients: ConfirmedConsumerClients, signal: AbortSignal) =>
  consumeQueue(config, clients.sqs, signal, async (message) => {
    const result = await processMessage(config, clients, message);
    return {
      outcome: "audited",
      registrant: result.registrant,
      registration_index: result.registrationIndex.toString(),
      confirmed_at: result.confirmedAt.toString(),
    };
  });

/**
 * Every value the process takes from its environment; these become the Kustomize
 * `configMapGenerator` keys. The region is not among them: the SDK reads `AWS_REGION` itself. Unlike
 * the registrants consumer there is no deployer keypair: the auditor only reads the chain.
 */
export interface ConfirmedConsumerProcessConfig extends ConfirmedConsumerConfig {
  heliusRpcUrlSecretId: string;
}

export const readConfig = (): ConfirmedConsumerProcessConfig => ({
  programId: requireEnvVar("SOLANA_REGISTER_PROGRAM_ID"),
  queueUrl: requireEnvVar("CONFIRMED_QUEUE_URL"),
  tableName: requireEnvVar("REGISTRATIONS_TABLE_NAME"),
  pollIntervalSeconds: readPollIntervalSeconds(),
  heliusRpcUrlSecretId: requireEnvVar("HELIUS_RPC_URL_SECRET_ID"),
});

export const createAwsClients = (): ConfirmedConsumerClients => ({
  sqs: new SQSClient({}),
  documentClient: DynamoDBDocumentClient.from(new DynamoDBClient({})),
});

export const main = async () => {
  const config = readConfig();

  await seedSolanaRpcUrl(new SecretsManagerClient({}), config.heliusRpcUrlSecretId);

  // Fail fast on a wrong RPC URL or program id, rather than failing every message into the DLQ.
  await getRegistryStateAccount(address(config.programId));

  const signal = shutdownSignal();

  console.log(JSON.stringify({
    outcome: "started",
    program_id: config.programId,
    poll_interval_seconds: config.pollIntervalSeconds,
  }));

  await consume(config, createAwsClients(), signal);

  console.log(JSON.stringify({ outcome: "stopped" }));
};

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
