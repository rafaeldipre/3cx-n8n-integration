# 3CX n8n Integration - Complete Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Installation Guide](#installation-guide)
4. [Configuration](#configuration)
5. [Node Usage Examples](#node-usage-examples)
6. [Advanced Features](#advanced-features)
7. [Troubleshooting](#troubleshooting)
8. [API Reference](#api-reference)

## Introduction

The 3CX n8n Integration provides comprehensive call control and monitoring capabilities for 3CX Phone Systems version 20. This integration enables n8n workflows to act as intelligent call controllers with both direct call control and system-wide monitoring features.

### Key Features
- **Direct Call Control**: Answer, hangup, transfer, and manage calls
- **Call Monitoring**: Real-time call event monitoring and reporting
- **Audio Management**: Play prompts, collect DTMF input, and handle recordings
- **Queue Management**: Advanced call queue monitoring and agent management
- **IVR Integration**: Interactive Voice Response with dynamic routing
- **Error Recovery**: Comprehensive error handling with automatic recovery
- **Real-time Webhooks**: Instant notifications for call events
- **Concurrent Call Handling**: Optimized for high-volume environments

### Supported 3CX Versions
- **3CX V20 Enterprise** with Call Flow Designer (CFD) license
- **API Version**: Call Control API v2.0
- **Required Features**: Call Control API, Webhook Subscriptions

## Architecture Overview

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   n8n Workflow │────│  3CX n8n Node   │────│   3CX V20 PBX   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                       ┌───────┴───────┐
                       │   Components  │
                       ├───────────────┤
                       │ • Auth Manager│
                       │ • API Client  │
                       │ • Call Manager│
                       │ • Error Handler│
                       │ • Webhook Mgr │
                       └───────────────┘
```

### Component Layer Structure
1. **Authentication Layer**: Token management and credential handling
2. **API Client Layer**: HTTP communication with 3CX Call Control API
3. **Service Layer**: Business logic and call management operations
4. **n8n Node Layer**: User interface and workflow integration
5. **Type System**: TypeScript definitions and data models

## Installation Guide

### Prerequisites
- n8n instance (self-hosted or cloud)
- 3CX V20 Enterprise with Call Flow Designer license
- Node.js 18+ and npm
- Access to 3CX Call Control API endpoint

### Step 1: Install the Node Package
```bash
# Navigate to your n8n custom nodes directory
cd ~/.n8n/nodes

# Clone or download the 3CX n8n integration
git clone https://github.com/your-org/3cx-n8n-integration.git
cd 3cx-n8n-integration

# Install dependencies
npm install

# Build the nodes
npm run build

# Restart n8n to load the new nodes
pm2 restart n8n
```

### Step 2: Configure 3CX Call Control API
1. Enable Call Control API in 3CX Management Console
2. Create API credentials (Client ID and Secret)
3. Configure dedicated extension for call control (recommended: 999)
4. Set up Call Flow Designer rules to route calls to dedicated extension

### Step 3: Set up n8n Credentials
1. In n8n, go to **Settings** > **Credentials** > **Create New**
2. Select **3CX Call Control API**
3. Configure the following:
   - **Server URL**: `https://your-3cx-server:port`
   - **Client ID**: Your 3CX API Client ID
   - **Client Secret**: Your 3CX API Client Secret
   - **Extension**: Dedicated extension number (e.g., 999)

## Configuration

### 3CX Server Configuration

#### Call Flow Designer Setup
```xml
<!-- Example CFD rule to route specific calls to n8n -->
<CallFlow>
  <Rule name="n8n Control">
    <Condition>
      <DID equals="1234567890" />
    </Condition>
    <Action>
      <Transfer extension="999" />
    </Action>
  </Rule>
</CallFlow>
```

#### API Endpoint Configuration
- **Base URL**: `https://your-3cx-server:port/callcontrol/`
- **Authentication**: Bearer Token (60-minute refresh)
- **Rate Limits**: 100 requests/minute per client
- **Webhook URL**: `https://your-n8n-server/webhook/3cx-events`

### n8n Workflow Configuration

#### Environment Variables
```bash
# Optional: Set in n8n environment
N8N_3CX_DEFAULT_SERVER=https://your-3cx-server:port
N8N_3CX_DEFAULT_EXTENSION=999
N8N_3CX_WEBHOOK_SECRET=your-webhook-secret
N8N_3CX_LOG_LEVEL=info
```

## Node Usage Examples

### 1. 3CX Call Receiver (Trigger Node)

**Purpose**: Receives incoming calls on dedicated extension for direct control

```json
{
  "node": "3CX Call Receiver",
  "config": {
    "extension": "999",
    "callTypes": ["inbound", "internal"],
    "autoAnswer": true,
    "timeout": 30
  },
  "output": {
    "callId": "call-12345",
    "fromNumber": "+1234567890",
    "toNumber": "999",
    "direction": "inbound",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 2. 3CX Call Control (Action Node)

**Purpose**: Perform call control operations (answer, hangup, transfer, etc.)

#### Answer Call Example
```json
{
  "node": "3CX Call Control",
  "operation": "answerCall",
  "config": {
    "callId": "{{ $json.callId }}",
    "timeout": 10
  }
}
```

#### Transfer Call Example
```json
{
  "node": "3CX Call Control",
  "operation": "transferCall",
  "config": {
    "callId": "{{ $json.callId }}",
    "targetType": "extension",
    "target": "101",
    "transferType": "blind"
  }
}
```

#### Play Audio Example
```json
{
  "node": "3CX Call Control",
  "operation": "playAudio",
  "config": {
    "callId": "{{ $json.callId }}",
    "audioFile": "/prompts/welcome.wav",
    "repeat": 1,
    "interruptible": true
  }
}
```

#### Collect DTMF Example
```json
{
  "node": "3CX Call Control",
  "operation": "collectDTMF",
  "config": {
    "callId": "{{ $json.callId }}",
    "prompt": "/prompts/enter-choice.wav",
    "maxDigits": 1,
    "timeout": 10,
    "terminators": ["#"],
    "retries": 3
  }
}
```

### 3. 3CX Call Monitor (Trigger Node)

**Purpose**: Monitor all system calls for analytics and reporting

```json
{
  "node": "3CX Call Monitor",
  "config": {
    "eventTypes": ["call_started", "call_answered", "call_ended"],
    "filters": {
      "extensions": ["101", "102", "103"],
      "directions": ["inbound"],
      "minDuration": 5
    },
    "batchMode": false
  }
}
```

### 4. 3CX Call Data (Action Node)

**Purpose**: Retrieve call information and generate reports

#### Get Call History Example
```json
{
  "node": "3CX Call Data",
  "operation": "getCallHistory",
  "config": {
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z",
    "filters": {
      "extensions": ["*"],
      "directions": ["inbound", "outbound"],
      "minDuration": 10
    },
    "format": "json",
    "includeRecordings": true
  }
}
```

#### Get Active Calls Example
```json
{
  "node": "3CX Call Data",
  "operation": "getActiveCalls",
  "config": {
    "includeDetails": true,
    "filterBy": {
      "status": ["ringing", "answered"],
      "extensions": ["101", "102"]
    }
  }
}
```

## Advanced Features

### 1. Conference Management

```json
{
  "node": "3CX Call Control",
  "operation": "createConference",
  "config": {
    "conferenceId": "conf-12345",
    "participants": [
      { "callId": "call-1", "role": "moderator" },
      { "callId": "call-2", "role": "participant" }
    ],
    "settings": {
      "recordConference": true,
      "muteOnEntry": false,
      "announceName": true
    }
  }
}
```

### 2. Call Queue Management

```json
{
  "node": "3CX Call Data",
  "operation": "getQueueStats",
  "config": {
    "queueId": "queue-support",
    "metrics": [
      "waitingCalls",
      "averageWaitTime",
      "availableAgents",
      "callsAnswered",
      "callsAbandoned"
    ],
    "timeRange": "today"
  }
}
```

### 3. IVR Flow Implementation

```json
{
  "workflow": "Smart IVR",
  "nodes": [
    {
      "node": "3CX Call Receiver",
      "name": "Incoming Call"
    },
    {
      "node": "3CX Call Control",
      "name": "Play Welcome",
      "operation": "playAudio",
      "config": {
        "audioFile": "/prompts/welcome.wav"
      }
    },
    {
      "node": "3CX Call Control",
      "name": "Collect Choice",
      "operation": "collectDTMF",
      "config": {
        "prompt": "/prompts/main-menu.wav",
        "maxDigits": 1,
        "timeout": 10
      }
    },
    {
      "node": "Switch",
      "name": "Route Call",
      "config": {
        "mode": "expression",
        "output": "{{ parseInt($json.dtmfInput) }}"
      },
      "routing": {
        "1": "Transfer to Sales",
        "2": "Transfer to Support",
        "0": "Transfer to Operator"
      }
    }
  ]
}
```

### 4. Real-time Webhook Integration

```json
{
  "node": "3CX Call Monitor",
  "config": {
    "webhookMode": true,
    "webhookUrl": "https://your-app.com/webhook/call-events",
    "eventTypes": ["call_started", "call_ended"],
    "authentication": {
      "type": "hmac",
      "secret": "your-webhook-secret"
    },
    "delivery": {
      "retryAttempts": 3,
      "timeout": 30,
      "batching": {
        "enabled": true,
        "maxBatchSize": 50,
        "maxWaitTime": 10
      }
    }
  }
}
```

## Workflow Templates

### Template 1: Basic Call Handling
```json
{
  "name": "Basic Call Handler",
  "description": "Answer calls, play greeting, and transfer to appropriate department",
  "trigger": "3CX Call Receiver",
  "flow": [
    "Answer Call",
    "Play Greeting",
    "Collect Department Choice",
    "Route to Department",
    "End Call"
  ]
}
```

### Template 2: Call Analytics Dashboard
```json
{
  "name": "Call Analytics",
  "description": "Monitor calls and generate real-time analytics",
  "trigger": "3CX Call Monitor",
  "flow": [
    "Receive Call Event",
    "Process Event Data",
    "Update Database",
    "Send to Analytics Dashboard",
    "Generate Alerts if Needed"
  ]
}
```

### Template 3: Automated Customer Callback
```json
{
  "name": "Customer Callback",
  "description": "Handle overflow calls with callback scheduling",
  "trigger": "3CX Call Monitor",
  "flow": [
    "Detect Queue Overflow",
    "Collect Customer Number",
    "Schedule Callback",
    "Send Confirmation SMS",
    "Update CRM System"
  ]
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Authentication Errors
**Error**: `401 Unauthorized - Invalid credentials`

**Solutions**:
- Verify Client ID and Secret in credentials
- Check if API is enabled in 3CX Management Console
- Ensure correct server URL format
- Confirm 3CX Enterprise license with CFD

#### 2. Call Not Found Errors
**Error**: `404 Call not found`

**Solutions**:
- Verify call ID is current and valid
- Check if call has already ended
- Ensure extension is properly configured
- Confirm CFD rules are routing calls correctly

#### 3. Network Connectivity Issues
**Error**: `ECONNREFUSED` or timeout errors

**Solutions**:
- Verify network connectivity to 3CX server
- Check firewall rules for API port
- Confirm SSL certificate validity
- Test API endpoint with curl

#### 4. Rate Limiting
**Error**: `429 Too Many Requests`

**Solutions**:
- Implement request throttling in workflows
- Use batch operations where possible
- Monitor API usage patterns
- Contact 3CX support for rate limit increases

### Debug Mode

Enable debug logging:
```bash
# Set environment variable
N8N_3CX_LOG_LEVEL=debug

# Or configure in workflow
{
  "node": "3CX Call Control",
  "config": {
    "debugMode": true,
    "logLevel": "debug"
  }
}
```

### Health Check Workflow

```json
{
  "name": "3CX Health Check",
  "schedule": "*/5 * * * *",
  "nodes": [
    {
      "node": "3CX Call Data",
      "operation": "getSystemStatus"
    },
    {
      "node": "If",
      "condition": "{{ $json.status === 'healthy' }}"
    },
    {
      "node": "Send Alert",
      "onFalse": "Send notification if unhealthy"
    }
  ]
}
```

## API Reference

### Authentication
All API calls require Bearer token authentication:
```
Authorization: Bearer <token>
```

### Base Endpoints
- **Call Control**: `/callcontrol/calls`
- **Call Data**: `/callcontrol/data`
- **Webhooks**: `/callcontrol/webhooks`
- **System**: `/callcontrol/system`

### Error Codes
- `200`: Success
- `400`: Bad Request - Invalid parameters
- `401`: Unauthorized - Authentication failed
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `409`: Conflict - Resource conflict
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server error
- `503`: Service Unavailable - Service temporarily unavailable

### Rate Limits
- **Standard**: 100 requests per minute
- **Burst**: 20 requests per 10 seconds
- **Webhook Delivery**: 1000 events per minute

### Webhook Event Types
- `call_started`: New call initiated
- `call_answered`: Call answered by recipient
- `call_ended`: Call terminated
- `call_transferred`: Call transferred to another extension
- `call_parked`: Call put on hold/parked
- `dtmf_received`: DTMF digit received
- `recording_started`: Call recording started
- `queue_call_waiting`: Call waiting in queue
- `agent_login`: Agent logged into queue
- `system_error`: System error occurred

## Performance Optimization

### Best Practices
1. **Use batch operations** for multiple calls
2. **Implement caching** for frequently accessed data
3. **Use webhooks** instead of polling for real-time events
4. **Optimize DTMF collection** with appropriate timeouts
5. **Handle errors gracefully** with retry mechanisms
6. **Monitor API usage** to avoid rate limits

### Scaling Considerations
- Use multiple n8n instances for high availability
- Implement load balancing for webhook endpoints
- Use database clustering for call data storage
- Monitor memory usage for concurrent operations
- Implement circuit breakers for fault tolerance

## Support and Resources

### Documentation
- [3CX Call Control API Documentation](https://www.3cx.com/docs/call-control-api/)
- [n8n Custom Node Development](https://docs.n8n.io/integrations/creating-nodes/)

### Community
- [3CX Community Forums](https://www.3cx.com/community/)
- [n8n Community](https://community.n8n.io/)

### Professional Support
- Contact: support@your-organization.com
- Documentation: https://docs.your-organization.com/3cx-n8n
- Issue Tracker: https://github.com/your-org/3cx-n8n-integration/issues

---

**Version**: 2.0.0  
**Last Updated**: January 2024  
**License**: MIT  
**Compatibility**: 3CX V20, n8n 1.0+