# 3CX n8n Integration - Installation and Usage Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [System Requirements](#system-requirements)
3. [Installation Steps](#installation-steps)
4. [3CX Configuration](#3cx-configuration)
5. [n8n Setup](#n8n-setup)
6. [Basic Usage Examples](#basic-usage-examples)
7. [Advanced Configuration](#advanced-configuration)
8. [Troubleshooting](#troubleshooting)
9. [Production Deployment](#production-deployment)

---

## Quick Start

Get up and running with 3CX n8n integration in 15 minutes:

### Prerequisites Check
```bash
# Check your environment
node --version  # Should be 18.x or higher
npm --version   # Should be 8.x or higher
n8n --version   # Should be 1.0.x or higher
```

### Installation Command
```bash
# One-line installation
cd ~/.n8n/nodes && git clone https://github.com/your-org/3cx-n8n-integration.git && cd 3cx-n8n-integration && npm install && npm run build && echo "✅ Installation complete! Restart n8n to use the new nodes."
```

---

## System Requirements

### 3CX Requirements
- **3CX Version**: V20 Enterprise Edition
- **License**: Enterprise with Call Flow Designer (CFD)
- **API Access**: Call Control API enabled
- **Network**: HTTPS access to 3CX server
- **Extensions**: Dedicated extension for n8n (recommended: 999)

### n8n Requirements
- **Version**: 1.0.0 or higher
- **Environment**: Self-hosted or cloud instance
- **Node.js**: 18.x or higher
- **Resources**: Minimum 2GB RAM, 10GB storage

### Network Requirements
- **Inbound**: Webhook endpoints accessible from 3CX
- **Outbound**: HTTPS access to 3CX Call Control API
- **Ports**: 3CX API port (default: 5001) accessible

---

## Installation Steps

### Step 1: Download and Install

#### Option A: Git Clone (Recommended)
```bash
# Navigate to n8n custom nodes directory
cd ~/.n8n/nodes

# Clone the repository
git clone https://github.com/your-org/3cx-n8n-integration.git
cd 3cx-n8n-integration

# Install dependencies
npm install

# Build the nodes
npm run build
```

#### Option B: NPM Package (If Published)
```bash
# Install from npm
npm install -g n8n-nodes-3cx-call-control

# Link to n8n
n8n-link-nodes n8n-nodes-3cx-call-control
```

#### Option C: Manual Installation
```bash
# Download and extract
wget https://github.com/your-org/3cx-n8n-integration/archive/main.zip
unzip main.zip -d ~/.n8n/nodes/
cd ~/.n8n/nodes/3cx-n8n-integration-main

# Install and build
npm install && npm run build
```

### Step 2: Verify Installation
```bash
# Check if nodes are available
ls ~/.n8n/nodes/3cx-n8n-integration/dist/nodes/

# Restart n8n
pm2 restart n8n
# OR if running manually
# Ctrl+C and run: n8n start
```

### Step 3: Verify in n8n Interface
1. Open n8n in your browser
2. Create a new workflow
3. Search for "3CX" in the node panel
4. You should see: `3CX Call Receiver`, `3CX Call Control`, `3CX Call Monitor`, `3CX Call Data`

---

## 3CX Configuration

### Step 1: Enable Call Control API

1. **Access 3CX Management Console**
   ```
   https://your-3cx-server:5015
   ```

2. **Navigate to Settings > General**
   - Enable "Call Control API"
   - Note the API endpoint URL
   - Set API port (default: 5001)

3. **Create API Credentials**
   - Go to **Settings > Security > API Access**
   - Click "Add API Client"
   - Enter details:
     ```
     Name: n8n-integration
     Description: n8n Call Control Integration
     Permissions: Call Control, Call Information, Webhooks
     ```
   - Save and note the **Client ID** and **Client Secret**

### Step 2: Configure Dedicated Extension

1. **Create Extension for n8n**
   - Go to **Extensions > Add Extension**
   - Extension Number: `999` (recommended)
   - Name: `n8n Call Control`
   - Type: `Generic SIP Extension`
   - Enable: `Allow incoming calls`

2. **Configure Extension Settings**
   ```
   Extension: 999
   Authentication ID: n8n-control
   Password: [strong password]
   Outbound Caller ID: [your main number]
   ```

### Step 3: Set Up Call Flow Designer

1. **Create CFD Rule for n8n**
   ```xml
   <CallFlow name="n8n Control">
     <Rule name="Route to n8n">
       <Condition>
         <DID equals="YOUR_DID_NUMBER" />
       </Condition>
       <Action>
         <Transfer extension="999" />
       </Action>
     </Rule>
   </CallFlow>
   ```

2. **Apply the Rule**
   - Save and publish the CFD
   - Test with a call to your DID

### Step 4: Webhook Configuration (Optional)

1. **Enable Webhook Support**
   - Go to **Settings > Integration > Webhooks**
   - Enable webhook functionality
   - Set webhook timeout: `30 seconds`
   - Set maximum retries: `3`

---

## n8n Setup

### Step 1: Create 3CX Credentials

1. **In n8n, go to Settings > Credentials**
2. **Click "Create New Credential"**
3. **Select "3CX Call Control API"**
4. **Enter your details:**
   ```
   Credential Name: 3CX Production Server
   Server URL: https://your-3cx-server:5001
   Client ID: [from Step 1 above]
   Client Secret: [from Step 1 above]
   Extension: 999
   ```
5. **Test Connection** - Should show "✅ Connection successful"
6. **Save Credential**

### Step 2: Test with Simple Workflow

Create this test workflow:

```json
{
  "name": "3CX Test Workflow",
  "nodes": [
    {
      "parameters": {
        "extension": "999",
        "autoAnswer": true,
        "timeout": 30
      },
      "type": "3CXCallReceiver",
      "position": [240, 300],
      "id": "call_receiver"
    },
    {
      "parameters": {
        "operation": "playAudio",
        "callId": "={{ $json.callId }}",
        "audioFile": "/system/default/welcome.wav"
      },
      "type": "3CXCallControl",
      "position": [460, 300],
      "id": "play_welcome"
    },
    {
      "parameters": {
        "operation": "hangupCall",
        "callId": "={{ $json.callId }}"
      },
      "type": "3CXCallControl",
      "position": [680, 300],
      "id": "hangup_call"
    }
  ],
  "connections": {
    "call_receiver": {
      "main": [["play_welcome"]]
    },
    "play_welcome": {
      "main": [["hangup_call"]]
    }
  }
}
```

### Step 3: Test the Integration

1. **Activate the workflow**
2. **Call your DID number**
3. **Expected behavior:**
   - Call should be answered automatically
   - Welcome message should play
   - Call should hang up
4. **Check workflow execution** - Should show successful execution

---

## Basic Usage Examples

### Example 1: Simple Call Handler

**Use Case**: Answer calls, play greeting, collect input, route to department

```json
{
  "name": "Department Router",
  "nodes": [
    {
      "parameters": {
        "extension": "999",
        "autoAnswer": true
      },
      "type": "3CXCallReceiver",
      "id": "incoming_call"
    },
    {
      "parameters": {
        "operation": "playAudio",
        "callId": "={{ $json.callId }}",
        "audioFile": "/prompts/welcome.wav"
      },
      "type": "3CXCallControl",
      "id": "play_greeting"
    },
    {
      "parameters": {
        "operation": "collectDTMF",
        "callId": "={{ $json.callId }}",
        "prompt": "/prompts/press-1-sales-2-support.wav",
        "maxDigits": 1,
        "timeout": 10
      },
      "type": "3CXCallControl",
      "id": "collect_choice"
    },
    {
      "parameters": {
        "mode": "expression",
        "output": "={{ $json.dtmfInput }}"
      },
      "type": "Switch",
      "id": "route_call"
    },
    {
      "parameters": {
        "operation": "transferCall",
        "callId": "={{ $node['incoming_call'].json['callId'] }}",
        "targetType": "extension",
        "target": "101"
      },
      "type": "3CXCallControl",
      "id": "transfer_to_sales"
    }
  ]
}
```

### Example 2: Call Monitoring Dashboard

**Use Case**: Monitor all calls and send alerts for long wait times

```json
{
  "name": "Call Monitor",
  "nodes": [
    {
      "parameters": {
        "eventTypes": ["call_started", "call_ended"],
        "filters": {
          "directions": ["inbound"]
        }
      },
      "type": "3CXCallMonitor",
      "id": "monitor_calls"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.eventType }}",
              "value2": "call_started"
            }
          ]
        }
      },
      "type": "If",
      "id": "check_call_started"
    },
    {
      "parameters": {
        "amount": 300,
        "unit": "seconds"
      },
      "type": "Wait",
      "id": "wait_5_minutes"
    },
    {
      "parameters": {
        "operation": "getCallStatus",
        "callId": "={{ $json.callId }}"
      },
      "type": "3CXCallData",
      "id": "check_call_status"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.status }}",
              "value2": "ringing"
            }
          ]
        }
      },
      "type": "If",
      "id": "check_still_ringing"
    },
    {
      "parameters": {
        "channel": "#alerts",
        "text": "⚠️ Call {{ $node['monitor_calls'].json['callId'] }} has been ringing for 5+ minutes"
      },
      "type": "Slack",
      "id": "send_alert"
    }
  ]
}
```

### Example 3: Customer Callback System

**Use Case**: Offer callback when queues are busy

```json
{
  "name": "Smart Callback",
  "nodes": [
    {
      "parameters": {
        "eventTypes": ["queue_call_waiting"]
      },
      "type": "3CXCallMonitor",
      "id": "queue_monitor"
    },
    {
      "parameters": {
        "operation": "getQueueStats",
        "queueId": "={{ $json.data.queueId }}"
      },
      "type": "3CXCallData",
      "id": "get_queue_stats"
    },
    {
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.averageWaitTime }}",
              "operation": "larger",
              "value2": 300
            }
          ]
        }
      },
      "type": "If",
      "id": "check_long_wait"
    },
    {
      "parameters": {
        "operation": "playAudio",
        "callId": "={{ $node['queue_monitor'].json['callId'] }}",
        "audioFile": "/prompts/callback-offer.wav"
      },
      "type": "3CXCallControl",
      "id": "offer_callback"
    },
    {
      "parameters": {
        "operation": "collectDTMF",
        "callId": "={{ $node['queue_monitor'].json['callId'] }}",
        "prompt": "/prompts/press-1-for-callback.wav",
        "maxDigits": 1,
        "timeout": 10
      },
      "type": "3CXCallControl",
      "id": "collect_callback_choice"
    }
  ]
}
```

---

## Advanced Configuration

### Environment Variables

Set these in your n8n environment:

```bash
# 3CX Configuration
N8N_3CX_DEFAULT_SERVER=https://your-3cx-server:5001
N8N_3CX_DEFAULT_EXTENSION=999
N8N_3CX_LOG_LEVEL=info
N8N_3CX_TIMEOUT=30000
N8N_3CX_RETRY_ATTEMPTS=3

# Webhook Configuration
N8N_3CX_WEBHOOK_SECRET=your-webhook-secret-key
N8N_3CX_WEBHOOK_TIMEOUT=30000

# Performance Tuning
N8N_3CX_MAX_CONCURRENT_CALLS=10
N8N_3CX_CONNECTION_POOL_SIZE=5
N8N_3CX_REQUEST_TIMEOUT=15000
```

### Audio File Configuration

1. **Upload audio files to 3CX**:
   ```bash
   # Connect to 3CX server
   scp welcome.wav admin@3cx-server:/var/lib/3cxpbx/Bin/nginx/html/prompts/
   ```

2. **Common audio file paths**:
   ```
   /prompts/welcome.wav          - Welcome message
   /prompts/goodbye.wav          - Goodbye message
   /prompts/menu-main.wav        - Main menu options
   /prompts/hold-music.wav       - Hold music
   /system/default/beep.wav      - System beep
   ```

3. **Audio file requirements**:
   - Format: WAV, MP3, or GSM
   - Sample Rate: 8kHz or 16kHz
   - Channels: Mono
   - Bitrate: 64kbps or higher

### Database Integration

For advanced workflows, integrate with databases:

```json
{
  "name": "CRM Integration",
  "nodes": [
    {
      "type": "3CXCallReceiver",
      "id": "incoming_call"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT * FROM customers WHERE phone = '{{ $json.fromNumber }}'"
      },
      "type": "MySQL",
      "id": "lookup_customer"
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.length > 0 }}",
              "value2": true
            }
          ]
        }
      },
      "type": "If",
      "id": "check_existing_customer"
    }
  ]
}
```

### Custom Error Handling

```json
{
  "name": "Robust Call Handler",
  "settings": {
    "errorWorkflow": {
      "workflowId": "error-handler-workflow"
    }
  },
  "nodes": [
    {
      "type": "3CXCallReceiver",
      "id": "incoming_call",
      "onError": "continueRegularOutput"
    },
    {
      "type": "3CXCallControl",
      "parameters": {
        "operation": "answerCall",
        "callId": "={{ $json.callId }}",
        "timeout": 10
      },
      "id": "answer_call",
      "continueOnFail": true
    },
    {
      "type": "If",
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.success === false }}",
              "value2": true
            }
          ]
        }
      },
      "id": "check_answer_failed"
    },
    {
      "type": "3CXCallControl",
      "parameters": {
        "operation": "hangupCall",
        "callId": "={{ $node['incoming_call'].json['callId'] }}"
      },
      "id": "fallback_hangup"
    }
  ]
}
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "Connection Failed" Error

**Symptoms**: Cannot connect to 3CX server
```
Error: ECONNREFUSED connect to your-3cx-server:5001
```

**Solutions**:
```bash
# Check network connectivity
ping your-3cx-server

# Check port accessibility
telnet your-3cx-server 5001

# Verify SSL certificate
openssl s_client -connect your-3cx-server:5001

# Check firewall rules
sudo ufw status
```

#### 2. "Authentication Failed" Error

**Symptoms**: Invalid credentials error
```
Error: 401 Unauthorized - Authentication failed
```

**Solutions**:
1. **Verify credentials in n8n**:
   - Check Client ID and Secret
   - Ensure no extra spaces
   - Confirm server URL format

2. **Check 3CX API settings**:
   - Verify API is enabled
   - Check client permissions
   - Regenerate credentials if needed

3. **Test with curl**:
   ```bash
   curl -X POST https://your-3cx-server:5001/auth/token \
     -H "Content-Type: application/json" \
     -d '{"client_id":"your-client-id","client_secret":"your-secret"}'
   ```

#### 3. "Call Not Found" Error

**Symptoms**: Operations fail on valid calls
```
Error: 404 Call not found - Call ID invalid
```

**Solutions**:
1. **Check call ID format**:
   ```javascript
   // Correct format
   callId: "call-12345-67890"
   
   // Incorrect format
   callId: "12345" // Missing prefix
   ```

2. **Verify call timing**:
   - Ensure call is still active
   - Check for race conditions
   - Add delays if needed

3. **Debug call flow**:
   ```json
   {
     "type": "Code",
     "parameters": {
       "jsCode": "console.log('Call ID:', items[0].json.callId); return items;"
     }
   }
   ```

#### 4. "Extension Not Configured" Error

**Symptoms**: Extension-related operations fail
```
Error: Extension 999 not found or not configured
```

**Solutions**:
1. **Verify extension exists in 3CX**
2. **Check extension registration**:
   ```bash
   # In 3CX console
   list extensions
   show extension 999
   ```
3. **Confirm CFD routing**
4. **Test extension manually**

#### 5. Audio Playback Issues

**Symptoms**: Audio doesn't play or distorted
```
Error: Audio file not found or invalid format
```

**Solutions**:
1. **Check file path**:
   ```bash
   # Verify file exists on 3CX server
   ls -la /var/lib/3cxpbx/Bin/nginx/html/prompts/
   ```

2. **Validate audio format**:
   ```bash
   # Check audio properties
   file welcome.wav
   mediainfo welcome.wav
   ```

3. **Convert if needed**:
   ```bash
   # Convert to compatible format
   ffmpeg -i input.mp3 -ar 8000 -ac 1 -ab 64k output.wav
   ```

### Debug Mode

Enable detailed logging:

```javascript
// In workflow Code node
console.log('Debug info:', {
  callId: $json.callId,
  timestamp: new Date().toISOString(),
  nodeData: $json
});
```

Set environment variable:
```bash
export N8N_3CX_LOG_LEVEL=debug
```

### Health Check Workflow

Create a monitoring workflow:

```json
{
  "name": "3CX Health Monitor",
  "trigger": {
    "type": "Cron",
    "parameters": {
      "rule": "0 */5 * * * *"
    }
  },
  "nodes": [
    {
      "type": "3CXCallData",
      "parameters": {
        "operation": "getSystemStatus"
      },
      "id": "health_check"
    },
    {
      "type": "If",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.status }}",
              "value2": "healthy"
            }
          ]
        }
      },
      "id": "check_health"
    },
    {
      "type": "Slack",
      "parameters": {
        "channel": "#alerts",
        "text": "🚨 3CX system health check failed: {{ $json.status }}"
      },
      "id": "send_alert"
    }
  ]
}
```

---

## Production Deployment

### Pre-Deployment Checklist

```bash
# Run the validation suite
npm test

# Check all configurations
./scripts/validate-config.sh

# Verify audio files
./scripts/check-audio-files.sh

# Test credentials
./scripts/test-credentials.sh
```

### Security Considerations

1. **Secure Credentials**:
   ```bash
   # Use environment variables
   export N8N_3CX_CLIENT_SECRET="$(cat /secure/path/client-secret)"
   
   # Set proper permissions
   chmod 600 /secure/path/client-secret
   ```

2. **Network Security**:
   - Use HTTPS only
   - Implement IP whitelisting
   - Configure proper firewall rules
   - Use VPN for server access

3. **Webhook Security**:
   ```javascript
   // Verify webhook signatures
   const crypto = require('crypto');
   const signature = req.headers['x-3cx-signature'];
   const payload = JSON.stringify(req.body);
   const expectedSignature = crypto
     .createHmac('sha256', process.env.WEBHOOK_SECRET)
     .update(payload)
     .digest('hex');
   
   if (signature !== expectedSignature) {
     throw new Error('Invalid webhook signature');
   }
   ```

### Performance Optimization

1. **Connection Pooling**:
   ```bash
   export N8N_3CX_CONNECTION_POOL_SIZE=10
   export N8N_3CX_KEEPALIVE_TIMEOUT=30000
   ```

2. **Caching Strategy**:
   ```javascript
   // Cache frequently accessed data
   const cache = new Map();
   const CACHE_TTL = 300000; // 5 minutes
   
   function getCachedData(key, fetchFunction) {
     const cached = cache.get(key);
     if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
       return cached.data;
     }
     
     const data = fetchFunction();
     cache.set(key, { data, timestamp: Date.now() });
     return data;
   }
   ```

3. **Resource Monitoring**:
   ```bash
   # Monitor n8n performance
   pm2 monit
   
   # Check memory usage
   watch -n 5 'ps aux | grep n8n'
   
   # Monitor 3CX API usage
   tail -f /var/log/3cxpbx/api.log
   ```

### Backup and Recovery

1. **Backup Workflows**:
   ```bash
   # Export all workflows
   n8n export:workflow --backup
   
   # Backup credentials (encrypted)
   n8n export:credentials --backup
   ```

2. **Configuration Backup**:
   ```bash
   # Backup n8n configuration
   cp -r ~/.n8n/config ~/backups/n8n-config-$(date +%Y%m%d)
   
   # Backup custom nodes
   cp -r ~/.n8n/nodes ~/backups/n8n-nodes-$(date +%Y%m%d)
   ```

3. **Recovery Procedures**:
   ```bash
   # Restore workflows
   n8n import:workflow --input ~/backups/workflows.json
   
   # Restore credentials
   n8n import:credentials --input ~/backups/credentials.json
   ```

### Monitoring and Alerting

Set up comprehensive monitoring:

```json
{
  "name": "Production Monitoring",
  "trigger": {
    "type": "Webhook",
    "parameters": {
      "path": "3cx-monitor"
    }
  },
  "nodes": [
    {
      "type": "Code",
      "parameters": {
        "jsCode": "// Collect system metrics\nconst metrics = {\n  timestamp: new Date(),\n  memoryUsage: process.memoryUsage(),\n  uptime: process.uptime(),\n  activeConnections: $json.activeConnections,\n  callVolume: $json.callVolume\n};\n\nreturn [{ json: metrics }];"
      },
      "id": "collect_metrics"
    },
    {
      "type": "InfluxDB",
      "parameters": {
        "measurement": "3cx_n8n_metrics",
        "fields": "={{ $json }}"
      },
      "id": "store_metrics"
    },
    {
      "type": "If",
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.memoryUsage.heapUsed }}",
              "operation": "larger",
              "value2": 1073741824
            }
          ]
        }
      },
      "id": "check_memory_usage"
    },
    {
      "type": "PagerDuty",
      "parameters": {
        "severity": "critical",
        "summary": "High memory usage detected in 3CX n8n integration"
      },
      "id": "alert_high_memory"
    }
  ]
}
```

### Scaling Considerations

1. **Horizontal Scaling**:
   - Deploy multiple n8n instances
   - Use load balancer for webhook endpoints
   - Implement shared session storage

2. **Vertical Scaling**:
   ```bash
   # Increase n8n resources
   export N8N_WORKERS=4
   export N8N_MEMORY_LIMIT=4096
   ```

3. **Database Optimization**:
   - Use connection pooling
   - Implement read replicas
   - Regular maintenance tasks

---

## Support and Maintenance

### Getting Help

1. **Documentation**: Check the [complete documentation](./docs/3CX-n8n-Integration-Guide.md)
2. **GitHub Issues**: [Report issues](https://github.com/your-org/3cx-n8n-integration/issues)
3. **Community Forum**: [n8n Community](https://community.n8n.io/)
4. **Professional Support**: contact@your-company.com

### Regular Maintenance

1. **Weekly Tasks**:
   ```bash
   # Update dependencies
   npm update
   
   # Clean up logs
   find ~/.n8n/logs -name "*.log" -mtime +7 -delete
   
   # Check disk space
   df -h ~/.n8n
   ```

2. **Monthly Tasks**:
   ```bash
   # Security updates
   npm audit fix
   
   # Performance review
   npm run performance-check
   
   # Backup validation
   npm run test-backups
   ```

3. **Quarterly Tasks**:
   - Review and update workflows
   - Performance optimization
   - Security audit
   - Documentation updates

### Version Updates

```bash
# Check for updates
git fetch origin
git log --oneline HEAD..origin/main

