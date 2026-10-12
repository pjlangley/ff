import assert from "node:assert/strict";
import test, { afterEach, beforeEach, describe } from "node:test";
import { env } from "node:process";
import { type Message, ReceiveMessageCommand, type ReceiveMessageCommandInput, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  type ConsumeConfig,
  consumeQueue,
  DEFAULT_POLL_INTERVAL_SECONDS,
  type MessageHandler,
  parseDetail,
  readPollIntervalSeconds,
  requireEnvVar,
} from "./shared";

// The receive loop never touches the chain — that is each consumer's handler — so these tests drive it
// with a stub handler. Each consumer's own tests check that its real handler is wired in.
describe("solana register sync shared consumer loop", () => {
  // The real default, so a test that wrongly slept would hang rather than pass by accident.
  const config: ConsumeConfig = {
    queueUrl: "https://sqs.eu-west-2.amazonaws.com/000000000000/ff_test_solana_register_registrants",
    pollIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
  };

  let sqsMock: ReturnType<typeof mockClient>;
  let sqs: SQSClient;
  let handled: (string | undefined)[];

  const messageNamed = (id: string): Message => ({ MessageId: id, ReceiptHandle: `receipt-${id}`, Body: "{}" });

  /** Records each message it is handed, as a consumer's handler would process and delete it. */
  const recordingHandler: MessageHandler = (message) => {
    handled.push(message.MessageId);
    return Promise.resolve({ outcome: "handled" });
  };

  const receives = () => sqsMock.commandCalls(ReceiveMessageCommand).map((call) => call.args[0].input);

  beforeEach(() => {
    sqsMock = mockClient(SQSClient);
    sqs = new SQSClient({});
    handled = [];
  });

  afterEach(() => {
    sqsMock.restore();
  });

  test("long polls the configured queue for one message at a time", async () => {
    const controller = new AbortController();
    sqsMock.on(ReceiveMessageCommand).callsFake(() => {
      controller.abort();
      return {};
    });

    await consumeQueue(config, sqs, controller.signal, recordingHandler);

    assert.deepStrictEqual(receives(), [
      {
        QueueUrl: config.queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
      } satisfies ReceiveMessageCommandInput,
    ]);
  });

  test("sleeps after an empty poll rather than polling again, and shutdown cuts the sleep short", async () => {
    const controller = new AbortController();
    sqsMock.on(ReceiveMessageCommand).callsFake(() => {
      // SIGTERM arrives once the cycle is over, well inside the 30-minute sleep.
      setTimeout(() => controller.abort(), 100);
      return {};
    });

    const started = Date.now();
    await consumeQueue(config, sqs, controller.signal, recordingHandler);

    assert.strictEqual(receives().length, 1);
    assert.ok(Date.now() - started < 5_000, "shutdown should not wait out the interval");
  });

  test("handles one message per cycle, sleeping before the next even with a backlog waiting", async () => {
    const controller = new AbortController();
    const first = messageNamed("first");
    const second = messageNamed("second");
    const queue = [first, second];

    // `splice` takes the head of the queue as a 0- or 1-element array: exactly a receive's `Messages`.
    sqsMock.on(ReceiveMessageCommand).callsFake(() => ({ Messages: queue.splice(0, 1) }));

    // Shutdown lands shortly after the first message is handled — inside the interval sleep if the
    // loop sleeps, but well after a second receive if it went straight back to the queue.
    await consumeQueue(config, sqs, controller.signal, (message) => {
      setTimeout(() => controller.abort(), 200);
      return recordingHandler(message);
    });

    assert.strictEqual(receives().length, 1);
    assert.deepStrictEqual(handled, ["first"]);
    // The second message is still on the queue for the next cycle.
    assert.deepStrictEqual(queue, [second]);
  });

  test("on shutdown, finishes the in-flight message and then stops receiving", async () => {
    const controller = new AbortController();
    // The abort lands while the receive is in flight, exactly as SIGTERM would during a long poll.
    sqsMock.on(ReceiveMessageCommand).callsFake(() => {
      controller.abort();
      return { Messages: [messageNamed("in-flight")] };
    });

    await consumeQueue(config, sqs, controller.signal, async (message) => {
      // Still running after the abort, as an on-chain confirmation would be.
      await new Promise((resolve) => setTimeout(resolve, 100));
      return recordingHandler(message);
    });

    assert.strictEqual(receives().length, 1);
    assert.deepStrictEqual(handled, ["in-flight"]);
  });

  test("a failing handler is logged and the loop carries on to the next cycle", async () => {
    const controller = new AbortController();
    const queue = [messageNamed("poison")];
    sqsMock.on(ReceiveMessageCommand).callsFake(() => {
      if (queue.length === 0) {
        controller.abort();
      }
      return { Messages: queue.splice(0, 1) };
    });

    // `0` is back-to-back polls, so the next cycle runs straight away.
    await consumeQueue({ ...config, pollIntervalSeconds: 0 }, sqs, controller.signal, () => {
      return Promise.reject(new Error("handler failed"));
    });

    assert.strictEqual(receives().length, 2);
  });

  test("a failed receive ends the cycle without throwing", async () => {
    const controller = new AbortController();
    sqsMock.on(ReceiveMessageCommand).callsFake(() => {
      setTimeout(() => controller.abort(), 100);
      throw new Error("receive failed");
    });

    await consumeQueue(config, sqs, controller.signal, recordingHandler);

    assert.strictEqual(receives().length, 1);
    assert.deepStrictEqual(handled, []);
  });
});

