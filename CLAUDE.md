# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project is for developing a specialized n8n node for 3CX Call Control integration. The node will enable n8n to act as an intelligent call controller for 3CX version 20, providing both direct call control capabilities and call monitoring functionality.

## Target Architecture

### Core Components Structure
```
3cx-call-control/
├── credentials/
│   └── 3CXCallControlApi.credentials.ts    # Centralized authentication
├── nodes/
│   ├── 3CXCallReceiver/                    # Trigger - Direct control
│   ├── 3CXCallMonitor/                     # Trigger - Call information
│   ├── 3CXCallControl/                     # Actions - Call control
│   └── 3CXCallData/                        # Actions - Data retrieval
├── types/
│   ├── callTypes.ts                        # Control operation types
│   └── callInfoTypes.ts                    # Call information types
└── utils/
    ├── auth.ts                             # Authentication manager
    ├── callManager.ts                      # Direct call control
    ├── callInfoManager.ts                  # Call information handling
    └── apiClient.ts                        # 3CX API client
```

## Key Technical Requirements

### 3CX Integration Specifications
- **Target Version**: 3CX V20 exclusively (no backward compatibility)
- **API Endpoint**: `https://<FQDN:port>/callcontrol/`
- **License Required**: 3CX Enterprise with CFD (Call Flow Designer)
- **Authentication**: Bearer Token with 60-minute refresh cycle

### Dual Operation Modes
1. **Direct Control Mode**: Handle calls redirected to dedicated extension (e.g., 999)
2. **Monitoring Mode**: Monitor all system calls for data analysis and reporting
3. **Hybrid Mode**: Combination of both for advanced use cases

### Critical Implementation Features

#### Authentication Module
- Centralized credential management for Client ID and API Secret
- Automatic Bearer Token refresh handling
- Robust error handling for 401/403 responses
- Connection validation before operations

#### Call Control Operations (Direct Mode)
- Answer/Hangup calls
- Transfer to extension/external number
- Play audio files/prompts
- Collect DTMF input with timeout handling
- Park calls and conference management

#### Call Information Operations (Monitor Mode)
- Real-time call event monitoring
- Call history retrieval with advanced filtering
- Active calls listing
- Detailed call reports generation

## Development Commands

### Initial Setup
```bash
# Install n8n development dependencies
npm install -g n8n
npm install @n8n/n8n-nodes-base

# Create node package structure
mkdir 3cx-call-control && cd 3cx-call-control
npm init -y
npm install typescript @types/node
```

### Development Workflow
```bash
# Build the node
npm run build

# Link for local n8n testing
npm link
n8n start --tunnel

# Run tests
npm test

# Type checking
npx tsc --noEmit
```

## Key Implementation Patterns

### Error Handling Strategy
- 404: Invalid Call ID or terminated call
- 500: Internal 3CX error (implement retry with backoff)
- 504: Timeout handling for long operations
- Network errors: Automatic reconnection with exponential backoff

### Security Best Practices
- Never log credentials in any form
- Validate all user inputs thoroughly
- Sanitize Call IDs to prevent injection attacks
- Implement appropriate timeouts for all operations
- Use secure token storage mechanisms

### Performance Considerations
- Respect 3CX Call Control API rate limits
- Implement connection pooling for API requests
- Clean up unused resources automatically
- Detailed logging for troubleshooting
- Concurrent call handling for dedicated extension

## Core Interfaces

### Call Control Interface
```typescript
interface CallOperations {
  answerCall(callId: string): Promise<CallResponse>
  hangupCall(callId: string): Promise<CallResponse>
  transferCall(callId: string, target: string): Promise<CallResponse>
  playAudio(callId: string, audioPath: string): Promise<CallResponse>
  collectDTMF(callId: string, options: DTMFOptions): Promise<DTMFResponse>
}
```

### Call Information Interface
```typescript
interface CallInfo {
  callId: string
  fromNumber: string
  toNumber: string
  startTime: Date
  endTime?: Date
  duration?: number
  status: 'ringing' | 'answered' | 'missed' | 'ended'
  extension: string
  did: string
  direction: 'inbound' | 'outbound'
}
```

## Development Phases

### Phase 1: Core Foundation (3-4 weeks)
- Authentication system implementation
- Dedicated extension configuration
- Basic call receiver and monitor
- Essential operations: Answer, Hangup, Transfer
- Basic data operations: Call History, Active Calls

### Phase 2: Advanced Features (2-3 weeks)
- Audio playback functionality
- DTMF collection with timeout handling
- Call parking and hold features
- Advanced filtering for call history
- Automated call reporting
- Concurrent call management

### Phase 3: Production Ready (1-2 weeks)
- Real-time webhook subscriptions
- Comprehensive error handling
- Complete documentation with examples
- Workflow templates for hybrid use cases
- Production testing and validation

## Testing Strategy

### Unit Testing
- Mock 3CX API responses for all operations
- Test authentication token refresh cycles
- Validate input sanitization and error handling
- Test concurrent call scenarios

### Integration Testing
- Test with actual 3CX V20 development instance
- Validate dedicated extension call routing
- Test all call control operations end-to-end
- Verify call information monitoring accuracy

### Performance Testing
- API rate limit compliance testing
- Concurrent call handling validation
- Memory leak detection for long-running operations
- Timeout and reconnection testing

## Configuration Requirements

### 3CX Setup Prerequisites
- 3CX V20 with Enterprise license
- Call Flow Designer (CFD) enabled
- Dedicated extension configured (recommended: 999)
- Call Control API enabled and accessible
- Valid Client ID and API Secret credentials

### n8n Integration
- Webhook endpoints configured for call events
- Proper credential storage in n8n
- Workflow templates for common use cases
- Error handling workflows for failed operations

This project aims to create a production-ready n8n node that provides comprehensive 3CX integration with both direct call control and monitoring capabilities.