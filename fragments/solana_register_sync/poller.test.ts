import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, before, beforeEach, describe } from "node:test";
import process from "node:process";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  DynamoDBDocumentClient,
  GetCommand,
  type GetCommandInput,
  PutCommand,
  type PutCommandInput,
  UpdateCommand,
  type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import {
  Address,
  address,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  getBase58Encoder,
  KeyPairSigner,
} from "@solana/kit";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getEnvVar } from "../env_vars/env_vars_utils";
import { sendAndConfirmAirdrop } from "../solana_airdrop/solana_airdrop_utils";
import { confirmRecentSignature } from "../solana_transaction/solana_transaction_utils";
import {
  getRegistrationAccount,
  getRegistryStateAccount,
  initialiseRegistry,
  register,
  REGISTRATION_ACCOUNT_SIZE,
  REGISTRATION_INDEX_OFFSET,
} from "../solana_program_register/solana_register_interface";
import {
  createAwsClients,
  type PollerClients,
  type PollerConfig,
  pollOnce,
  REGISTRATION_DETECTED_DETAIL_TYPE,
  registrationIndexFilters,
} from "./poller";

// The two condition expressions the poller relies on for correctness. Pinned here so that changing
// either one in `poller.ts` fails a test rather than silently weakening the dedup or the watermark race.
const DEDUP_CONDITION = "attribute_not_exists(pk)";
const WATERMARK_CONDITION = "attribute_not_exists(pk) OR registration_count = :expected";
const WATERMARK_UPDATE = "SET registration_count = :next, updated_at = :now";

type Item = Record<string, unknown>;

/**
 * DynamoDB stores numbers as strings and the document client hands them back as `number`, so the
 * fake table mirrors that round trip — the poller's `BigInt(count as number)` has to survive it.
 */
const asStoredItem = (item: Item): Item =>
  Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : value]),
  );

const conditionalCheckFailed = () =>
  new ConditionalCheckFailedException({ $metadata: {}, message: "The conditional request failed" });

const loadKeypairFromFile = async (path: string): Promise<KeyPairSigner> => {
  const keyData = JSON.parse(readFileSync(path, "utf-8"));
  return await createKeyPairSignerFromBytes(new Uint8Array(keyData));
};

// The whole suite shares one validator, and `confirmRecentSignature` defaults to a 5s window against
// a validator configured with `--ticks-per-slot 256`. Give chain writes made here more room than that,
// so this file does not fail — or push others over — on a slow slot.
const CONFIRMATION_TIMEOUT_MS = 20_000;

/** Registers a fresh, funded account and reports the index the program assigned it. */
const registerOne = async (programAddress: Address) => {
  const registrant = await generateKeyPairSigner();
  await sendAndConfirmAirdrop(registrant.address, BigInt(LAMPORTS_PER_SOL));

  const signature = await register(registrant, programAddress);
  const confirmed = await confirmRecentSignature(signature, CONFIRMATION_TIMEOUT_MS);

  // Without this the next line races the ledger and fails with a confusing "account does not exist".
  assert.ok(confirmed, `registration ${signature} was not confirmed within ${CONFIRMATION_TIMEOUT_MS}ms`);

  const account = await getRegistrationAccount(registrant.address, programAddress);

  return {
    registrant: registrant.address,
    index: account.registration_index,
    registeredAt: account.registered_at,
  };
};

