#!/bin/sh
# Health check script for n8n with 3CX integration

set -e

# Configuration
N8N_HOST="${N8N_HOST:-localhost}"
N8N_PORT="${N8N_PORT:-5678}"
N8N_PROTOCOL="${N8N_PROTOCOL:-http}"
TIMEOUT=10

# Function to check HTTP endpoint
check_http() {
    local url="$1"
    local expected_status="$2"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        return 0
    else
        echo "HTTP check failed: $url returned $response, expected $expected_status"
        return 1
    fi
}

# Function to check if n8n API is responding
check_n8n_api() {
    local base_url="${N8N_PROTOCOL}://${N8N_HOST}:${N8N_PORT}"
    
    # Check if n8n is responding
    if ! check_http "$base_url/healthz" "200"; then
        # Fallback to checking the main endpoint
        if ! check_http "$base_url/" "200"; then
            echo "n8n API is not responding"
            return 1
        fi
    fi
    
    echo "n8n API is healthy"
    return 0
}

# Function to check if 3CX nodes are loaded
check_3cx_nodes() {
    local base_url="${N8N_PROTOCOL}://${N8N_HOST}:${N8N_PORT}"
    
    # Check if nodes endpoint is accessible
    response=$(curl -s --max-time $TIMEOUT "$base_url/rest/nodes" 2>/dev/null || echo "")
    
    if [ -z "$response" ]; then
        echo "Could not fetch nodes list"
        return 1
    fi
    
    # Check if 3CX nodes are present
    if echo "$response" | grep -q "3CX"; then
        echo "3CX nodes are loaded"
        return 0
    else
        echo "3CX nodes are not loaded"
        return 1
    fi
}

# Function to check memory usage
check_memory() {
    # Get memory usage percentage
    memory_usage=$(ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem | grep n8n | head -1 | awk '{print $4}' | cut -d. -f1)
    
    if [ -z "$memory_usage" ]; then
        echo "Could not determine memory usage"
        return 1
    fi
    
    # Alert if memory usage is above 90%
    if [ "$memory_usage" -gt 90 ]; then
        echo "High memory usage: ${memory_usage}%"
        return 1
    fi
    
    echo "Memory usage is acceptable: ${memory_usage}%"
    return 0
}

# Function to check disk space
check_disk_space() {
    # Check available disk space in /home/node/.n8n
    disk_usage=$(df /home/node/.n8n 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ -z "$disk_usage" ]; then
        echo "Could not determine disk usage"
        return 1
    fi
    
    # Alert if disk usage is above 85%
    if [ "$disk_usage" -gt 85 ]; then
        echo "High disk usage: ${disk_usage}%"
        return 1
    fi
    
    echo "Disk usage is acceptable: ${disk_usage}%"
    return 0
}

# Function to check if required environment variables are set
check_environment() {
    local required_vars="N8N_HOST N8N_PORT"
    local missing_vars=""
    
    for var in $required_vars; do
        eval "value=\$$var"
        if [ -z "$value" ]; then
            missing_vars="$missing_vars $var"
        fi
    done
    
    if [ -n "$missing_vars" ]; then
        echo "Missing required environment variables:$missing_vars"
        return 1
    fi
    
    echo "Environment variables are set"
    return 0
}

# Function to check log files for recent errors
check_logs() {
    local log_dir="/home/node/.n8n/logs"
    local error_count=0
    
    if [ -d "$log_dir" ]; then
        # Check for errors in the last 5 minutes
        error_count=$(find "$log_dir" -name "*.log" -mmin -5 -exec grep -c "ERROR\|FATAL" {} \; 2>/dev/null | awk '{sum += $1} END {print sum+0}')
        
        if [ "$error_count" -gt 10 ]; then
            echo "High error rate in logs: $error_count errors in last 5 minutes"
            return 1
        fi
    fi
    
    echo "Log check passed: $error_count recent errors"
    return 0
}

# Main health check function
main() {
    echo "Starting health check..."
    
    local failed_checks=""
    
    # Run all checks
    if ! check_environment; then
        failed_checks="$failed_checks environment"
    fi
    
    if ! check_n8n_api; then
        failed_checks="$failed_checks api"
    fi
    
    if ! check_3cx_nodes; then
        failed_checks="$failed_checks nodes"
    fi
    
    if ! check_memory; then
        failed_checks="$failed_checks memory"
    fi
    
    if ! check_disk_space; then
        failed_checks="$failed_checks disk"
    fi
    
    if ! check_logs; then
        failed_checks="$failed_checks logs"
    fi
    
    # Report results
    if [ -n "$failed_checks" ]; then
        echo "Health check FAILED. Failed checks:$failed_checks"
        exit 1
    else
        echo "Health check PASSED. All systems are healthy."
        exit 0
    fi
}

# Run the health check
main "$@"