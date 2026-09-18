import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Address, address } from "@solana/kit";
import { env } from "node:process";
import { getEnvVar } from "../env_vars/env_vars_utils";
import {
  getRegistrationAccountByIndex,
  getRegistryStateAccount,
  type RegistrationAccount,
} from "../solana_program_register/solana_register_interface";

export const REGISTRATION_DETECTED_DETAIL_TYPE = "RegistrationDetected";

export interface PollerConfig {
  programId: string;
  tableName: string;
  eventBusName: string;
  eventSource: string;
}

/**
 * The AWS clients the poller writes through. Injected rather than reached for as module state, so a
 * test can hand over `aws-sdk-client-mock` doubles and assert on the commands the poller actually
 * sends.
 */
export interface PollerClients {
  documentClient: DynamoDBDocumentClient;
  eventBridge: EventBridgeClient;
}

/** The subset of a decoded `Registration` account the ingestion path carries. */
export type DetectedRegistration = Pick<
  RegistrationAccount,
  "registrant" | "registration_index" | "registered_at"
>;

export type PollOutcome =
  | "no_new_registrations"
  | "registration_not_found"
  | "ingested"
  | "ingested_watermark_conflict";

export interface PollResult {
  outcome: PollOutcome;
  watermark: bigint;
  registrationCount: bigint;
  registrant?: Address;
  /** False when the registrant already had a record, i.e. the dedup fired. */
  recordCreated?: boolean;
}

const watermarkKey = (programId: string) => `WATERMARK#${programId}`;
const registrantKey = (registrant: Address) => `REGISTRANT#${registrant}`;

const readWatermark = async (config: PollerConfig, clients: PollerClients): Promise<bigint> => {
  const result = await clients.documentClient.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { pk: watermarkKey(config.programId) },
      // Two overlapping invocations must not both read a stale watermark and ingest the same index.
      ConsistentRead: true,
    }),
  );

  const count = result.Item?.registration_count;

  return count === undefined ? 0n : BigInt(count as number);
};

/** Returns false when the registrant already has a record — this is the dedup. */
const recordRegistrant = async (
  config: PollerConfig,
  clients: PollerClients,
  registration: DetectedRegistration,
): Promise<boolean> => {
  try {
    await clients.documentClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          pk: registrantKey(registration.registrant),
          registrant: registration.registrant,
          registration_index: registration.registration_index,
          registered_at: registration.registered_at,
          confirmed_at: null,
          status: "registered",
          detected_at: new Date().toISOString(),
        },
        // The dedup: a registrant we have already recorded must never get a second row.
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
    return true;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) {
      return false;
    }
    throw e;
  }
};

const publishRegistrationDetected = async (
  config: PollerConfig,
  clients: PollerClients,
  registration: DetectedRegistration,
): Promise<void> => {
  const result = await clients.eventBridge.send(
    new PutEventsCommand({
      Entries: [{
        EventBusName: config.eventBusName,
        Source: config.eventSource,
        DetailType: REGISTRATION_DETECTED_DETAIL_TYPE,
        Detail: JSON.stringify({
          program_id: config.programId,
          registrant: registration.registrant,
          registration_index: Number(registration.registration_index),
          registered_at: Number(registration.registered_at),
        }),
      }],
    }),
  );

  // PutEvents answers 200 even when an entry was rejected, so the per-entry result is the real one.
  if (result.FailedEntryCount) {
    const [entry] = result.Entries ?? [];
    throw new Error(
      `Failed to publish ${REGISTRATION_DETECTED_DETAIL_TYPE}: ${entry?.ErrorCode} ${entry?.ErrorMessage}`,
    );
  }
};

/** Returns false when another invocation advanced the watermark first. */
const advanceWatermark = async (
  config: PollerConfig,
  clients: PollerClients,
  expected: bigint,
): Promise<boolean> => {
  try {
    await clients.documentClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { pk: watermarkKey(config.programId) },
        UpdateExpression: "SET registration_count = :next, updated_at = :now",
        // Advance by exactly one, and only from the value this invocation read, so two overlapping
        // invocations cannot both move the watermark on.
        ConditionExpression: "attribute_not_exists(pk) OR registration_count = :expected",
        ExpressionAttributeValues: {
          ":next": expected + 1n,
          ":expected": expected,
          ":now": new Date().toISOString(),
        },
      }),
    );
    return true;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) {
      return false;
    }
    throw e;
  }
};

/**
 * Ingests at most one registration.
 *
 * Registration indices are contiguous over `[0, registration_count)` and the count is monotonic, so
 * the watermark doubles as the index of the next registration to process. Any backlog therefore
 * drains one-per-invocation over subsequent invocations — there is no batching and no backfill.
 */
