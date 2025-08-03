import { ThreeCXAPIClient } from './apiClient';
import { ErrorRecoveryManager } from './errorRecoveryManager';
import { EventEmitter } from 'events';

// Production Error Types
export enum ProductionErrorType {
  // API Related
  API_CONNECTION_ERROR = 'api_connection_error',
  API_AUTHENTICATION_ERROR = 'api_authentication_error',
  API_RATE_LIMIT_ERROR = 'api_rate_limit_error',
  API_TIMEOUT_ERROR = 'api_timeout_error',
  API_SERVER_ERROR = 'api_server_error',
  
  // Call Control Errors
  CALL_NOT_FOUND = 'call_not_found',
  CALL_ALREADY_ENDED = 'call_already_ended',
  CALL_CONTROL_DENIED = 'call_control_denied',
  INVALID_EXTENSION = 'invalid_extension',
  INVALID_PHONE_NUMBER = 'invalid_phone_number',
  
  // Resource Errors
  INSUFFICIENT_RESOURCES = 'insufficient_resources',
  RESOURCE_ALLOCATION_FAILED = 'resource_allocation_failed',
  CONCURRENT_LIMIT_EXCEEDED = 'concurrent_limit_exceeded',
  MEMORY_EXHAUSTED = 'memory_exhausted',
  
  // Configuration Errors
  INVALID_CONFIGURATION = 'invalid_configuration',
  MISSING_CREDENTIALS = 'missing_credentials',
  INVALID_WEBHOOK_URL = 'invalid_webhook_url',
  
  // Network Errors
  NETWORK_UNREACHABLE = 'network_unreachable',
  DNS_RESOLUTION_FAILED = 'dns_resolution_failed',
  SSL_CERTIFICATE_ERROR = 'ssl_certificate_error',
  
  // Business Logic Errors
  BUSINESS_RULE_VIOLATION = 'business_rule_violation',
  QUEUE_UNAVAILABLE = 'queue_unavailable',
  AGENT_UNAVAILABLE = 'agent_unavailable',
  
  // System Errors
  SYSTEM_OVERLOAD = 'system_overload',
  DATABASE_ERROR = 'database_error',
  FILE_SYSTEM_ERROR = 'file_system_error'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ProductionError {
  errorId: string;
  type: ProductionErrorType;
  severity: ErrorSeverity;
  message: string;
  details: any;
  timestamp: Date;
  context: ErrorContext;
  stack?: string;
  recovered: boolean;
  recoveryActions: string[];
  correlationId?: string;
}

export interface ErrorContext {
  callId?: string;
  extensionNumber?: string;
  operation?: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorHandlingRule {
  errorType: ProductionErrorType;
  severity: ErrorSeverity;
  autoRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  escalationThreshold: number;
  notificationChannels: string[];
  recoveryActions: ErrorRecoveryAction[];
}

export interface ErrorRecoveryAction {
  action: string;
  priority: number;
  condition?: (error: ProductionError) => boolean;
  execute: (error: ProductionError, context: any) => Promise<boolean>;
  timeout: number;
}

export interface ErrorNotification {
  notificationId: string;
  errorId: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'failed';
}

export interface ErrorMetrics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalErrors: number;
  errorsByType: Map<ProductionErrorType, number>;
  errorsBySeverity: Map<ErrorSeverity, number>;
  recoveryRate: number;
  meanTimeToRecovery: number;
  escalatedErrors: number;
  trends: {
    hourlyDistribution: number[];
    dailyDistribution: number[];
  };
}

// Production Error Handler
export class ProductionErrorHandler extends EventEmitter {
  private apiClient: ThreeCXAPIClient;
  private recoveryManager: ErrorRecoveryManager;
  private errors = new Map<string, ProductionError>();
  private errorRules = new Map<ProductionErrorType, ErrorHandlingRule>();
  private retryQueues = new Map<ProductionErrorType, ProductionError[]>();
  private notifications = new Map<string, ErrorNotification>();
  private errorCounter = 0;
  private notificationCounter = 0;

