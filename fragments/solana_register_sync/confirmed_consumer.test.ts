import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, before, beforeEach, describe } from "node:test";
import process from "node:process";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  type GetCommandInput,
  UpdateCommand,
  type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { DeleteMessageCommand, type Message, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  Address,
  address,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  isSome,
  KeyPairSigner,
} from "@solana/kit";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getEnvVar } from "../env_vars/env_vars_utils";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import { confirmRecentSignature } from "../solana_transaction/solana_transaction_utils";
import {
  confirmRegistration,
  getRegistrationAccount,
  initialiseRegistry,
  register,
  type RegistrationAccount,
} from "../solana_program_register/solana_register_interface";
import { REGISTRATION_CONFIRMED_DETAIL_TYPE, REGISTRATION_DETECTED_DETAIL_TYPE } from "./events";
import {
  type ConfirmedConsumerClients,
  type ConfirmedConsumerConfig,
  consume,
  createAwsClients,
  processMessage,
} from "./confirmed_consumer";
import { DEFAULT_POLL_INTERVAL_SECONDS } from "./shared";

// The one write the auditor makes, and the condition that ties it to the values it cross-checked.
// Pinned here so that changing either in `confirmed_consumer.ts` fails a test rather than silently
// weakening the audit; the fake table below implements exactly these semantics.
const AUDIT_UPDATE = "SET #status = :audited, audited_at = if_not_exists(audited_at, :now), updated_at = :now";
const AUDIT_CONDITION =
  "registrant = :registrant AND registration_index = :registration_index AND confirmed_at = :confirmed_at";

type Item = Record<string, unknown>;

/** DynamoDB hands numbers back as `number`, so the fake table stores bigints the same way. */
const asStored = (value: unknown) => typeof value === "bigint" ? Number(value) : value;

const loadKeypairFromFile = async (path: string): Promise<KeyPairSigner> => {
  const keyData = JSON.parse(readFileSync(path, "utf-8"));
  return await createKeyPairSignerFromBytes(new Uint8Array(keyData));
};

// See `poller.test.ts`: the shared validator runs slowed slots, so chain writes made here get more
// room than `confirmRecentSignature`'s 5s default.
const CONFIRMATION_TIMEOUT_MS = 20_000;

const confirmOrFail = async (signature: Parameters<typeof confirmRecentSignature>[0], what: string) => {
  const confirmed = await confirmRecentSignature(signature, CONFIRMATION_TIMEOUT_MS);
  assert.ok(confirmed, `${what} ${signature} was not confirmed within ${CONFIRMATION_TIMEOUT_MS}ms`);
};

/** Registers a fresh, funded account and returns its on-chain `Registration`. */
const registerOne = async (programAddress: Address) => {
  const registrant = await generateKeyPairSigner();
  await sendAndConfirmAirdrop(registrant.address, BigInt(LAMPORTS_PER_SOL));
  await confirmOrFail(await register(registrant, programAddress), "registration");

  return await getRegistrationAccount(registrant.address, programAddress);
};

