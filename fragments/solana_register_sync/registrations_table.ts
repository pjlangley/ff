import type { Address } from "@solana/kit";

// Partition keys of the registrations table's two item shapes (see
// `fragments/terraform/modules/solana_registrations_table/main.tf`). Every producer and consumer of the
// table derives its keys here, so a format change cannot leave one writing rows another never finds.
// Tests deliberately spell the formats out rather than importing these, so they pin the contract the
// stored rows depend on instead of agreeing with whatever this module says. Kept free of side effects
// for the same reason as `events.ts`.

/** `REGISTRANT#<pubkey>`: one row per registrant, written by the poller and moved on by the consumers. */
export const registrantKey = (registrant: Address) => `REGISTRANT#${registrant}`;

/** `WATERMARK#<program_id>`: the poller's last-processed `registration_count` for one program instance. */
export const watermarkKey = (programId: string) => `WATERMARK#${programId}`;