  // Processing intervals
  private retryProcessingInterval: NodeJS.Timeout | null = null;
  private metricsProcessingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Rate limiting
  private errorRateLimits = new Map<ProductionErrorType, {
    count: number;
    resetTime: Date;
    threshold: number;
  }>();

  constructor(apiClient: ThreeCXAPIClient, recoveryManager: ErrorRecoveryManager) {
    super();
    this.apiClient = apiClient;
    this.recoveryManager = recoveryManager;
    this.initializeErrorRules();
    this.startProcessing();
  }

  // Error Handling
  async handleError(
    error: Error | any,
    context: ErrorContext,
    errorType?: ProductionErrorType
  ): Promise<ProductionError> {
    const productionError = this.createProductionError(error, context, errorType);
    
    // Store error
    this.errors.set(productionError.errorId, productionError);
    
    // Emit error event
    this.emit('error', productionError);
    
    // Check rate limiting
    if (this.shouldRateLimit(productionError.type)) {
      productionError.details.rateLimited = true;
      return productionError;
    }
    
    // Apply error handling rules
    const rule = this.errorRules.get(productionError.type);
    if (rule) {
      await this.applyErrorRule(productionError, rule);
    }
    
    // Check for escalation
    if (this.shouldEscalate(productionError)) {
      await this.escalateError(productionError);
    }
    
    return productionError;
  }

  private createProductionError(
    error: Error | any,
    context: ErrorContext,
    errorType?: ProductionErrorType
  ): ProductionError {
    const errorId = `error-${++this.errorCounter}-${Date.now()}`;
    const detectedType = errorType || this.detectErrorType(error);
    const severity = this.determineSeverity(detectedType, error, context);
    
    const productionError: ProductionError = {
      errorId,
      type: detectedType,
      severity,
      message: error.message || String(error),
      details: {
        originalError: error,
        userAgent: 'n8n-3cx-node',
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
        ...error
      },
      timestamp: new Date(),
      context,
      stack: error.stack,
      recovered: false,
      recoveryActions: [],
      correlationId: context.requestId || context.sessionId
    };
    
    return productionError;
  }

  private detectErrorType(error: any): ProductionErrorType {
    const message = error.message?.toLowerCase() || '';
    const code = error.code;
    
    // API Errors
    if (error.status === 401 || message.includes('unauthorized')) {
      return ProductionErrorType.API_AUTHENTICATION_ERROR;
    }
    if (error.status === 429 || message.includes('rate limit')) {
      return ProductionErrorType.API_RATE_LIMIT_ERROR;
    }
    if (error.status >= 500 || message.includes('server error')) {
      return ProductionErrorType.API_SERVER_ERROR;
    }
    if (error.name === 'AbortError' || message.includes('timeout')) {
      return ProductionErrorType.API_TIMEOUT_ERROR;
    }
    
    // Network Errors
    if (code === 'ENOTFOUND' || message.includes('dns')) {
      return ProductionErrorType.DNS_RESOLUTION_FAILED;
    }
    if (code === 'ECONNREFUSED' || message.includes('connection refused')) {
      return ProductionErrorType.NETWORK_UNREACHABLE;
    }
    if (message.includes('certificate') || message.includes('ssl')) {
      return ProductionErrorType.SSL_CERTIFICATE_ERROR;
    }
    
    // Call Control Errors
    if (message.includes('call not found') || error.status === 404) {
      return ProductionErrorType.CALL_NOT_FOUND;
    }
    if (message.includes('call ended') || message.includes('call terminated')) {
      return ProductionErrorType.CALL_ALREADY_ENDED;
    }
    if (message.includes('extension') && message.includes('invalid')) {
      return ProductionErrorType.INVALID_EXTENSION;
    }
    
    // Resource Errors
    if (message.includes('memory') || code === 'ENOMEM') {
      return ProductionErrorType.MEMORY_EXHAUSTED;
    }
    if (message.includes('concurrent') || message.includes('limit exceeded')) {
      return ProductionErrorType.CONCURRENT_LIMIT_EXCEEDED;
    }
    
    // Default to connection error
    return ProductionErrorType.API_CONNECTION_ERROR;
  }

