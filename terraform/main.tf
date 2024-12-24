terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"
}

provider "aws" {
  region = "eu-central-1"
}

resource "aws_s3_bucket" "staticSite" {
  bucket = "brandonverzuu.com"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "bucketEncryption" {
  bucket = aws_s3_bucket.staticSite.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "publicAccessConfig" {
  bucket                  = aws_s3_bucket.staticSite.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.staticSite.id
  versioning_configuration {
    status = "Enabled"
  }
}