describe("solana register sync confirmed consumer", () => {
  let config: ConfirmedConsumerConfig;
  let programAddress: Address;
  let unconfirmed: RegistrationAccount;
  let confirmed: RegistrationAccount;
  let confirmedAt: bigint;
  let table: Map<string, Item>;
  let clients: ConfirmedConsumerClients;
  let sqsMock: ReturnType<typeof mockClient>;
  let dynamoMock: ReturnType<typeof mockClient>;

  before(async () => {
    const programId = getEnvVar("register_PROGRAM_ID");

    if (!programId) {
      assert.fail("environment variable register_PROGRAM_ID is not set");
    }

    programAddress = address(programId);

    config = {
      programId,
      queueUrl: "https://sqs.eu-west-2.amazonaws.com/000000000000/ff_test_solana_register_registrants_confirmed",
      tableName: "ff_test_solana_register_registrations",
      // The real default, so a test that wrongly slept would hang rather than pass by accident.
      pollIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
    };

    // The auditor itself signs nothing, but a confirmed registration to audit needs the registry
    // authority — the deployer, which is also the only key allowed to initialise the registry.
    const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? "./solana_program_keys/solana_deployer.json";
    const authority = await loadKeypairFromFile(keypairPath);
    await sendAndConfirmAirdrop(authority.address, BigInt(LAMPORTS_PER_SOL));

    // Singleton PDA shared with other test files running in parallel; losing that race is expected.
    try {
      await confirmOrFail(await initialiseRegistry(authority, programAddress), "initialise_registry");
    } catch (e) {
      const logs = (e as { context?: { logs?: string[] } })?.context?.logs?.join(" ") ?? "";
      if (!logs.includes("already in use")) {
        throw e;
      }
    }

    // Every chain write this file makes: one registration confirmed up front for every test that
    // audits, and one left unconfirmed for the test that finds the PDA's `confirmed_at` unset. The
    // auditor only reads the chain, so no test writes to it.
    unconfirmed = await registerOne(programAddress);
    confirmed = await registerOne(programAddress);
    await confirmOrFail(
      await confirmRegistration(authority, programAddress, confirmed.registrant),
      "confirm_registration",
    );
    confirmed = await getRegistrationAccount(confirmed.registrant, programAddress);
    assert.ok(isSome(confirmed.confirmed_at), `${confirmed.registrant} is not confirmed on-chain`);
    confirmedAt = confirmed.confirmed_at.value;
  });

  beforeEach(() => {
    table = new Map();
    sqsMock = mockClient(SQSClient);
    dynamoMock = mockClient(DynamoDBDocumentClient);

    dynamoMock.on(GetCommand).callsFake((input: GetCommandInput) => {
      // A stale `registered` row would be a false mismatch, so the read must be consistent.
      assert.strictEqual(input.ConsistentRead, true);
      const item = table.get(String(input.Key?.pk));
      return { Item: item ? { ...item } : undefined };
    });

    dynamoMock.on(UpdateCommand).callsFake((input: UpdateCommandInput) => {
      const key = String(input.Key?.pk);
      const values = input.ExpressionAttributeValues ?? {};
      const existing = table.get(key);

      assert.strictEqual(input.UpdateExpression, AUDIT_UPDATE);
      assert.strictEqual(input.ConditionExpression, AUDIT_CONDITION);
      assert.deepStrictEqual(input.ExpressionAttributeNames, { "#status": "status" });

      // `registrant = :registrant AND registration_index = :registration_index AND confirmed_at = :confirmed_at`,
      // each of which is false on a missing item.
      if (
        existing === undefined ||
        existing.registrant !== values[":registrant"] ||
        existing.registration_index !== asStored(values[":registration_index"]) ||
        existing.confirmed_at !== asStored(values[":confirmed_at"])
      ) {
        throw new ConditionalCheckFailedException({ $metadata: {}, message: "The conditional request failed" });
      }

      table.set(key, {
        ...existing,
        status: values[":audited"],
        // `if_not_exists(audited_at, :now)`
        audited_at: existing.audited_at ?? values[":now"],
        updated_at: values[":now"],
      });

      return {};
    });

    sqsMock.on(DeleteMessageCommand).resolves({});

    clients = createAwsClients();
  });

  afterEach(() => {
    sqsMock.restore();
    dynamoMock.restore();
  });

  /**
   * What SQS delivers: the whole EventBridge envelope, since the rule sets no input transformer. The
   * payload defaults to the truth, but a test can make it lie — the auditor must not notice.
   */
  const messageFor = (
    registration: Pick<RegistrationAccount, "registrant" | "registration_index">,
    overrides: { programId?: string; detailType?: string; registrationIndex?: number; confirmedAt?: number } = {},
  ): Message => ({
    MessageId: `message-${registration.registrant}`,
    ReceiptHandle: `receipt-${registration.registrant}`,
    Body: JSON.stringify({
      version: "0",
      id: "00000000-0000-0000-0000-000000000000",
      "detail-type": overrides.detailType ?? REGISTRATION_CONFIRMED_DETAIL_TYPE,
      source: "ff.solana.register",
      account: "000000000000",
      time: new Date().toISOString(),
      region: "eu-west-2",
      resources: [],
      detail: {
        program_id: overrides.programId ?? config.programId,
        registrant: registration.registrant,
        registration_index: overrides.registrationIndex ?? Number(registration.registration_index),
        confirmed_at: overrides.confirmedAt ?? Number(confirmedAt),
        signature: null,
      },
    }),
  });

  /** The row as the registrants consumer leaves it: the poller's record, moved on to `confirmed`. */
  const seedConfirmedRecord = (
    registration: Pick<RegistrationAccount, "registrant" | "registration_index" | "registered_at">,
    overrides: Item = {},
  ) => {
    const key = `REGISTRANT#${registration.registrant}`;
    table.set(key, {
      pk: key,
      registrant: registration.registrant,
      registration_index: Number(registration.registration_index),
      registered_at: Number(registration.registered_at),
      confirmed_at: Number(confirmedAt),
      status: "confirmed",
      detected_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:01:00.000Z",
      ...overrides,
    });
    return key;
  };

  const deletedReceiptHandles = () =>
    sqsMock.commandCalls(DeleteMessageCommand).map((call) => {
      const input = call.args[0].input as { QueueUrl?: string; ReceiptHandle?: string };
      assert.strictEqual(input.QueueUrl, config.queueUrl);
      return input.ReceiptHandle;
    });

  /** Asserts the record was left exactly as seeded: not audited, nothing written. */
  const assertNotAudited = (key: string, seeded: Item | undefined) => {
    assert.deepStrictEqual(table.get(key), seeded);
    assert.deepStrictEqual(deletedReceiptHandles(), []);
  };

  test("marks a record that agrees with the chain audited and deletes the message", async () => {
    const key = seedConfirmedRecord(confirmed);
    const message = messageFor(confirmed);

    const result = await processMessage(config, clients, message);

    assert.deepStrictEqual(result, {
      registrant: confirmed.registrant,
      registrationIndex: confirmed.registration_index,
      confirmedAt,
    });

    const record = table.get(key);
    assert.strictEqual(record?.status, "audited");
    assert.ok(typeof record?.audited_at === "string", "an audited record carries its audited timestamp");
    assert.strictEqual(record?.updated_at, record?.audited_at);
    // Nothing the audit did not own was touched.
    assert.strictEqual(record?.confirmed_at, Number(confirmedAt));
    assert.strictEqual(record?.detected_at, "2026-01-01T00:00:00.000Z");
    assert.deepStrictEqual(deletedReceiptHandles(), [message.ReceiptHandle]);
  });

  test("ignores the event's own copy of the fields and audits from the record and the chain", async () => {
    const key = seedConfirmedRecord(confirmed);
    // Both lie; neither is consulted.
    const message = messageFor(confirmed, { registrationIndex: 999_999, confirmedAt: 1 });

    await processMessage(config, clients, message);

    assert.strictEqual(table.get(key)?.status, "audited");
    assert.deepStrictEqual(deletedReceiptHandles(), [message.ReceiptHandle]);
  });

  test("a registration_index mismatch throws, naming the field, without auditing", async () => {
    const key = seedConfirmedRecord(confirmed, { registration_index: Number(confirmed.registration_index) + 1 });
    const seeded = { ...table.get(key) };

    await assert.rejects(
      processMessage(config, clients, messageFor(confirmed)),
      new RegExp(
        `registration_index record=${Number(confirmed.registration_index) + 1} chain=${confirmed.registration_index}`,
      ),
    );

    assert.strictEqual(dynamoMock.commandCalls(UpdateCommand).length, 0);
    assertNotAudited(key, seeded);
  });

  test("a confirmed_at mismatch throws, naming the field, without auditing", async () => {
    // The record still holds the poller's null, as if the registrants consumer's write never landed.
    const key = seedConfirmedRecord(confirmed, { confirmed_at: null, status: "registered" });
    const seeded = { ...table.get(key) };

    await assert.rejects(
      processMessage(config, clients, messageFor(confirmed)),
      new RegExp(`confirmed_at record=null chain=${confirmedAt}`),
    );

    assertNotAudited(key, seeded);
  });

  test("a PDA with confirmed_at unset throws without auditing", async () => {
    // The record claims a confirmation the chain never saw.
    const key = seedConfirmedRecord(unconfirmed);
    const seeded = { ...table.get(key) };

    await assert.rejects(
      processMessage(config, clients, messageFor(unconfirmed)),
      /is not confirmed on-chain; not audited/,
    );

    assertNotAudited(key, seeded);
  });

  test("a missing DynamoDB record throws without creating one", async () => {
    await assert.rejects(processMessage(config, clients, messageFor(confirmed)), /No REGISTRANT#.* record to audit/);

    assert.strictEqual(table.size, 0);
    assert.strictEqual(dynamoMock.commandCalls(UpdateCommand).length, 0);
    assert.deepStrictEqual(deletedReceiptHandles(), []);
  });

  test("a record that changes between the cross-check and the write is not audited", async () => {
    const key = seedConfirmedRecord(confirmed);
    const changed = { ...table.get(key), "registration_index": Number(confirmed.registration_index) + 1 };

    // The read returns the matching row; a concurrent writer moves it on before the update lands.
    dynamoMock.on(GetCommand).callsFake(() => {
      const item = { ...table.get(key) };
      table.set(key, changed);
      return { Item: item };
    });

    await assert.rejects(processMessage(config, clients, messageFor(confirmed)), /changed after it was cross-checked/);

    assertNotAudited(key, changed);
  });

  test("re-auditing an audited record keeps its first audited_at", async () => {
    const key = seedConfirmedRecord(confirmed, { status: "audited", audited_at: "2026-01-01T00:02:00.000Z" });
    const message = messageFor(confirmed);

    await processMessage(config, clients, message);

    assert.strictEqual(table.get(key)?.status, "audited");
    assert.strictEqual(table.get(key)?.audited_at, "2026-01-01T00:02:00.000Z");
    assert.deepStrictEqual(deletedReceiptHandles(), [message.ReceiptHandle]);
  });

  test("rejects a message for another program, or of another detail-type, without reading the table", async () => {
    seedConfirmedRecord(confirmed);

    await assert.rejects(
      processMessage(config, clients, messageFor(confirmed, { programId: "11111111111111111111111111111111" })),
      /is for program/,
    );
    await assert.rejects(
      processMessage(config, clients, messageFor(confirmed, { detailType: REGISTRATION_DETECTED_DETAIL_TYPE })),
      /Unexpected detail-type/,
    );

    assert.strictEqual(dynamoMock.commandCalls(GetCommand).length, 0);
    assert.deepStrictEqual(deletedReceiptHandles(), []);
  });

  // The loop's own contract — cadence, one message per cycle, shutdown — is pinned in `shared.test.ts`;
  // this only checks that `consume` wires `processMessage` into it.
  test("consume audits a received message end to end", async () => {
    const key = seedConfirmedRecord(confirmed);
    const message = messageFor(confirmed);
    const controller = new AbortController();
    sqsMock.on(ReceiveMessageCommand).callsFake(() => {
      controller.abort();
      return { Messages: [message] };
    });

    await consume(config, clients, controller.signal);

    assert.strictEqual(table.get(key)?.status, "audited");
    assert.deepStrictEqual(deletedReceiptHandles(), [message.ReceiptHandle]);
  });
});
