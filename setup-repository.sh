#!/bin/bash

# 3CX n8n Integration - Repository Setup Script
# This script creates and configures the GitHub repository

set -e

# Configuration
REPO_OWNER="rafaeldipre"
REPO_NAME="3cx-n8n-integration"
REPO_DESCRIPTION="Enterprise-grade n8n integration for 3CX Phone Systems with advanced call control and monitoring capabilities"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if GitHub CLI is installed and authenticated
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is not installed. Please install it first."
        exit 1
    fi
    
    if ! gh auth status &> /dev/null; then
        print_error "GitHub CLI is not authenticated. Please run 'gh auth login' first."
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install it first."
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Create the repository
create_repository() {
    print_step "Creating GitHub repository..."
    
    if gh repo view "${REPO_OWNER}/${REPO_NAME}" &> /dev/null; then
        print_warning "Repository ${REPO_OWNER}/${REPO_NAME} already exists"
        read -p "Do you want to continue with existing repository? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Aborted by user"
            exit 1
        fi
    else
        gh repo create "${REPO_OWNER}/${REPO_NAME}" \
            --public \
            --description "$REPO_DESCRIPTION" \
            --clone=false
        print_status "Repository created successfully"
    fi
}

# Configure repository settings
configure_repository() {
    print_step "Configuring repository settings..."
    
    gh repo edit "${REPO_OWNER}/${REPO_NAME}" \
        --enable-issues \
        --enable-wiki \
        --enable-projects \
        --visibility public \
        --accept-visibility-change-consequences
    
    print_status "Repository configured successfully"
}

# Initialize Git and setup remote
setup_git() {
    print_step "Setting up Git repository..."
    
    if [ ! -d ".git" ]; then
        git init
        print_status "Git repository initialized"
    fi
    
    git branch -M main
    
    # Add remote if not exists
    if ! git remote get-url origin &> /dev/null; then
        git remote add origin "https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
        print_status "Remote origin added"
    fi
}

# Add and commit files
commit_files() {
    print_step "Adding and committing files..."
    
    git add .
    
    if git diff --staged --quiet; then
        print_warning "No changes to commit"
        return 0
    fi
    
    cat << EOF | git commit -F -
feat: initial commit with complete 3CX n8n integration

🚀 Enterprise-grade n8n integration for 3CX Phone Systems

Features implemented:
- ✅ Phase 1: Core Foundation (10 characteristics)  
- ✅ Phase 2: Advanced Features (10 characteristics)
- ✅ Phase 3: Production Ready (6 characteristics)

Architecture:
- 5-layer system architecture with TypeScript
- Real-time webhook subscriptions with delivery guarantees
- Comprehensive error handling and recovery mechanisms
- Production testing and validation suite
- Docker configuration with full production stack
- CI/CD pipeline with automated testing and deployment

Components:
- 4 n8n nodes (Call Receiver, Monitor, Control, Data)
- 15+ utility managers and services
- Complete documentation and workflow templates
- Enterprise-grade security and performance optimization

Ready for production deployment with high-availability capabilities.

Co-authored-by: Claude <noreply@anthropic.com>
EOF
    
    print_status "Files committed successfully"
}

# Push to repository
push_to_repository() {
    print_step "Pushing to repository..."
    
    git push -u origin main
    print_status "Pushed to repository successfully"
}

# Configure secrets (interactive)
configure_secrets() {
    print_step "Configuring repository secrets..."
    
    print_warning "You'll need to configure secrets manually for full CI/CD functionality:"
    echo
    echo "Required secrets:"
    echo "  - CODECOV_TOKEN: For code coverage reporting"
    echo "  - NPM_TOKEN: For NPM package publishing"
    echo "  - DOCKERHUB_USERNAME: For Docker image publishing"
    echo "  - DOCKERHUB_TOKEN: For Docker Hub authentication"
    echo "  - TEST_3CX_URL: For integration testing"
    echo "  - TEST_3CX_CLIENT_ID: For integration testing"
    echo "  - TEST_3CX_CLIENT_SECRET: For integration testing"
    echo "  - SLACK_WEBHOOK: For notifications (optional)"
    echo "  - DISCORD_WEBHOOK: For notifications (optional)"
    echo
    
    read -p "Do you want to configure secrets now? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        configure_secrets_interactive
    else
        print_warning "Secrets not configured. Configure them later in GitHub Settings > Secrets"
    fi
}

