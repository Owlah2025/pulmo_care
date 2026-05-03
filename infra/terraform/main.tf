terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Example VPC for the application
resource "aws_vpc" "pulmo_care_vpc" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true

  tags = {
    Name = "pulmo-care-vpc"
  }
}

# Example Cognito setup
resource "aws_cognito_user_pool" "pool" {
  name = "pulmo_care_user_pool"

  password_policy {
    minimum_length = 8
    require_lowercase = true
    require_numbers = true
    require_symbols = true
    require_uppercase = true
  }

  mfa_configuration = "OPTIONAL"
}
