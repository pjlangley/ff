terraform {
  required_version = "1.15.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    # Zips the Lambda bundle; see modules/solana_register_poller.
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  cloud {
    workspaces {
      name    = "ff_prod"
      project = "pjlangley_ff"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
