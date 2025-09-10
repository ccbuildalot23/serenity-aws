# VPC Module - 3 AZ Multi-tier Architecture for HIPAA Compliance

# Main VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = var.enable_dns_hostnames
  enable_dns_support   = var.enable_dns_support
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
    Tier = "network"
    HIPAA = "compliant"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-igw"
  })
}

# Public Subnets (for ALB, NAT Gateways)
resource "aws_subnet" "public" {
  count = length(var.azs)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1)
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${substr(var.azs[count.index], -1, -1)}"
    Type = "Public"
    Tier = "presentation"
  })
}

# Private Subnets (for ECS Fargate)
resource "aws_subnet" "private" {
  count = length(var.azs)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 11)
  availability_zone = var.azs[count.index]
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${substr(var.azs[count.index], -1, -1)}"
    Type = "Private"
    Tier = "application"
  })
}

# Database Subnets (for RDS if needed, isolated)
resource "aws_subnet" "database" {
  count = length(var.azs)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 21)
  availability_zone = var.azs[count.index]
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-${substr(var.azs[count.index], -1, -1)}"
    Type = "Database"
    Tier = "data"
  })
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count = length(var.azs)
  
  domain = "vpc"
  depends_on = [aws_internet_gateway.main]
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-eip-${count.index + 1}"
  })
}

# NAT Gateways (one per AZ for high availability)
resource "aws_nat_gateway" "main" {
  count = length(var.azs)
  
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-${count.index + 1}"
  })
  
  depends_on = [aws_internet_gateway.main]
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rt-public"
  })
}

# Route Tables for Private Subnets (one per AZ)
resource "aws_route_table" "private" {
  count = length(var.azs)
  
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rt-private-${count.index + 1}"
  })
}

# Route Table for Database Subnets (no internet access)
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rt-database"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(var.azs)
  
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(var.azs)
  
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "database" {
  count = length(var.azs)
  
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# VPC Endpoints for AWS Services (HIPAA best practice)
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${data.aws_region.current.name}.s3"
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpce-s3"
  })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${data.aws_region.current.name}.dynamodb"
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpce-dynamodb"
  })
}

# VPC Endpoint for Secrets Manager
resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpce.id]
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpce-secrets"
  })
}

# Security Group for VPC Endpoints
resource "aws_security_group" "vpce" {
  name_prefix = "${var.name_prefix}-vpce-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for VPC endpoints"
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-sg-vpce"
  })
}

# VPC Flow Logs (HIPAA audit requirement)
resource "aws_flow_log" "vpc" {
  count = var.enable_flow_logs ? 1 : 0
  
  iam_role_arn    = aws_iam_role.flow_log[0].arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_log[0].arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-flow-log"
  })
}

# CloudWatch Log Group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_log" {
  count = var.enable_flow_logs ? 1 : 0
  
  name              = "/aws/vpc/flowlogs/${var.name_prefix}"
  retention_in_days = 30
  kms_key_id        = var.kms_key_id
  
  tags = var.tags
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0
  
  name_prefix = "${var.name_prefix}-flow-log-"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })
  
  tags = var.tags
}

resource "aws_iam_role_policy" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0
  
  name_prefix = "${var.name_prefix}-flow-log-"
  role        = aws_iam_role.flow_log[0].id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# Data sources
data "aws_region" "current" {}