# Terraform Installation Guide

This guide provides cross-platform installation instructions for Terraform, ensuring version consistency across development and CI environments.

## Installation by Platform

### macOS
```bash
# Using Homebrew (recommended)
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verify installation
terraform version
```

### Ubuntu/Debian Linux
```bash
# Add HashiCorp GPG key
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -

# Add HashiCorp repository
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"

# Update package index and install
sudo apt-get update
sudo apt-get install terraform

# Verify installation
terraform version
```

### Windows
```bash
# Using Chocolatey (recommended)
choco install terraform -y

# Note: You may need to restart your terminal or system after installation
# Verify installation (in new terminal)
terraform version
```

**Important Windows Notes:**
- After installation, restart your terminal/PowerShell session
- If you encounter PATH issues, restart your computer
- Alternative: Download binary manually from [terraform.io](https://terraform.io/downloads.html) and add to PATH

### Alternative: Manual Installation (All Platforms)
1. Visit [https://www.terraform.io/downloads.html](https://www.terraform.io/downloads.html)
2. Download the appropriate binary for your platform
3. Extract the binary to a directory in your PATH
4. Verify with `terraform version`

## Version Requirements

- **Minimum Version**: Terraform 1.9.x
- **Recommended**: Latest stable version
- **CI Environment**: Automatically managed via `hashicorp/setup-terraform@v3`

## CI Integration

Terraform is automatically installed in GitHub Actions using:

```yaml
- name: Setup Terraform
  uses: hashicorp/setup-terraform@v3
  with:
    terraform_wrapper: false
```

## Local Development Setup

After installation, configure your environment:

```bash
# Navigate to terraform directory
cd terraform/

# Initialize Terraform (downloads providers)
terraform init

# Validate configuration
terraform validate

# Plan changes (dry run)
terraform plan

# Apply changes (with approval)
terraform apply
```

## Troubleshooting

### Common Issues

1. **Command not found**: Restart terminal or add to PATH manually
2. **Permission denied**: Ensure executable permissions on binary
3. **Version conflicts**: Remove old versions before installing new ones

### Windows-Specific Issues

1. **PATH not updated**: Restart computer after installation
2. **Execution policy**: Run `Set-ExecutionPolicy RemoteSigned` in PowerShell as admin
3. **Chocolatey not found**: Install Chocolatey first from [chocolatey.org](https://chocolatey.org)

### Linux-Specific Issues

1. **Repository not found**: Ensure correct distribution codename in repository URL
2. **GPG key issues**: Re-run the GPG key addition command
3. **Permission denied**: Use sudo for system-wide installation

## Validation

Verify your installation works correctly:

```bash
# Check version
terraform version

# Validate a configuration
cd terraform/
terraform init -backend=false
terraform validate

# Expected output: "Success! The configuration is valid."
```

## Security Notes

- Only download Terraform from official HashiCorp sources
- Verify checksums when downloading manually
- Keep Terraform version up to date for security patches
- Use version pinning in production environments

---

*This document is maintained as part of the Serenity AWS infrastructure setup process.*