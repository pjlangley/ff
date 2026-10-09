import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, before, beforeEach, describe } from "node:test";
import process from "node:process";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DynamoDBDocumentClient, UpdateCommand, type UpdateCommandInput } from "@aws-sdk/lib-dynamodb";
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
  consume,
  createAwsClients,
  DEFAULT_POLL_INTERVAL_SECONDS,
  processMessage,
  type RegistrantsConsumerClients,
  type RegistrantsConsumerConfig,
} from "./registrants_consumer";

// The one write the consumer makes — with the signature SET only when the attempt has one — and the
// condition it relies on for replay safety. Pinned here so that changing either in
// `registrants_consumer.ts` fails a test rather than silently weakening the guarantees; the fake
// table below implements exactly these semantics.
const CONFIRM_UPDATE = "SET #status = :confirmed, confirmed_at = :confirmed_at, updated_at = :now";
const CONFIRM_UPDATE_WITH_SIGNATURE = `${CONFIRM_UPDATE}, confirmation_signature = :signature`;
const CONFIRM_CONDITION = "attribute_exists(pk) AND #status <> :audited";

type Item = Record<string, unknown>;

/** DynamoDB hands numbers back as `number`, so the fake table stores bigints the same way. */
const asStored = (value: unknown) => typeof value === "bigint" ? Number(value) : value;

/**
 * With `ReturnValuesOnConditionCheckFailure: "ALL_OLD"`, DynamoDB attaches the existing item to the
 * exception — and attaches nothing when there is no item. Only the item's presence is read, so its
 * (marshalled) contents are a stand-in.
 */
const conditionalCheckFailed = (existing?: Item) =>
  new ConditionalCheckFailedException({
    $metadata: {},
    message: "The conditional request failed",
    Item: existing ? { pk: { S: String(existing.pk) } } : undefined,
  });

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