describe("solana register sync poller", () => {
  let config: PollerConfig;
  let programAddress: Address;
  let subject: Awaited<ReturnType<typeof registerOne>>;
  let table: Map<string, Item>;
  let clients: PollerClients;
  let dynamoMock: ReturnType<typeof mockClient>;
  let eventBridgeMock: ReturnType<typeof mockClient>;

  before(async () => {
    const programId = getEnvVar("register_PROGRAM_ID");

    if (!programId) {
      assert.fail("environment variable register_PROGRAM_ID is not set");
    }

    programAddress = address(programId);

    // `eventSource` must match `local.solana_register_event_source` in both Terraform roots — the
    // EventBridge rules match on it, so the envelope assertions below are checking a real contract.
    config = {
      programId,
      tableName: "ff_test_solana_register_registrations",
      eventBusName: "ff_test_solana_register",
      eventSource: "ff.solana.register",
    };

    // The registry is a singleton PDA shared by every test run against this validator. Initialise it
    // only when it is genuinely absent — the poller itself needs no authority, so the deployer keypair
    // is read lazily rather than on every run. `solana_register_interface.test.ts` and the Fastify
    // `/register/initialise` route bootstrap the same PDA, and the runner executes files in parallel,
    // so losing that race is expected rather than exceptional.
    try {
      await getRegistryStateAccount(programAddress);
    } catch {
      const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? "./solana_program_keys/solana_deployer.json";
      const authority = await loadKeypairFromFile(keypairPath);
      await sendAndConfirmAirdrop(authority.address, BigInt(LAMPORTS_PER_SOL));

      try {
        await confirmRecentSignature(await initialiseRegistry(authority, programAddress), CONFIRMATION_TIMEOUT_MS);
      } catch (e) {
        const logs = (e as { context?: { logs?: string[] } })?.context?.logs?.join(" ") ?? "";
        if (!logs.includes("already in use")) {
          throw e;
        }
      }
    }

    // Every chain write this file makes happens here: one registration the single-ingest tests read
    // (they only ever read it, and the fake table is rebuilt per test, so it is safe to share), plus
    // two more so the backlog test has three consecutive indices to drain. Keeping it to three
    // registrations keeps this file's load on the shared validator to a minimum.
    subject = await registerOne(programAddress);
    await registerOne(programAddress);
    await registerOne(programAddress);
  });

  beforeEach(() => {
    table = new Map();
    dynamoMock = mockClient(DynamoDBDocumentClient);
    eventBridgeMock = mockClient(EventBridgeClient);

    dynamoMock.on(GetCommand).callsFake((input: GetCommandInput) => ({
      Item: table.get(String(input.Key?.pk)),
    }));

    dynamoMock.on(PutCommand).callsFake((input: PutCommandInput) => {
      assert.strictEqual(input.ConditionExpression, DEDUP_CONDITION);

      const key = String(input.Item?.pk);

      if (table.has(key)) {
        throw conditionalCheckFailed();
      }

      table.set(key, asStoredItem(input.Item as Item));

      return {};
    });

    dynamoMock.on(UpdateCommand).callsFake((input: UpdateCommandInput) => {
      assert.strictEqual(input.ConditionExpression, WATERMARK_CONDITION);
      assert.strictEqual(input.UpdateExpression, WATERMARK_UPDATE);

      const key = String(input.Key?.pk);
      const values = input.ExpressionAttributeValues ?? {};
      const existing = table.get(key);

      if (existing !== undefined && existing.registration_count !== Number(values[":expected"])) {
        throw conditionalCheckFailed();
      }

      table.set(
        key,
        asStoredItem({ pk: key, registration_count: values[":next"], updated_at: values[":now"] }),
      );

      return {};
    });

    eventBridgeMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });

    clients = createAwsClients();
  });

  afterEach(() => {
    dynamoMock.restore();
    eventBridgeMock.restore();
  });

  const seedWatermark = (count: bigint) => {
    table.set(`WATERMARK#${config.programId}`, {
      pk: `WATERMARK#${config.programId}`,
      registration_count: Number(count),
    });
  };

  const watermarkValue = () => table.get(`WATERMARK#${config.programId}`)?.registration_count;

  const publishedEvents = () =>
    eventBridgeMock.commandCalls(PutEventsCommand).flatMap((call) =>
      (call.args[0].input as { Entries?: { Source?: string; DetailType?: string; Detail?: string }[] }).Entries ?? []
    );

  test("no-ops when the registration count has not moved past the watermark", async () => {
    // Deliberately far ahead of any count this validator could reach, so the branch is exercised
    // regardless of what else registered against the shared registry.
    const { registration_count } = await getRegistryStateAccount(programAddress);
    seedWatermark(registration_count + 1_000_000n);

    const result = await pollOnce(config, clients);

    assert.strictEqual(result.outcome, "no_new_registrations");
    assert.strictEqual(publishedEvents().length, 0);
    assert.strictEqual(dynamoMock.commandCalls(PutCommand).length, 0);
    assert.strictEqual(dynamoMock.commandCalls(UpdateCommand).length, 0);
  });

  test("ingests exactly one registration, records it and publishes the event", async () => {
    const { registrant, index, registeredAt } = subject;
    seedWatermark(index);

    const result = await pollOnce(config, clients);

    assert.strictEqual(result.outcome, "ingested");
    assert.strictEqual(result.recordCreated, true);
    assert.strictEqual(result.registrant, registrant);

    // The record landed under the registrant key, at the starting status.
    const record = table.get(`REGISTRANT#${registrant}`);
    assert.strictEqual(record?.status, "registered");
    assert.strictEqual(record?.registrant, registrant);
    assert.strictEqual(record?.registration_index, Number(index));
    assert.strictEqual(record?.confirmed_at, null);

    // The watermark advanced by exactly one.
    assert.strictEqual(watermarkValue(), Number(index) + 1);

    // The envelope has to match the EventBridge rule in `ff_dev/solana_register.tf`, which matches on
    // `source` AND `detail-type` — a mismatch in either publishes successfully to no queue at all.
    const events = publishedEvents();
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].Source, "ff.solana.register");
    assert.strictEqual(events[0].DetailType, REGISTRATION_DETECTED_DETAIL_TYPE);
    assert.deepStrictEqual(JSON.parse(events[0].Detail ?? "{}"), {
      program_id: config.programId,
      registrant,
      registration_index: Number(index),
      registered_at: Number(registeredAt),
    });
  });

  test("publishes for an already-recorded registrant without creating a second row", async () => {
    const { registrant, index } = subject;
    seedWatermark(index);
    table.set(`REGISTRANT#${registrant}`, {
      pk: `REGISTRANT#${registrant}`,
      status: "confirmed",
      registration_index: Number(index),
    });

    const result = await pollOnce(config, clients);

    assert.strictEqual(result.outcome, "ingested");
    assert.strictEqual(result.recordCreated, false);
    // The pre-existing row is untouched — the conditional write did not overwrite `confirmed`.
    assert.strictEqual(table.get(`REGISTRANT#${registrant}`)?.status, "confirmed");
    assert.strictEqual(publishedEvents().length, 1);
    assert.strictEqual(watermarkValue(), Number(index) + 1);
  });

  test("does not publish twice within one invocation when the watermark advance loses the race", async () => {
    const { index } = subject;
    seedWatermark(index);
    dynamoMock.on(UpdateCommand).rejects(conditionalCheckFailed());

    const result = await pollOnce(config, clients);

    assert.strictEqual(result.outcome, "ingested_watermark_conflict");
    assert.strictEqual(publishedEvents().length, 1);
    // The watermark is untouched, so the next invocation retries the same index.
    assert.strictEqual(watermarkValue(), Number(index));
  });

  test("drains a backlog one registration per invocation", async () => {
    // `before` registered `subject` plus two more, so three consecutive indices exist from here. They
    // need not be the ones this file created — the invariant under test is "one index per invocation,
    // in order", which holds whoever registered them.
    const backlog = 3;
    seedWatermark(subject.index);

    for (let invocation = 0; invocation < backlog; invocation++) {
      const result = await pollOnce(config, clients);

      assert.strictEqual(result.outcome, "ingested");
      assert.strictEqual(result.watermark, subject.index + BigInt(invocation));
      assert.strictEqual(watermarkValue(), Number(subject.index) + invocation + 1);
      assert.strictEqual(publishedEvents().length, invocation + 1);
    }

    // Indices are consumed in order, one per invocation, with no gaps and no repeats.
    assert.deepStrictEqual(
      publishedEvents().map((event) => JSON.parse(event.Detail ?? "{}").registration_index),
      Array.from({ length: backlog }, (_, i) => Number(subject.index) + i),
    );
  });
});

