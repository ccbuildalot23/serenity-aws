# Cognito Module - HIPAA-Compliant User Pool with PKCE Support

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.name_prefix}-users"
  
  # HIPAA-required user attributes
  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable            = true
    
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
  
  schema {
    attribute_data_type = "String"
    name                = "given_name"
    required            = true
    mutable            = true
    
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
  
  schema {
    attribute_data_type = "String"
    name                = "family_name"
    required            = true
    mutable            = true
    
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
  
  # Custom attributes for HIPAA/business logic
  schema {
    attribute_data_type      = "String"
    name                     = "role"
    developer_only_attribute = false
    mutable                  = true
    
    string_attribute_constraints {
      min_length = 1
      max_length = 50
    }
  }
  
  schema {
    attribute_data_type      = "String"
    name                     = "tenantId"
    developer_only_attribute = false
    mutable                  = true
    
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
  
  # Username configuration
  username_attributes = ["email"]
  alias_attributes    = ["email"]
  
  # Password policy (HIPAA-compliant)
  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
    temporary_password_validity_days = 7
  }
  
  # MFA configuration (required for HIPAA)
  mfa_configuration = var.mfa_required ? "ON" : "OPTIONAL"
  
  software_token_mfa_configuration {
    enabled = var.mfa_required
  }
  
  sms_configuration {
    external_id    = "${var.name_prefix}-sms"
    sns_caller_arn = aws_iam_role.sms.arn
    sns_region     = data.aws_region.current.name
  }
  
  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
    
    recovery_mechanism {
      name     = "verified_phone_number"
      priority = 2
    }
  }
  
  # Advanced security features
  user_pool_add_ons {
    advanced_security_mode = var.advanced_security_mode
  }
  
  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }
  
  # Device tracking (HIPAA audit)
  device_configuration {
    challenge_required_on_new_device      = true
    device_only_remembered_on_user_prompt = true
  }
  
  # User pool policies
  policies {
    password_policy {
      minimum_length    = 12
      require_lowercase = true
      require_numbers   = true
      require_symbols   = true
      require_uppercase = true
    }
  }
  
  # Auto-verified attributes
  auto_verified_attributes = ["email"]
  
  # User invitation settings
  admin_create_user_config {
    allow_admin_create_user_only = var.environment == "prod" ? true : false
    
    invite_message_template {
      email_message = "Welcome to Serenity Health! Your temporary password is {password}"
      email_subject = "Your Serenity Health Account"
      sms_message   = "Your Serenity Health password is {password}"
    }
  }
  
  # Verification messages
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_message        = "Your verification code is {####}"
    email_subject        = "Serenity Health - Verify your email"
    sms_message          = "Your verification code is {####}"
  }
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-user-pool"
    HIPAA = "compliant"
  })
}

# SPA App Client with PKCE
resource "aws_cognito_user_pool_client" "spa" {
  name         = "${var.name_prefix}-spa-client"
  user_pool_id = aws_cognito_user_pool.main.id
  
  # PKCE configuration (required for SPAs)
  generate_secret = false
  
  # OAuth flows
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  
  # Callback URLs (update for production)
  callback_urls = var.environment == "prod" ? [
    "https://${var.domain_name}/auth/callback",
    "https://app.${var.domain_name}/auth/callback"
  ] : [
    "http://localhost:3000/auth/callback",
    "https://localhost:3000/auth/callback"
  ]
  
  logout_urls = var.environment == "prod" ? [
    "https://${var.domain_name}/auth/logout",
    "https://app.${var.domain_name}/auth/logout"
  ] : [
    "http://localhost:3000/auth/logout"
  ]
  
  # Token validity (HIPAA: 15 minutes for PHI access)
  access_token_validity  = var.phi_session_timeout_minutes
  id_token_validity      = var.phi_session_timeout_minutes
  refresh_token_validity = 30  # days
  
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
  
  # Security settings
  prevent_user_existence_errors = "ENABLED"
  
  # Supported identity providers
  supported_identity_providers = ["COGNITO"]
  
  # Read/write attributes
  read_attributes = [
    "email",
    "email_verified",
    "given_name", 
    "family_name",
    "custom:role",
    "custom:tenantId"
  ]
  
  write_attributes = [
    "email",
    "given_name",
    "family_name",
    "custom:role",
    "custom:tenantId"
  ]
  
  # Advanced auth settings
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]
}

# Server App Client (for API backend)
resource "aws_cognito_user_pool_client" "server" {
  name         = "${var.name_prefix}-server-client"
  user_pool_id = aws_cognito_user_pool.main.id
  
  # Generate client secret for server-to-server auth
  generate_secret = true
  
  # OAuth flows for server
  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  
  # Token validity
  access_token_validity  = var.phi_session_timeout_minutes
  id_token_validity      = var.phi_session_timeout_minutes
  refresh_token_validity = 30
  
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
  
  # Auth flows
  explicit_auth_flows = [
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
  
  prevent_user_existence_errors = "ENABLED"
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.domain_name != "" ? "auth.${var.domain_name}" : "${var.name_prefix}-${random_id.domain.hex}"
  user_pool_id = aws_cognito_user_pool.main.id
  
  # Use ACM certificate for custom domain
  certificate_arn = var.domain_name != "" ? var.certificate_arn : null
}

# Random ID for domain suffix
resource "random_id" "domain" {
  byte_length = 4
}

# Identity Pool for unauthenticated access (if needed)
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.name_prefix}-identity-pool"
  allow_unauthenticated_identities = false
  
  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.spa.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }
  
  tags = var.tags
}

# User Groups for RBAC
resource "aws_cognito_user_group" "patients" {
  name         = "Patients"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Patients with access to personal health information"
  precedence   = 1
  role_arn     = aws_iam_role.patients.arn
}

resource "aws_cognito_user_group" "providers" {
  name         = "Providers"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Healthcare providers with clinical access"
  precedence   = 2
  role_arn     = aws_iam_role.providers.arn
}

resource "aws_cognito_user_group" "supporters" {
  name         = "Supporters"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Support staff with limited PHI access"
  precedence   = 3
  role_arn     = aws_iam_role.supporters.arn
}

resource "aws_cognito_user_group" "admins" {
  name         = "Admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "System administrators"
  precedence   = 0
  role_arn     = aws_iam_role.admins.arn
}

# IAM Roles for User Groups
resource "aws_iam_role" "patients" {
  name = "${var.name_prefix}-patients-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
        }
      }
    ]
  })
  
  tags = var.tags
}

resource "aws_iam_role" "providers" {
  name = "${var.name_prefix}-providers-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
        }
      }
    ]
  })
  
  tags = var.tags
}

resource "aws_iam_role" "supporters" {
  name = "${var.name_prefix}-supporters-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
        }
      }
    ]
  })
  
  tags = var.tags
}

resource "aws_iam_role" "admins" {
  name = "${var.name_prefix}-admins-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
        }
      }
    ]
  })
  
  tags = var.tags
}

# IAM Role for SMS
resource "aws_iam_role" "sms" {
  name = "${var.name_prefix}-cognito-sms-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cognito-idp.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
  
  tags = var.tags
}

resource "aws_iam_role_policy" "sms" {
  name = "${var.name_prefix}-cognito-sms-policy"
  role = aws_iam_role.sms.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}