# Update to latest version
git pull origin main
npm install
npm run build

# Test after update
npm test

# Restart n8n
pm2 restart n8n
```

---

## Quick Reference

### Node Types
- **3CX Call Receiver**: Trigger node for incoming calls
- **3CX Call Control**: Action node for call operations
- **3CX Call Monitor**: Trigger node for call events
- **3CX Call Data**: Action node for data retrieval

### Common Operations
- `answerCall`: Answer incoming call
- `hangupCall`: Terminate call
- `transferCall`: Transfer to extension/number
- `playAudio`: Play audio file
- `collectDTMF`: Collect user input
- `getActiveCalls`: List active calls
- `getCallHistory`: Retrieve call logs

### Useful Variables
- `{{ $json.callId }}`: Current call ID
- `{{ $json.fromNumber }}`: Caller number
- `{{ $json.toNumber }}`: Called number
- `{{ $json.extension }}`: Extension number
- `{{ $json.dtmfInput }}`: Collected DTMF

### Error Codes
- `401`: Authentication failed
- `404`: Call/resource not found
- `409`: Operation conflict
- `429`: Rate limit exceeded
- `500`: Server error

---

**Version**: 2.0.0  
**Last Updated**: January 2024  
**Support**: support@your-company.com  
**Documentation**: [Complete Guide](./docs/3CX-n8n-Integration-Guide.md)