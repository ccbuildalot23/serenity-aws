# Serenity AWS - Development Makefile
# Provides convenient shortcuts for common development tasks

.PHONY: help install build test lint typecheck dev clean tf-validate tf-plan tf-apply

# Default target
help:
	@echo "🚀 Serenity AWS Development Commands"
	@echo "=================================="
	@echo ""
	@echo "Setup & Installation:"
	@echo "  install        Install all dependencies"
	@echo "  build          Build all applications"
	@echo ""
	@echo "Development:"
	@echo "  dev            Start development servers"
	@echo "  test           Run all tests"
	@echo "  test-api       Run API tests only"
	@echo "  test-web       Run web-phase2 tests only"
	@echo "  lint           Run linting for all workspaces"
	@echo "  typecheck      Run TypeScript type checking"
	@echo ""
	@echo "Infrastructure:"
	@echo "  tf-validate    Validate Terraform configuration"
	@echo "  tf-plan        Plan Terraform changes"
	@echo "  tf-apply       Apply Terraform changes"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean          Clean build artifacts"
	@echo ""

# Setup & Installation
install:
	@echo "📦 Installing dependencies..."
	pnpm install -w

build:
	@echo "🔨 Building all applications..."
	pnpm run build

# Development
dev:
	@echo "🚀 Starting development servers..."
	pnpm run dev

test:
	@echo "🧪 Running all tests..."
	pnpm run test

test-api:
	@echo "🧪 Running API tests..."
	cd apps/api && npm run test:unit

test-web:
	@echo "🧪 Running web-phase2 tests..."
	cd apps/web-phase2 && npm run test:unit

lint:
	@echo "🔍 Running linting..."
	pnpm run lint

typecheck:
	@echo "📝 Running TypeScript type checking..."
	pnpm run typecheck

# Infrastructure
tf-validate:
	@echo "🏗️  Validating Terraform configuration..."
	@if [ ! -d "terraform" ]; then \
		echo "❌ terraform/ directory not found"; \
		exit 1; \
	fi
	cd terraform && terraform init -backend=false
	cd terraform && terraform validate
	@echo "✅ Terraform validation completed successfully"

tf-plan:
	@echo "📋 Planning Terraform changes..."
	@if [ ! -d "terraform" ]; then \
		echo "❌ terraform/ directory not found"; \
		exit 1; \
	fi
	cd terraform && terraform init
	cd terraform && terraform plan

tf-apply:
	@echo "🚀 Applying Terraform changes..."
	@if [ ! -d "terraform" ]; then \
		echo "❌ terraform/ directory not found"; \
		exit 1; \
	fi
	cd terraform && terraform init
	cd terraform && terraform apply

# Cleanup
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf apps/*/dist apps/*/.next apps/*/build
	rm -rf node_modules */node_modules */*/node_modules
	rm -rf coverage */coverage */*/coverage
	@echo "✅ Cleanup completed"

# Development shortcuts
api:
	@echo "🚀 Starting API server..."
	cd apps/api && npm run dev

web:
	@echo "🚀 Starting web-phase2 server..."
	cd apps/web-phase2 && npm run dev

# Test shortcuts with coverage
test-cov:
	@echo "🧪 Running tests with coverage..."
	pnpm run test:unit

# CI commands (used by GitHub Actions)
ci-test:
	@echo "🚀 Running CI test suite..."
	pnpm run lint
	pnpm run typecheck
	pnpm run test:unit

# Database operations
db-migrate:
	@echo "📊 Running database migrations..."
	cd packages/database && npx prisma migrate deploy

db-seed:
	@echo "🌱 Seeding database..."
	cd packages/database && npx prisma db seed

db-studio:
	@echo "🔍 Opening Prisma Studio..."
	cd packages/database && npx prisma studio

# Production build verification
build-verify:
	@echo "🔍 Verifying production builds..."
	pnpm run build
	@echo "📦 Build sizes:"
	@du -sh apps/*/dist apps/*/.next 2>/dev/null || echo "No build directories found"