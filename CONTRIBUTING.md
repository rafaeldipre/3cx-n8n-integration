# Contributing to 3CX n8n Integration

Thank you for your interest in contributing to the 3CX n8n Integration project! This document provides guidelines and information for contributors.

## 🎯 Project Overview

This project provides enterprise-grade n8n integration for 3CX Phone Systems, enabling advanced call control and monitoring capabilities. We welcome contributions that improve functionality, performance, documentation, and user experience.

## 🚀 Quick Start for Contributors

### Prerequisites
- Node.js 18.x or higher
- npm 8.x or higher
- Git
- TypeScript knowledge
- Familiarity with n8n and 3CX systems

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/3cx-n8n-integration.git
   cd 3cx-n8n-integration
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Start development mode**
   ```bash
   npm run dev
   ```

## 📋 Types of Contributions

We welcome various types of contributions:

### 🐛 Bug Reports
- Use the GitHub issue template
- Provide detailed reproduction steps
- Include environment information
- Add relevant logs and screenshots

### ✨ Feature Requests
- Check existing issues first
- Describe the use case clearly
- Explain the expected behavior
- Consider backward compatibility

### 🔧 Code Contributions
- Bug fixes
- New features
- Performance improvements
- Documentation updates
- Test improvements

### 📚 Documentation
- API documentation
- Usage examples
- Tutorials and guides
- Translation improvements

## 🛠️ Development Guidelines

### Code Standards

#### TypeScript
- Use strict TypeScript configuration
- Provide proper type definitions
- Avoid `any` types when possible
- Use interfaces for complex objects

```typescript
// Good
interface CallEvent {
  callId: string;
  eventType: 'started' | 'ended' | 'transferred';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Avoid
function handleCall(data: any): any {
  // ...
}
```

#### Code Style
- Use ESLint and Prettier configurations
- Follow existing naming conventions
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

```typescript
/**
 * Handles incoming call events from 3CX system
 * @param event - The call event to process
 * @param options - Processing options
 * @returns Promise resolving to processing result
 */
async function handleCallEvent(
  event: CallEvent,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  // Implementation
}
```

#### File Organization
```
src/
├── nodes/               # n8n node implementations
├── credentials/         # Authentication configurations
├── utils/              # Utility functions and classes
├── types/              # TypeScript type definitions
├── tests/              # Test files
└── docs/               # Documentation files
```

### Testing Requirements

#### Unit Tests
- Write tests for all new functions
- Aim for 80%+ code coverage
- Use Jest testing framework
- Mock external dependencies

```typescript
// Example test
describe('CallManager', () => {
  let callManager: CallManager;
  let mockApiClient: jest.Mocked<ThreeCXAPIClient>;

  beforeEach(() => {
    mockApiClient = createMockApiClient();
    callManager = new CallManager(mockApiClient);
  });

  it('should answer call successfully', async () => {
    const callId = 'test-call-123';
    mockApiClient.post.mockResolvedValue({ success: true });

    const result = await callManager.answerCall(callId);

    expect(result.success).toBe(true);
    expect(mockApiClient.post).toHaveBeenCalledWith('/calls/answer', {
      callId
    });
  });
});
```

#### Integration Tests
- Test complete workflows
- Use mock 3CX server
- Validate n8n node behavior
- Test error scenarios

### Git Workflow

#### Branch Naming
- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

#### Commit Messages
Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): brief description

Detailed explanation if needed

Closes #123
```

Examples:
```bash
feat(call-control): add DTMF collection with timeout
fix(auth): handle token refresh edge case
docs(readme): update installation instructions
test(integration): add webhook delivery tests
```

#### Pull Request Process
1. Create feature branch from `develop`
2. Make changes with tests
3. Update documentation
4. Run full test suite
5. Submit PR with description
6. Address review feedback
7. Squash commits before merge

## 🧪 Testing Your Changes

### Local Testing
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run production validation
npm run validate:production
```

### Testing with n8n
1. Build the project: `npm run build`
2. Link to local n8n: `npm link`
3. Start n8n: `n8n start`
4. Test nodes in n8n interface