# Interactive secret configuration
configure_secrets_interactive() {
    print_step "Interactive secret configuration..."
    
    secrets=(
        "CODECOV_TOKEN:Code coverage token from codecov.io"
        "NPM_TOKEN:NPM automation token for publishing"
        "DOCKERHUB_USERNAME:Docker Hub username"
        "DOCKERHUB_TOKEN:Docker Hub access token"
        "TEST_3CX_URL:Test 3CX server URL (e.g., https://test-3cx.com:5001)"
        "TEST_3CX_CLIENT_ID:Test 3CX API client ID"
        "TEST_3CX_CLIENT_SECRET:Test 3CX API client secret"
        "SLACK_WEBHOOK:Slack webhook URL (optional)"
        "DISCORD_WEBHOOK:Discord webhook URL (optional)"
    )
    
    for secret_info in "${secrets[@]}"; do
        IFS=':' read -r secret_name secret_desc <<< "$secret_info"
        echo
        read -p "Enter $secret_name ($secret_desc): " -s secret_value
        echo
        
        if [ ! -z "$secret_value" ]; then
            if gh secret set "$secret_name" --body "$secret_value" --repo "${REPO_OWNER}/${REPO_NAME}"; then
                print_status "Secret $secret_name configured"
            else
                print_error "Failed to configure secret $secret_name"
            fi
        else
            print_warning "Skipping $secret_name"
        fi
    done
}

# Create initial release
create_release() {
    print_step "Creating initial release..."
    
    read -p "Do you want to create an initial release (v2.0.0)? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh release create v2.0.0 \
            --repo "${REPO_OWNER}/${REPO_NAME}" \
            --title "🚀 v2.0.0 - Initial Release" \
            --notes "## 🎉 Initial Release - 3CX n8n Integration

### ✨ Features
- **Complete 3CX Integration**: Enterprise-grade call control and monitoring
- **26 Advanced Features**: Across 3 development phases  
- **Production Ready**: Full CI/CD pipeline and Docker configuration
- **Comprehensive Documentation**: Installation guides and API reference

### 🏗️ Architecture
- 5-layer system architecture with TypeScript
- Real-time webhook subscriptions with delivery guarantees
- Advanced error recovery mechanisms with circuit breakers
- Production validation suite with comprehensive testing

### 📦 Installation
\`\`\`bash
npm install n8n-nodes-3cx-call-control
\`\`\`

### 🐳 Docker Deployment
\`\`\`bash
docker-compose up -d
\`\`\`

### 📚 Documentation
- [Installation Guide](./howto.md)
- [Complete Documentation](./docs/3CX-n8n-Integration-Guide.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Workflow Templates](./templates/workflow-templates.json)

### 🎯 Compatibility
- **n8n**: >=1.0.0
- **Node.js**: >=18.0.0  
- **3CX**: V20 Enterprise Edition

### 🔧 Components
- 4 specialized n8n nodes
- 15+ utility managers and services
- Production-ready Docker configuration
- CI/CD pipeline with 7 validation stages

**Ready for enterprise production deployment!** 🚀"
        
        print_status "Release v2.0.0 created successfully"
    else
        print_warning "Skipping release creation"
    fi
}

# Setup repository topics/tags
setup_topics() {
    print_step "Setting up repository topics..."
    
    topics=(
        "n8n"
        "3cx"
        "pbx"
        "voip"
        "telephony"
        "call-control"
        "workflow-automation"
        "nodejs"
        "typescript"
        "enterprise"
    )
    
    # Note: GitHub CLI doesn't have a direct command for topics
    # They need to be set via web interface or API
    print_warning "Repository topics need to be set manually in GitHub web interface:"
    printf '%s, ' "${topics[@]}"
    echo
}

# Display success message
show_success() {
    echo
    print_status "🎉 Repository setup completed successfully!"
    echo
    echo "Repository: https://github.com/${REPO_OWNER}/${REPO_NAME}"
    echo
    echo "Next steps:"
    echo "1. Visit the repository and configure any remaining secrets"
    echo "2. Set up repository topics in the web interface"
    echo "3. Configure branch protection rules if needed"
    echo "4. Review and customize CI/CD pipeline settings"
    echo "5. Update README.md with your specific organization details"
    echo "6. Start contributing and invite collaborators!"
    echo
    print_status "Happy coding! 🚀"
}

# Main execution
main() {
    print_status "Starting 3CX n8n Integration repository setup..."
    echo
    
    # Prompt for repository details
    read -p "Repository owner/organization (default: your-org): " input_owner
    REPO_OWNER=${input_owner:-$REPO_OWNER}
    
    read -p "Repository name (default: 3cx-n8n-integration): " input_name
    REPO_NAME=${input_name:-$REPO_NAME}
    
    echo
    print_status "Setting up repository: ${REPO_OWNER}/${REPO_NAME}"
    echo
    
    # Execute setup steps
    check_prerequisites
    create_repository
    configure_repository
    setup_git
    commit_files
    push_to_repository
    configure_secrets
    create_release
    setup_topics
    show_success
}

# Run the script
main "$@"