describe("solana register sync registration index filter", () => {
  test("targets the registration_index field of the on-chain Registration layout", () => {
    const [dataSizeFilter, memcmpFilter] = registrationIndexFilters(258n);

    assert.strictEqual(dataSizeFilter.dataSize, BigInt(REGISTRATION_ACCOUNT_SIZE));
    assert.strictEqual(memcmpFilter.memcmp.offset, BigInt(REGISTRATION_INDEX_OFFSET));
    assert.strictEqual(memcmpFilter.memcmp.offset, 40n);
    assert.strictEqual(memcmpFilter.memcmp.encoding, "base58");

    // `memcmp` compares raw account bytes, so what matters is the byte layout the filter decodes to:
    // 258 as a little-endian u64 is 0x02 0x01 followed by six zero bytes. Written out by hand rather
    // than re-encoded here, so a big-endian slip in `poller.ts` cannot be mirrored by the assertion.
    assert.deepStrictEqual(
      new Uint8Array(getBase58Encoder().encode(memcmpFilter.memcmp.bytes)),
      new Uint8Array([2, 1, 0, 0, 0, 0, 0, 0]),
    );

    // Base58 reads those bytes back as one big-endian integer (144,396,663,052,566,528), so the wire
    // string bears no resemblance to 258. Pinned to catch a change of alphabet, which the byte
    // assertion above would not: `getBase58Encoder` would decode any alphabet the encoder used.
    assert.strictEqual(memcmpFilter.memcmp.bytes, "LSYWV7p8gw");
  });
});