  private determineSeverity(
    errorType: ProductionErrorType,
    error: any,
    context: ErrorContext
  ): ErrorSeverity {
    // Critical errors that require immediate attention
    const criticalTypes = [
      ProductionErrorType.API_AUTHENTICATION_ERROR,
      ProductionErrorType.MEMORY_EXHAUSTED,
      ProductionErrorType.SYSTEM_OVERLOAD,
      ProductionErrorType.DATABASE_ERROR
    ];
    
    if (criticalTypes.includes(errorType)) {
      return ErrorSeverity.CRITICAL;
    }
    
    // High severity errors that impact functionality
    const highTypes = [
      ProductionErrorType.API_SERVER_ERROR,
      ProductionErrorType.CONCURRENT_LIMIT_EXCEEDED,
      ProductionErrorType.RESOURCE_ALLOCATION_FAILED,
      ProductionErrorType.BUSINESS_RULE_VIOLATION
    ];
    
    if (highTypes.includes(errorType)) {
      return ErrorSeverity.HIGH;
    }
    
    // Medium severity errors that may impact performance
    const mediumTypes = [
      ProductionErrorType.API_TIMEOUT_ERROR,
      ProductionErrorType.CALL_CONTROL_DENIED,
      ProductionErrorType.QUEUE_UNAVAILABLE,
      ProductionErrorType.NETWORK_UNREACHABLE
    ];
    
    if (mediumTypes.includes(errorType)) {
      return ErrorSeverity.MEDIUM;
    }
    
    // Everything else is low severity
    return ErrorSeverity.LOW;
  }