### Testing with 3CX
For 3CX integration testing:
1. Set up test environment variables
2. Use mock server for CI/CD
3. Test with real 3CX for production validation

## 📖 Documentation Standards

### Code Documentation
- JSDoc for all public APIs
- Inline comments for complex logic
- README updates for new features
- API documentation updates

### Examples and Tutorials
- Provide working examples
- Include common use cases
- Explain configuration options
- Show error handling

## 🔍 Code Review Process

### Review Criteria
- **Functionality**: Does it work as intended?
- **Testing**: Are tests comprehensive?
- **Performance**: Any performance implications?
- **Security**: Are there security concerns?
- **Documentation**: Is documentation updated?
- **Compatibility**: Backward compatibility maintained?

### Review Timeline
- Initial review: 2-3 business days
- Follow-up reviews: 1-2 business days
- Final approval: Maintainer discretion

## 🚀 Release Process

### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped appropriately
- [ ] Production validation complete

## 📞 Getting Help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Discord**: Real-time chat with maintainers
- **Email**: security@your-company.com (security issues)

### Resources
- [n8n Node Development Guide](https://docs.n8n.io/integrations/creating-nodes/)
- [3CX Call Control API Documentation](https://www.3cx.com/docs/call-control-api/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

## 🏆 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Annual contributor appreciation
- Optional: LinkedIn recommendations

## 📋 Contributor License Agreement

By contributing to this project, you agree that:

1. **License**: Your contributions will be licensed under the MIT License
2. **Originality**: You have the right to submit the contribution
3. **No Warranty**: Contributions are provided "as is"
4. **Attribution**: You may be credited as a contributor

## 🔒 Security

### Reporting Security Issues
- **DO NOT** open public issues for security vulnerabilities
- Email: security@your-company.com
- Include detailed description and reproduction steps
- Allow reasonable time for response

### Security Guidelines
- Never commit credentials or secrets
- Validate all user inputs
- Use parameterized queries
- Follow OWASP guidelines
- Implement proper authentication

## 📝 Issue Templates

### Bug Report Template
```markdown
**Bug Description**
A clear description of the bug.

**Reproduction Steps**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen.

**Actual Behavior**
What actually happens.

**Environment**
- Node.js version:
- n8n version:
- 3CX version:
- Operating System:

**Additional Context**
Screenshots, logs, etc.
```

### Feature Request Template
```markdown
**Feature Description**
A clear description of the feature.

**Use Case**
Why is this feature needed?

**Proposed Solution**
How should this work?

**Alternatives Considered**
Other approaches considered.

**Additional Context**
Mockups, examples, etc.
```

## 🎉 First-Time Contributors

Welcome! Here are some good first issues:
- Documentation improvements
- Adding tests
- Fixing typos
- Small bug fixes
- Adding examples

Look for issues labeled:
- `good first issue`
- `help wanted`
- `documentation`
- `beginner friendly`

## 📊 Development Metrics

We track various metrics to ensure project health:
- Code coverage: >80%
- Test pass rate: 100%
- Build success rate: >95%
- Issue response time: <48 hours
- PR review time: <72 hours

## 🤝 Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inclusive experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Expected Behavior
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior
- Harassment of any kind
- Discriminatory language or actions
- Personal attacks or insults
- Public or private harassment
- Publishing others' private information

### Enforcement
Report unacceptable behavior to: conduct@your-company.com

## 📈 Roadmap Participation

We encourage community input on our roadmap:
- Quarterly planning sessions
- Feature voting
- Community feedback surveys
- User experience interviews

## 🔧 Tools and Automation

### Development Tools
- **IDE**: VS Code with recommended extensions
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier
- **Testing**: Jest with coverage
- **Documentation**: TypeDoc
- **Automation**: Husky for git hooks

### CI/CD Pipeline
- Automated testing on PR
- Security scanning
- Performance benchmarks
- Compatibility testing
- Automated releases

---

Thank you for contributing to 3CX n8n Integration! Your efforts help make this project better for everyone. 🚀

**Questions?** Feel free to reach out through any of our communication channels.