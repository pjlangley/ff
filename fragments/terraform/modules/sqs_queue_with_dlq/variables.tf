variable "name" {
  description = "Base name of the queue; composed with name_prefix to form the source and DLQ queue names"
  type        = string
}

variable "name_prefix" {
  description = "Prefix applied to both the source queue and DLQ names (e.g. \"ff_dev\")"
  type        = string
}

variable "max_receive_count" {
  description = "Number of times a message is delivered before SQS moves it to the DLQ"
  type        = number
  default     = 5
}
