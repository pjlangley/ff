locals {
  name_prefix = "${var.project}_${var.environment}"

  # `source` field of every event envelope published to the solana_register bus. Not environment-scoped:
  # the bus itself is per environment, so the source identifies the producing domain, not the stage.
  solana_register_event_source = "ff.solana.register"
}
