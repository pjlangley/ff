# Single-table design: `pk` discriminates the two item shapes that share the table.
#   REGISTRANT#<pubkey>    - registration_index, registered_at, confirmed_at, status
#                            (registered -> confirmed -> audited), source signatures, timestamps
#   WATERMARK#<program_id> - the poller's last-processed registration_count
# Everything beyond the key is schemaless, so only `pk` is declared here.
resource "aws_dynamodb_table" "this" {
  name         = "${var.name_prefix}_${var.name}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }
}
