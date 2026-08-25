variable "name" {
  description = "Base name of the table; composed with name_prefix to form the table name"
  type        = string
}

variable "name_prefix" {
  description = "Prefix applied to the table name (e.g. \"ff_dev\")"
  type        = string
}