describe("solana register sync registrants consumer", () => {
  let config: RegistrantsConsumerConfig;
  let programAddress: Address;
  let authority: KeyPairSigner;
  let unconfirmed: Awaited<ReturnType<typeof registerOne>>;
  let confirmed: Awaited<ReturnType<typeof registerOne>>;
  let table: Map<string, Item>;
  let clients: RegistrantsConsumerClients;
  let sqsMock: ReturnType<typeof mockClient>;
  let dynamoMock: ReturnType<typeof mockClient>;
  let eventBridgeMock: ReturnType<typeof mockClient>;

  before(async () => {
    const programId = getEnvVar("register_PROGRAM_ID");

    if (!programId) {
      assert.fail("environment variable register_PROGRAM_ID is not set");
    }

    programAddress = address(programId);

    // `eventSource` must match `local.solana_register_event_source` in both Terraform roots.
    config = {
      programId,
      queueUrl: "https://sqs.eu-west-2.amazonaws.com/000000000000/ff_test_solana_register_registrants",
      tableName: "ff_test_solana_register_registrations",
      eventBusName: "ff_test_solana_register",
      eventSource: "ff.solana.register",
      // The real default, so a test that wrongly slept would hang rather than pass by accident.
      pollIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
    };

    // Unlike the poller, the consumer signs `confirm_registration`, so it always needs the registry
    // authority — the deployer, which is also the only key allowed to initialise the registry.
    const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? "./solana_program_keys/solana_deployer.json";
    authority = await loadKeypairFromFile(keypairPath);
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

    // Every chain write this file makes, bar the happy path's own `confirm_registration`: one
    // registration left unconfirmed for the happy path, and one confirmed up front for every test
    // that exercises the already-confirmed path. The failure test needs no write at all.
    unconfirmed = await registerOne(programAddress);
    confirmed = await registerOne(programAddress);
    await confirmOrFail(
      await confirmRegistration(authority, programAddress, confirmed.registrant),
      "confirm_registration",
    );
    confirmed = await getRegistrationAccount(confirmed.registrant, programAddress);
  });

  beforeEach(() => {
    table = new Map();
    sqsMock = mockClient(SQSClient);
    dynamoMock = mockClient(DynamoDBDocumentClient);
    eventBridgeMock = mockClient(EventBridgeClient);

    dynamoMock.on(UpdateCommand).callsFake((input: UpdateCommandInput) => {
      const key = String(input.Key?.pk);
      const values = input.ExpressionAttributeValues ?? {};
      const existing = table.get(key);

      const withSignature = input.UpdateExpression === CONFIRM_UPDATE_WITH_SIGNATURE;

      assert.ok(
        withSignature || input.UpdateExpression === CONFIRM_UPDATE,
        `unexpected UpdateExpression: ${input.UpdateExpression}`,
      );
      // The value travels with the SET and only with it; DynamoDB rejects an unused value.
      assert.strictEqual(":signature" in values, withSignature);
      assert.strictEqual(input.ConditionExpression, CONFIRM_CONDITION);
      assert.strictEqual(input.ReturnValuesOnConditionCheckFailure, "ALL_OLD");
      assert.deepStrictEqual(input.ExpressionAttributeNames, { "#status": "status" });

      // `attribute_exists(pk) AND #status <> :audited`
      if (existing === undefined || existing.status === values[":audited"]) {
        throw conditionalCheckFailed(existing);
      }

      table.set(key, {
        ...existing,
        status: values[":confirmed"],
        confirmed_at: asStored(values[":confirmed_at"]),
        updated_at: values[":now"],
        ...(withSignature ? { confirmation_signature: values[":signature"] } : {}),
      });

      return {};
    });

    eventBridgeMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    sqsMock.on(DeleteMessageCommand).resolves({});

    clients = createAwsClients();
  });

  afterEach(() => {
    sqsMock.restore();
    dynamoMock.restore();
    eventBridgeMock.restore();
  });

  /** What SQS delivers: the whole EventBridge envelope, since the rule sets no input transformer. */
  const messageFor = (
    registration: Pick<RegistrationAccount, "registrant" | "registration_index" | "registered_at">,
    programId = config.programId,
  ): Message => ({
    MessageId: `message-${registration.registrant}`,
    ReceiptHandle: `receipt-${registration.registrant}`,
    Body: JSON.stringify({
      version: "0",
      id: "00000000-0000-0000-0000-000000000000",
      "detail-type": REGISTRATION_DETECTED_DETAIL_TYPE,
      source: config.eventSource,
      account: "000000000000",
      time: new Date().toISOString(),
      region: "eu-west-2",
      resources: [],
      detail: {
        program_id: programId,
        registrant: registration.registrant,
        registration_index: Number(registration.registration_index),
        registered_at: Number(registration.registered_at),
      },
    }),
  });

  /** The row exactly as the poller's `recordRegistrant` writes it, before the event is published. */
  const seedPollerRecord = (
    registration: Pick<RegistrationAccount, "registrant" | "registration_index" | "registered_at">,
  ) => {
    const key = `REGISTRANT#${registration.registrant}`;
    table.set(key, {
      pk: key,
      registrant: registration.registrant,
      registration_index: Number(registration.registration_index),
      registered_at: Number(registration.registered_at),
      confirmed_at: null,
      status: "registered",
      detected_at: "2026-01-01T00:00:00.000Z",
    });
    return key;
  };

  const publishedEvents = () =>
    eventBridgeMock.commandCalls(PutEventsCommand).flatMap((call) =>
      (call.args[0].input as { Entries?: { Source?: string; DetailType?: string; Detail?: string }[] }).Entries ?? []
    );

  const deletedReceiptHandles = () =>
    sqsMock.commandCalls(DeleteMessageCommand).map((call) => {
      const input = call.args[0].input as { QueueUrl?: string; ReceiptHandle?: string };
      assert.strictEqual(input.QueueUrl, config.queueUrl);
      return input.ReceiptHandle;
    });

  const onChainConfirmedAt = async (registrant: Address) => {
    const registration = await getRegistrationAccount(registrant, programAddress);
    assert.ok(isSome(registration.confirmed_at), `${registrant} is not confirmed on-chain`);
    return registration.confirmed_at.value;
  };

  /** Runs the loop against a queue holding exactly `message`, as if `SIGTERM` arrived mid long poll. */
  const consumeOne = async (message: Message) => {
    const controller = new AbortController();
    sqsMock.on(ReceiveMessageCommand).callsFake(() => {
      controller.abort();
      return { Messages: [message] };
    });
    await consume(config, clients, authority, controller.signal);
  };

  test("confirms on-chain, records confirmed_at from the chain, publishes and deletes", async () => {
    const message = messageFor(unconfirmed);
    seedPollerRecord(unconfirmed);

    const result = await processMessage(config, clients, authority, message);

    const confirmedAt = await onChainConfirmedAt(unconfirmed.registrant);
    assert.strictEqual(result.confirmedAt, confirmedAt);
    assert.ok(result.signature, "a fresh confirmation reports its signature");
    assert.strictEqual(result.statusUpdated, true);

    const record = table.get(`REGISTRANT#${unconfirmed.registrant}`);
    assert.strictEqual(record?.status, "confirmed");
    assert.strictEqual(record?.confirmed_at, Number(confirmedAt));
    assert.strictEqual(record?.confirmation_signature, result.signature);
    assert.strictEqual(record?.registration_index, Number(unconfirmed.registration_index));

    // The envelope has to match the `registration_confirmed` rule, which matches on `source` AND
    // `detail-type`.
    const events = publishedEvents();
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].Source, "ff.solana.register");
    assert.strictEqual(events[0].DetailType, REGISTRATION_CONFIRMED_DETAIL_TYPE);
    assert.deepStrictEqual(JSON.parse(events[0].Detail ?? "{}"), {
      program_id: config.programId,
      registrant: unconfirmed.registrant,
      registration_index: Number(unconfirmed.registration_index),
      confirmed_at: Number(confirmedAt),
      signature: result.signature,
    });

    assert.deepStrictEqual(deletedReceiptHandles(), [message.ReceiptHandle]);
  });

  test("treats RegistrationAlreadyConfirmed as success", async () => {
    const message = messageFor(confirmed);
    seedPollerRecord(confirmed);

    const result = await processMessage(config, clients, authority, message);

    // Reconciled from the slot the earlier confirmation stamped, not from this attempt.
    const confirmedAt = await onChainConfirmedAt(confirmed.registrant);
    assert.strictEqual(result.confirmedAt, confirmedAt);
    assert.strictEqual(result.signature, null);
    const record = table.get(`REGISTRANT#${confirmed.registrant}`);
    assert.strictEqual(record?.status, "confirmed");
    assert.strictEqual(record?.confirmed_at, Number(confirmedAt));
    // No signature of its own, so none is written — not even a null, which would otherwise occupy
    // the attribute ahead of a racing consumer's real one.
    assert.ok(!(record && "confirmation_signature" in record), "a null signature must not be written");
    assert.strictEqual(JSON.parse(publishedEvents()[0].Detail ?? "{}").signature, null);
    assert.deepStrictEqual(deletedReceiptHandles(), [message.ReceiptHandle]);
  });

  test("re-processing the same message produces no duplicate row and preserves the record", async () => {
    const message = messageFor(confirmed);

    // The row as the poller wrote it, plus the signature an earlier successful attempt recorded.
    const key = seedPollerRecord(confirmed);
    table.set(key, { ...table.get(key), confirmation_signature: "earlier-attempt-signature" });

    await processMessage(config, clients, authority, message);
    const afterFirst = { ...table.get(key) };
    await processMessage(config, clients, authority, message);

    assert.deepStrictEqual([...table.keys()], [key]);
    const record = table.get(key);
    assert.strictEqual(record?.status, "confirmed");
    assert.strictEqual(record?.confirmed_at, Number(await onChainConfirmedAt(confirmed.registrant)));
    assert.strictEqual(record?.detected_at, "2026-01-01T00:00:00.000Z");
    // Neither replay knew a signature, and neither overwrote the one already recorded.
    assert.strictEqual(record?.confirmation_signature, "earlier-attempt-signature");
    assert.deepStrictEqual({ ...record, updated_at: undefined }, { ...afterFirst, updated_at: undefined });
    assert.deepStrictEqual(deletedReceiptHandles(), [message.ReceiptHandle, message.ReceiptHandle]);
  });

  test("does not demote an audited record when a message is replayed", async () => {
    const key = `REGISTRANT#${confirmed.registrant}`;
    const message = messageFor(confirmed);
    table.set(key, { pk: key, status: "audited" });

    const result = await processMessage(config, clients, authority, message);

    assert.strictEqual(result.statusUpdated, false);
    assert.strictEqual(table.get(key)?.status, "audited");
    assert.deepStrictEqual(deletedReceiptHandles(), [message.ReceiptHandle]);
  });

  test("a failed on-chain send leaves the message undeleted", async () => {
    // Never registered, so there is no `Registration` PDA and `confirm_registration` fails preflight
    // on the validator itself — a genuine chain failure, with no write needed to set it up.
    const stranger = await generateKeyPairSigner();
    const message = messageFor({
      registrant: stranger.address,
      registration_index: 0n,
      registered_at: 0n,
    });
    seedPollerRecord({ registrant: stranger.address, registration_index: 0n, registered_at: 0n });

    await assert.rejects(processMessage(config, clients, authority, message));

    // And the loop survives it: logs, leaves the message for the visibility timeout, carries on.
    await consumeOne(message);

    assert.deepStrictEqual(deletedReceiptHandles(), []);
    assert.strictEqual(publishedEvents().length, 0);
    assert.strictEqual(table.get(`REGISTRANT#${stranger.address}`)?.status, "registered");
  });

  test("fails without publishing or deleting when the poller's record is missing", async () => {
    // No `seedPollerRecord`: the poller writes before it publishes, so this is outside the healthy
    // path. `confirmed` is already confirmed on-chain, so the test makes no chain write.
    const message = messageFor(confirmed);

    await assert.rejects(processMessage(config, clients, authority, message), /No REGISTRANT#.* record/);

    // The condition stopped `UpdateItem` from creating a partial row.
    assert.strictEqual(table.size, 0);
    assert.strictEqual(publishedEvents().length, 0);
    assert.deepStrictEqual(deletedReceiptHandles(), []);
  });

  test("rejects a message for another program without touching the chain or the table", async () => {
    const message = messageFor(confirmed, "11111111111111111111111111111111");

    await assert.rejects(processMessage(config, clients, authority, message), /is for program/);

    assert.strictEqual(dynamoMock.commandCalls(UpdateCommand).length, 0);
    assert.deepStrictEqual(deletedReceiptHandles(), []);
  });

  test("sleeps after an empty poll rather than polling again, and shutdown cuts the sleep short", async () => {
    const controller = new AbortController();
    sqsMock.on(ReceiveMessageCommand).callsFake(() => {
      // SIGTERM arrives once the cycle is over, well inside the 30-minute sleep.
      setTimeout(() => controller.abort(), 100);
      return {};
    });

    const started = Date.now();
    await consume(config, clients, authority, controller.signal);

    assert.strictEqual(sqsMock.commandCalls(ReceiveMessageCommand).length, 1);
    assert.ok(Date.now() - started < 5_000, "shutdown should not wait out the interval");
  });

  test("handles one message per cycle, sleeping before the next even with a backlog waiting", async () => {
    seedPollerRecord(confirmed);
    const controller = new AbortController();
    const first = messageFor(confirmed);
    const second = { ...first, MessageId: "second", ReceiptHandle: "receipt-second" };
    const queue = [first, second];

    // `splice` takes the head of the queue as a 0- or 1-element array: exactly a receive's `Messages`.
    sqsMock.on(ReceiveMessageCommand).callsFake(() => ({ Messages: queue.splice(0, 1) }));
    // Shutdown lands shortly after the first message is deleted — inside the interval sleep if the
    // consumer sleeps, but well after a second receive if it went straight back to the queue.
    sqsMock.on(DeleteMessageCommand).callsFake(() => {
      setTimeout(() => controller.abort(), 200);
      return {};
    });

    await consume(config, clients, authority, controller.signal);

    assert.strictEqual(sqsMock.commandCalls(ReceiveMessageCommand).length, 1);
    assert.deepStrictEqual(deletedReceiptHandles(), [first.ReceiptHandle]);
    // The second message is still on the queue for the next cycle.
    assert.deepStrictEqual(queue, [second]);
  });

  test("on shutdown, finishes the in-flight message and then stops receiving", async () => {
    const message = messageFor(confirmed);
    seedPollerRecord(confirmed);

    // The abort lands while the receive is in flight, exactly as SIGTERM would during a long poll.
    await consumeOne(message);

    assert.strictEqual(sqsMock.commandCalls(ReceiveMessageCommand).length, 1);
    assert.deepStrictEqual(deletedReceiptHandles(), [message.ReceiptHandle]);
    assert.strictEqual(publishedEvents().length, 1);
  });
});