describe("solana register sync shared envelope parsing", () => {
  const programId = "DPEfE7E9LExX61taVQRQHpxZGkFEKLzRqwfCDMtzFg2K";

  const envelope = (detailType: string, detail: Record<string, unknown>): Message => ({
    MessageId: "message",
    Body: JSON.stringify({ "detail-type": detailType, source: "ff.solana.register", detail }),
  });

  test("returns the detail of a matching envelope", () => {
    const detail = { "program_id": programId, registrant: "registrant" };

    assert.deepStrictEqual(
      parseDetail(envelope("RegistrationConfirmed", detail), "RegistrationConfirmed", programId),
      detail,
    );
  });

  test("rejects another detail-type", () => {
    const message = envelope("RegistrationDetected", { program_id: programId });

    assert.throws(() => parseDetail(message, "RegistrationConfirmed", programId), /Unexpected detail-type/);
  });

  test("rejects a message for another program", () => {
    const message = envelope("RegistrationConfirmed", { program_id: "11111111111111111111111111111111" });

    assert.throws(() => parseDetail(message, "RegistrationConfirmed", programId), /is for program/);
  });
});

describe("solana register sync shared environment", () => {
  const original = env.POLL_INTERVAL_SECONDS;

  afterEach(() => {
    if (original === undefined) {
      delete env.POLL_INTERVAL_SECONDS;
    } else {
      env.POLL_INTERVAL_SECONDS = original;
    }
  });

  test("POLL_INTERVAL_SECONDS unset or empty means the default", () => {
    delete env.POLL_INTERVAL_SECONDS;
    assert.strictEqual(readPollIntervalSeconds(), 1800);

    env.POLL_INTERVAL_SECONDS = "";
    assert.strictEqual(readPollIntervalSeconds(), 1800);
  });

  test("POLL_INTERVAL_SECONDS accepts any non-negative integer, including 0", () => {
    env.POLL_INTERVAL_SECONDS = "0";
    assert.strictEqual(readPollIntervalSeconds(), 0);

    env.POLL_INTERVAL_SECONDS = "60";
    assert.strictEqual(readPollIntervalSeconds(), 60);
  });

  test("POLL_INTERVAL_SECONDS fails startup on anything else", () => {
    for (const value of ["-1", "1.5", "thirty"]) {
      env.POLL_INTERVAL_SECONDS = value;
      assert.throws(() => readPollIntervalSeconds(), /must be a non-negative integer/, value);
    }
  });

  test("requireEnvVar fails startup on an unset variable", () => {
    assert.throws(() => requireEnvVar("FF_TEST_UNSET_VARIABLE"), /FF_TEST_UNSET_VARIABLE is not set/);
  });
});