export const pollOnce = async (config: PollerConfig, clients: PollerClients): Promise<PollResult> => {
  const programAddress = address(config.programId);
  const watermark = await readWatermark(config, clients);
  const registryState = await getRegistryStateAccount(programAddress);
  const registrationCount = registryState.registration_count;

  if (registrationCount <= watermark) {
    return { outcome: "no_new_registrations", watermark, registrationCount };
  }

  const registration = await getRegistrationAccountByIndex(watermark, programAddress);

  if (!registration) {
    // `register` bumps the count and creates the account in one instruction, so this can only mean the
    // two reads above landed on nodes at different slots and the scan was served by the older one.
    // Leave the watermark alone: the next invocation retries the same index rather than skipping it.
    return { outcome: "registration_not_found", watermark, registrationCount };
  }

  const recordCreated = await recordRegistrant(config, clients, registration);

  // Published whether or not the record was created. The consumers are idempotent, so a duplicate
  // *message* is harmless — whereas skipping the publish for an already-recorded registrant would
  // strand that record at `registered` with nothing left to move it on.
  await publishRegistrationDetected(config, clients, registration);

  const advanced = await advanceWatermark(config, clients, watermark);

  return {
    outcome: advanced ? "ingested" : "ingested_watermark_conflict",
    watermark,
    registrationCount,
    registrant: registration.registrant,
    recordCreated,
  };
};

const requireEnvVar = (name: string) => {
  const value = getEnvVar(name);

  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }

  return value;
};

/**
 * Every value the Lambda takes from its environment. It extends `PollerConfig` so `pollOnce` accepts it as-is, while `PollerConfig` stays
 * exactly what the poll algorithm consumes and a test can construct that narrower shape without
 * inventing a secret id it never reads.
 */
export interface HandlerConfig extends PollerConfig {
  /**
   * Identifies the secret; it is not itself sensitive, which is why it travels as a plaintext env var
   * while the URL it points at does not.
   */
  heliusRpcUrlSecretId: string;
}

export const readConfig = (): HandlerConfig => ({
  programId: requireEnvVar("SOLANA_REGISTER_PROGRAM_ID"),
  tableName: requireEnvVar("REGISTRATIONS_TABLE_NAME"),
  eventBusName: requireEnvVar("EVENT_BUS_NAME"),
  eventSource: requireEnvVar("EVENT_SOURCE"),
  heliusRpcUrlSecretId: requireEnvVar("HELIUS_RPC_URL_SECRET_ID"),
});

// Created once per container rather than per invocation, so a warm Lambda reuses the connection pool.
const secretsManagerClient = new SecretsManagerClient({});

export const createAwsClients = (): PollerClients => ({
  documentClient: DynamoDBDocumentClient.from(new DynamoDBClient({})),
  eventBridge: new EventBridgeClient({}),
});

const awsClients = createAwsClients();

let rpcUrlResolved = false;

/**
 * The Helius URL embeds an API key, so it is held in Secrets Manager rather than a plaintext env var.
 * `initRpcClient` — shared with every other fragment — reads `SOLANA_RPC_URL` at call time, so seeding
 * that variable once per cold start is what points the register interface at Helius too. With the
 * variable unset (the local validator case) `initRpcClient` falls back to `127.0.0.1:8899`, so the
 * same code path serves both environments.
 */
const resolveRpcUrl = async (secretId: string) => {
  if (rpcUrlResolved) {
    return;
  }

  const result = await secretsManagerClient.send(new GetSecretValueCommand({ SecretId: secretId }));

  if (!result.SecretString) {
    throw new Error(`Secret ${secretId} has no string value`);
  }

  env.SOLANA_RPC_URL = result.SecretString.trim();
  rpcUrlResolved = true;
};

// Bigints are not JSON-serialisable, so the counters are stringified here rather than returned raw.
// This object is both the CloudWatch log line and the Lambda's response payload.
const buildSummary = (config: PollerConfig, result: PollResult) => ({
  outcome: result.outcome,
  program_id: config.programId,
  watermark: result.watermark.toString(),
  registration_count: result.registrationCount.toString(),
  registrant: result.registrant,
  record_created: result.recordCreated,
});

export const handler = async () => {
  const config = readConfig();
  await resolveRpcUrl(config.heliusRpcUrlSecretId);

  const summary = buildSummary(config, await pollOnce(config, awsClients));

  console.log(JSON.stringify(summary));

  return summary;
};