  // Error Rules and Recovery
  private async applyErrorRule(
    error: ProductionError,
    rule: ErrorHandlingRule
  ): Promise<void> {
    // Auto retry if enabled
    if (rule.autoRetry && !error.details.retryCount) {
      error.details.retryCount = 0;
      await this.scheduleRetry(error, rule);
    }
    
    // Execute recovery actions
    for (const recoveryAction of rule.recoveryActions) {
      if (!recoveryAction.condition || recoveryAction.condition(error)) {
        try {
          const success = await Promise.race([
            recoveryAction.execute(error, { apiClient: this.apiClient }),
            new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('Recovery action timeout')), recoveryAction.timeout * 1000)
            )
          ]);
          
          if (success) {
            error.recovered = true;
            error.recoveryActions.push(recoveryAction.action);
            this.emit('errorRecovered', error);
            break;
          }
        } catch (recoveryError) {
          console.error(`Recovery action failed: ${recoveryAction.action}`, recoveryError);
        }
      }
    }
    
    // Send notifications
    if (rule.notificationChannels.length > 0) {
      await this.sendNotifications(error, rule.notificationChannels);
    }
  }

  private async scheduleRetry(
    error: ProductionError,
    rule: ErrorHandlingRule
  ): Promise<void> {
    if (error.details.retryCount >= rule.maxRetries) {
      error.details.maxRetriesExceeded = true;
      return;
    }
    
    error.details.retryCount++;
    error.details.nextRetryAt = new Date(Date.now() + rule.retryDelay * 1000);
    
    // Add to retry queue
    let retryQueue = this.retryQueues.get(error.type);
    if (!retryQueue) {
      retryQueue = [];
      this.retryQueues.set(error.type, retryQueue);
    }
    
    retryQueue.push(error);
  }

  // Rate Limiting
  private shouldRateLimit(errorType: ProductionErrorType): boolean {
    const limit = this.errorRateLimits.get(errorType);
    const now = new Date();
    
    if (!limit) {
      // Initialize rate limit
      this.errorRateLimits.set(errorType, {
        count: 1,
        resetTime: new Date(now.getTime() + 60000), // 1 minute window
        threshold: this.getErrorThreshold(errorType)
      });
      return false;
    }
    
    // Reset if window expired
    if (now >= limit.resetTime) {
      limit.count = 1;
      limit.resetTime = new Date(now.getTime() + 60000);
      return false;
    }
    
    limit.count++;
    return limit.count > limit.threshold;
  }

  private getErrorThreshold(errorType: ProductionErrorType): number {
    const thresholds = new Map([
      [ProductionErrorType.API_CONNECTION_ERROR, 10],
      [ProductionErrorType.API_TIMEOUT_ERROR, 5],
      [ProductionErrorType.CALL_NOT_FOUND, 20],
      [ProductionErrorType.INVALID_EXTENSION, 15],
      [ProductionErrorType.NETWORK_UNREACHABLE, 3]
    ]);
    
    return thresholds.get(errorType) || 5;
  }

  // Escalation
  private shouldEscalate(error: ProductionError): boolean {
    const rule = this.errorRules.get(error.type);
    if (!rule) return error.severity === ErrorSeverity.CRITICAL;
    
    // Check if error count exceeds escalation threshold
    const recentErrors = this.getRecentErrors(error.type, 300000); // 5 minutes
    return recentErrors.length >= rule.escalationThreshold;
  }

  private async escalateError(error: ProductionError): Promise<void> {
    error.details.escalated = true;
    error.details.escalatedAt = new Date();
    
    // Send high-priority notifications
    await this.sendNotifications(error, ['email', 'sms', 'webhook'], true);
    
    // Log to monitoring system
    console.error('ESCALATED ERROR:', {
      errorId: error.errorId,
      type: error.type,
      severity: error.severity,
      message: error.message,
      context: error.context
    });
    
    this.emit('errorEscalated', error);
  }

  // Notifications
  private async sendNotifications(
    error: ProductionError,
    channels: string[],
    highPriority: boolean = false
  ): Promise<void> {
    for (const channel of channels) {
      const notification: ErrorNotification = {
        notificationId: `notification-${++this.notificationCounter}-${Date.now()}`,
        errorId: error.errorId,
        channel,
        recipient: this.getRecipientForChannel(channel, error.severity),
        subject: this.generateNotificationSubject(error, highPriority),
        body: this.generateNotificationBody(error),
        timestamp: new Date(),
        status: 'pending'
      };
      
      this.notifications.set(notification.notificationId, notification);
      
      try {
        await this.deliverNotification(notification);
        notification.status = 'sent';
      } catch (notificationError) {
        notification.status = 'failed';
        console.error('Failed to send notification:', notificationError);
      }
    }
  }

  private getRecipientForChannel(channel: string, severity: ErrorSeverity): string {
    // This would typically come from configuration
    const recipients = new Map([
      ['email', severity === ErrorSeverity.CRITICAL ? 'admin@company.com' : 'support@company.com'],
      ['sms', severity === ErrorSeverity.CRITICAL ? '+1234567890' : '+0987654321'],
      ['webhook', 'https://monitoring.company.com/webhook']
    ]);
    
    return recipients.get(channel) || 'default@company.com';
  }

  private generateNotificationSubject(error: ProductionError, highPriority: boolean): string {
    const prefix = highPriority ? '[URGENT] ' : '';
    return `${prefix}3CX n8n Error: ${error.type} (${error.severity})`;
  }

  private generateNotificationBody(error: ProductionError): string {
    return `
Error Details:
- ID: ${error.errorId}
- Type: ${error.type}
- Severity: ${error.severity}
- Message: ${error.message}
- Timestamp: ${error.timestamp.toISOString()}
- Call ID: ${error.context.callId || 'N/A'}
- Extension: ${error.context.extensionNumber || 'N/A'}
- Operation: ${error.context.operation || 'N/A'}
- Recovered: ${error.recovered ? 'Yes' : 'No'}

Recovery Actions Taken:
${error.recoveryActions.length > 0 ? error.recoveryActions.join(', ') : 'None'}

Stack Trace:
${error.stack || 'Not available'}
    `.trim();
  }

  private async deliverNotification(notification: ErrorNotification): Promise<void> {
    switch (notification.channel) {
      case 'email':
        // In production, integrate with email service
        console.log(`EMAIL to ${notification.recipient}: ${notification.subject}`);
        break;
        
      case 'sms':
        // In production, integrate with SMS service
        console.log(`SMS to ${notification.recipient}: ${notification.subject}`);
        break;
        
      case 'webhook':
        // Send to monitoring webhook
        await fetch(notification.recipient, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notification: notification,
            timestamp: new Date().toISOString()
          })
        });
        break;
    }
  }

  // Processing and Cleanup
  private startProcessing(): void {
    // Process retry queue every 10 seconds
    this.retryProcessingInterval = setInterval(() => {
      this.processRetryQueues();
    }, 10000);
    
    // Update metrics every minute
    this.metricsProcessingInterval = setInterval(() => {
      this.updateMetrics();
    }, 60000);
    
    // Cleanup old errors every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldErrors();
    }, 3600000);
  }

  private async processRetryQueues(): Promise<void> {
    const now = new Date();
    
    for (const [errorType, retryQueue] of this.retryQueues) {
      const readyToRetry = retryQueue.filter(error => 
        error.details.nextRetryAt && error.details.nextRetryAt <= now
      );
      
      for (const error of readyToRetry) {
        // Remove from retry queue
        const index = retryQueue.indexOf(error);
        if (index !== -1) {
          retryQueue.splice(index, 1);
        }
        
        // Attempt recovery
        const rule = this.errorRules.get(error.type);
        if (rule) {
          await this.applyErrorRule(error, rule);
        }
      }
    }
  }

  private updateMetrics(): void {
    // Update error rate limits
    const now = new Date();
    for (const [errorType, limit] of this.errorRateLimits) {
      if (now >= limit.resetTime) {
        limit.count = 0;
        limit.resetTime = new Date(now.getTime() + 60000);
      }
    }
    
    this.emit('metricsUpdated', this.getErrorMetrics(new Date(now.getTime() - 3600000), now));
  }

  private cleanupOldErrors(): void {
    const cutoffTime = new Date(Date.now() - 86400000); // 24 hours ago
    
    for (const [errorId, error] of this.errors) {
      if (error.timestamp < cutoffTime) {
        this.errors.delete(errorId);
      }
    }
    
    for (const [notificationId, notification] of this.notifications) {
      if (notification.timestamp < cutoffTime) {
        this.notifications.delete(notificationId);
      }
    }
  }

  // Error Rules Initialization
  private initializeErrorRules(): void {
    const rules: ErrorHandlingRule[] = [
      {
        errorType: ProductionErrorType.API_CONNECTION_ERROR,
        severity: ErrorSeverity.MEDIUM,
        autoRetry: true,
        maxRetries: 3,
        retryDelay: 5,
        escalationThreshold: 5,
        notificationChannels: ['email'],
        recoveryActions: [
          {
            action: 'reconnect_api',
            priority: 1,
            execute: async (error, context) => {
              return await context.apiClient.reconnect();
            },
            timeout: 30
          }
        ]
      },
      {
        errorType: ProductionErrorType.API_AUTHENTICATION_ERROR,
        severity: ErrorSeverity.CRITICAL,
        autoRetry: true,
        maxRetries: 2,
        retryDelay: 10,
        escalationThreshold: 1,
        notificationChannels: ['email', 'sms'],
        recoveryActions: [
          {
            action: 'refresh_token',
            priority: 1,
            execute: async (error, context) => {
              return await context.apiClient.refreshToken();
            },
            timeout: 15
          }
        ]
      },
      {
        errorType: ProductionErrorType.CALL_NOT_FOUND,
        severity: ErrorSeverity.LOW,
        autoRetry: false,
        maxRetries: 0,
        retryDelay: 0,
        escalationThreshold: 20,
        notificationChannels: [],
        recoveryActions: []
      },
      {
        errorType: ProductionErrorType.CONCURRENT_LIMIT_EXCEEDED,
        severity: ErrorSeverity.HIGH,
        autoRetry: true,
        maxRetries: 2,
        retryDelay: 30,
        escalationThreshold: 3,
        notificationChannels: ['email'],
        recoveryActions: [
          {
            action: 'scale_resources',
            priority: 1,
            execute: async (error, context) => {
              // Implementation would scale resources
              return true;
            },
            timeout: 60
          }
        ]
      }
    ];
    
    rules.forEach(rule => {
      this.errorRules.set(rule.errorType, rule);
    });
  }

  // Public API
  getError(errorId: string): ProductionError | undefined {
    return this.errors.get(errorId);
  }

  getRecentErrors(errorType?: ProductionErrorType, timeWindowMs: number = 3600000): ProductionError[] {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    const errors = Array.from(this.errors.values())
      .filter(error => error.timestamp >= cutoffTime);
    
    if (errorType) {
      return errors.filter(error => error.type === errorType);
    }
    
    return errors;
  }

  getErrorMetrics(startDate: Date, endDate: Date): ErrorMetrics {
    const errors = Array.from(this.errors.values())
      .filter(error => error.timestamp >= startDate && error.timestamp <= endDate);
    
    const errorsByType = new Map<ProductionErrorType, number>();
    const errorsBySeverity = new Map<ErrorSeverity, number>();
    
    let recoveredCount = 0;
    let totalRecoveryTime = 0;
    let escalatedCount = 0;
    
    for (const error of errors) {
      // Count by type
      errorsByType.set(error.type, (errorsByType.get(error.type) || 0) + 1);
      
      // Count by severity
      errorsBySeverity.set(error.severity, (errorsBySeverity.get(error.severity) || 0) + 1);
      
      // Recovery metrics
      if (error.recovered) {
        recoveredCount++;
        // Calculate recovery time if available
        const recoveryTime = error.details.recoveredAt ? 
          error.details.recoveredAt.getTime() - error.timestamp.getTime() : 0;
        totalRecoveryTime += recoveryTime;
      }
      
      // Escalation metrics
      if (error.details.escalated) {
        escalatedCount++;
      }
    }
    
    return {
      period: { startDate, endDate },
      totalErrors: errors.length,
      errorsByType,
      errorsBySeverity,
      recoveryRate: errors.length > 0 ? (recoveredCount / errors.length) * 100 : 0,
      meanTimeToRecovery: recoveredCount > 0 ? totalRecoveryTime / recoveredCount / 1000 : 0,
      escalatedErrors: escalatedCount,
      trends: {
        hourlyDistribution: this.calculateHourlyDistribution(errors),
        dailyDistribution: this.calculateDailyDistribution(errors)
      }
    };
  }

  private calculateHourlyDistribution(errors: ProductionError[]): number[] {
    const distribution = new Array(24).fill(0);
    
    for (const error of errors) {
      const hour = error.timestamp.getHours();
      distribution[hour]++;
    }
    
    return distribution;
  }

  private calculateDailyDistribution(errors: ProductionError[]): number[] {
    const distribution = new Array(7).fill(0);
    
    for (const error of errors) {
      const day = error.timestamp.getDay();
      distribution[day]++;
    }
    
    return distribution;
  }

  // Cleanup
  destroy(): void {
    if (this.retryProcessingInterval) {
      clearInterval(this.retryProcessingInterval);
      this.retryProcessingInterval = null;
    }
    
    if (this.metricsProcessingInterval) {
      clearInterval(this.metricsProcessingInterval);
      this.metricsProcessingInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.errors.clear();
    this.errorRules.clear();
    this.retryQueues.clear();
    this.notifications.clear();
    this.errorRateLimits.clear();
    this.removeAllListeners();
  }
}

// Factory function
export function createProductionErrorHandler(
  apiClient: ThreeCXAPIClient,
  recoveryManager: ErrorRecoveryManager
): ProductionErrorHandler {
  return new ProductionErrorHandler(apiClient, recoveryManager);
}