// The register pipeline's event envelope (see `ff_dev/solana_register.tf`). The EventBridge rules
// match on the `detail-type` values exactly, so a producer that drifts from them publishes
// successfully to no queue at all. Kept free of side effects so every producer and consumer can
// import them without constructing another module's AWS clients.
export const REGISTRATION_DETECTED_DETAIL_TYPE = "RegistrationDetected";
export const REGISTRATION_CONFIRMED_DETAIL_TYPE = "RegistrationConfirmed";

// The `detail` payloads, shared so a producer and its consumer change shape together. Producers
// build them with `satisfies`, since `JSON.stringify` would otherwise accept any shape; consumers
// cast the parsed JSON, so these bind the code at compile time but do not validate the wire at
// runtime — nor a message an older producer left on the queue. Keys are the wire format's
// snake_case, hence quoted; on-chain u64s travel as JSON numbers.

/** Published by the poller; consumed by the registrants consumer. */
export interface RegistrationDetectedDetail {
  "program_id": string;
  registrant: string;
  "registration_index": number;
  "registered_at": number;
}

/** Published by the registrants consumer; consumed by the confirmed consumer (auditor). */
export interface RegistrationConfirmedDetail {
  "program_id": string;
  registrant: string;
  "registration_index": number;
  "confirmed_at": number;
  /** Null when the confirmation landed in an earlier attempt, so this one sent no transaction. */
  signature: string | null;
}
