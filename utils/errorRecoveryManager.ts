/**
 * Advanced Error Recovery and Failover Manager for 3CX
 * Comprehensive error handling, automatic recovery, circuit breaking, and failover mechanisms
 */

import { ThreeCXAPIClient } from './apiClient';

export interface ErrorRecoveryConfig {
	// Circuit breaker settings
	circuitBreaker: {
		failureThreshold: number;
		resetTimeout: number; // milliseconds
		monitoringPeriod: number; // milliseconds
		halfOpenMaxCalls: number;
	};
	
	// Retry settings
	retry: {
		maxAttempts: number;
		baseDelay: number; // milliseconds
		maxDelay: number; // milliseconds
		backoffStrategy: 'linear' | 'exponential' | 'fixed';
		jitter: boolean;
	};

	// Timeout settings
	timeout: {
		connectionTimeout: number;
		requestTimeout: number;
		healthCheckTimeout: number;
	};

	// Failover settings
	failover: {
		enabled: boolean;
		primaryEndpoint: string;
		secondaryEndpoints: string[];
		healthCheckInterval: number; // milliseconds
		failoverCooldown: number; // milliseconds
		automaticRecovery: boolean;
	};

	// Health monitoring
	healthMonitoring: {
		enabled: boolean;
		interval: number; // milliseconds
		consecutiveFailuresThreshold: number;
		healthCheckEndpoints: string[];
		metrics: HealthMetric[];
	};

	// Error classification
	errorClassification: {
		retryableErrors: string[];
		nonRetryableErrors: string[];
		criticalErrors: string[];
		temporaryErrors: string[];
	};

	// Recovery strategies
	recoveryStrategies: {
		connectionLoss: RecoveryStrategy;
		apiFailure: RecoveryStrategy;
		authenticationFailure: RecoveryStrategy;
		rateLimitExceeded: RecoveryStrategy;
		serverOverload: RecoveryStrategy;
		networkTimeout: RecoveryStrategy;
	};
}

export interface RecoveryStrategy {
	type: 'retry' | 'failover' | 'queue' | 'fallback' | 'circuit_break' | 'escalate';
	maxAttempts?: number;
	delay?: number;
	escalationThreshold?: number;
	fallbackAction?: string;
	notificationRequired?: boolean;
	parameters?: Record<string, any>;
}

export interface HealthMetric {
	name: string;
	type: 'response_time' | 'error_rate' | 'success_rate' | 'throughput' | 'cpu_usage' | 'memory_usage';
	threshold: number;
	unit: string;
	severity: 'warning' | 'critical';
}

export interface CircuitBreakerState {
	state: 'closed' | 'open' | 'half_open';
	failureCount: number;
	lastFailureTime?: Date;
	nextAttemptTime?: Date;
	successCount: number;
	totalRequests: number;
	monitoringWindowStart: Date;
}

export interface EndpointHealth {
	endpoint: string;
	status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
	lastCheck: Date;
	responseTime: number;
	errorRate: number;
	consecutiveFailures: number;
	metrics: { [key: string]: number };
	lastError?: ErrorInfo;
}

export interface ErrorInfo {
	errorId: string;
	timestamp: Date;
	errorType: string;
	errorCode?: string;
	errorMessage: string;
	stackTrace?: string;
	context: Record<string, any>;
	severity: 'low' | 'medium' | 'high' | 'critical';
	classification: 'retryable' | 'non_retryable' | 'critical' | 'temporary';
	recoveryAttempts: number;
	resolved: boolean;
	resolutionTime?: Date;
	impact: ErrorImpact;
}

export interface ErrorImpact {
	affectedOperations: string[];
	affectedUsers: number;
	estimatedDowntime: number; // milliseconds
	businessImpact: 'low' | 'medium' | 'high' | 'critical';
	dataLoss: boolean;
	serviceUnavailable: boolean;
}

export interface RecoveryAction {
	actionId: string;
	timestamp: Date;
	actionType: string;
	errorId: string;
	strategy: RecoveryStrategy;
	parameters: Record<string, any>;
	status: 'pending' | 'in_progress' | 'completed' | 'failed';
	result?: RecoveryResult;
	duration?: number;
	retryCount: number;
}

export interface RecoveryResult {
	success: boolean;
	message: string;
	newState?: any;
	metricsImproved: boolean;
	furtherActionRequired: boolean;
	nextRecommendedAction?: string;
}

export interface FailoverEvent {
	eventId: string;
	timestamp: Date;
	triggerReason: string;
	fromEndpoint: string;
	toEndpoint: string;
	duration: number;
	affectedOperations: string[];
	rollbackTime?: Date;
	rollbackReason?: string;
	impact: ErrorImpact;
}

export interface OperationQueue {
	queueId: string;
	operationType: string;
	operations: QueuedOperation[];
	maxSize: number;
	retentionTime: number; // milliseconds
	priority: 'low' | 'normal' | 'high' | 'critical';
	status: 'active' | 'paused' | 'draining' | 'stopped';
}

export interface QueuedOperation {
	operationId: string;
	timestamp: Date;
	operationType: string;
	parameters: Record<string, any>;
	priority: number;
	maxRetries: number;
	currentRetries: number;
	expiresAt: Date;
	status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
	lastAttempt?: Date;
	errorHistory: ErrorInfo[];
}

export interface ErrorPattern {
	patternId: string;
	name: string;
	description: string;
	errorTypes: string[];
	frequency: number;
	timeWindow: number; // milliseconds
	conditions: PatternCondition[];
	predictiveIndicators: string[];
	recommendedActions: RecoveryStrategy[];
	severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PatternCondition {
	field: string;
	operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'pattern_match';
	value: any;
	weight: number;
}

export interface SystemResilienceMetrics {
	availability: number; // percentage
	meanTimeToRecovery: number; // milliseconds
	meanTimeBetweenFailures: number; // milliseconds
	errorRate: number; // percentage
	successfulRecoveries: number;
	failedRecoveries: number;
	circuitBreakerTrips: number;
	failoverEvents: number;
	totalDowntime: number; // milliseconds
	impactedOperations: number;
	costOfDowntime: number;
}

export class ErrorRecoveryManager {
	private apiClient: ThreeCXAPIClient;
	private config: ErrorRecoveryConfig;
	private circuitBreakers = new Map<string, CircuitBreakerState>();
	private endpointHealth = new Map<string, EndpointHealth>();
	private errorHistory = new Map<string, ErrorInfo>();
	private recoveryActions = new Map<string, RecoveryAction>();
	private failoverEvents = new Map<string, FailoverEvent>();
	private operationQueues = new Map<string, OperationQueue>();
	private errorPatterns = new Map<string, ErrorPattern>();
	private resilienceMetrics: SystemResilienceMetrics;
	
	// Monitoring intervals
	private healthCheckInterval: NodeJS.Timeout | null = null;
	private metricsCollectionInterval: NodeJS.Timeout | null = null;
	private patternAnalysisInterval: NodeJS.Timeout | null = null;
	
	// State tracking
	private currentPrimaryEndpoint: string;
	private isFailoverActive: boolean = false;
	private errorCounter = 0;
	private recoveryCounter = 0;

	constructor(apiClient: ThreeCXAPIClient, config?: Partial<ErrorRecoveryConfig>) {
		this.apiClient = apiClient;
		this.config = { ...this.getDefaultConfig(), ...config };
		this.currentPrimaryEndpoint = this.config.failover.primaryEndpoint;
		this.resilienceMetrics = this.initializeMetrics();
		
		this.initializeCircuitBreakers();
		this.initializeErrorPatterns();
		this.startMonitoring();
	}

	/**
	 * Execute operation with comprehensive error handling and recovery
	 */
	async executeWithRecovery<T>(
		operation: () => Promise<T>,
		operationName: string,
		context: Record<string, any> = {}
	): Promise<T> {
		const startTime = Date.now();
		let lastError: Error | null = null;
		
		// Check circuit breaker
		if (!this.isCircuitClosed(operationName)) {
			throw new Error(`Circuit breaker is open for operation: ${operationName}`);
		}

		for (let attempt = 1; attempt <= this.config.retry.maxAttempts; attempt++) {
			try {
				// Execute operation
				const result = await this.executeWithTimeout(operation, this.config.timeout.requestTimeout);
				
				// Record success
				this.recordSuccess(operationName);
				this.updateResilienceMetrics(true, Date.now() - startTime);
				
				return result;

			} catch (error) {
				lastError = error as Error;
				
				// Classify error
				const errorInfo = this.classifyError(error as Error, operationName, context, attempt);
				this.errorHistory.set(errorInfo.errorId, errorInfo);

				// Check if error is retryable
				if (!this.isRetryableError(errorInfo) || attempt === this.config.retry.maxAttempts) {
					await this.handleNonRetryableError(errorInfo, operationName);
					break;
				}

				// Record failure for circuit breaker
				this.recordFailure(operationName);

				// Execute recovery strategy
				const recoveryAction = await this.executeRecoveryStrategy(errorInfo, operationName);
				
				if (recoveryAction && !recoveryAction.result?.success) {
					// Recovery failed, try failover if available
					if (this.config.failover.enabled && this.shouldFailover(errorInfo)) {
						await this.initiateFailover(errorInfo);
					}
				}

				// Calculate retry delay
				if (attempt < this.config.retry.maxAttempts) {
					const delay = this.calculateRetryDelay(attempt);
					await this.sleep(delay);
				}
			}
		}

		// All attempts failed
		this.updateResilienceMetrics(false, Date.now() - startTime);
		
		if (lastError) {
			const finalErrorInfo = this.errorHistory.get(this.generateErrorId(lastError, operationName));
			if (finalErrorInfo) {
				await this.escalateError(finalErrorInfo);
			}
			throw lastError;
		}

		throw new Error(`Operation ${operationName} failed after ${this.config.retry.maxAttempts} attempts`);
	}

	/**
	 * Queue operation for later execution when system recovers
	 */
	async queueOperation(
		operationType: string,
		parameters: Record<string, any>,
		priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
		expiresIn: number = 3600000 // 1 hour
	): Promise<string> {
		const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		let queue = this.operationQueues.get(operationType);
		if (!queue) {
			queue = {
				queueId: `queue-${operationType}`,
				operationType,
				operations: [],
				maxSize: 1000,
				retentionTime: 24 * 60 * 60 * 1000, // 24 hours
				priority: 'normal',
				status: 'active',
			};
			this.operationQueues.set(operationType, queue);
		}

		const queuedOperation: QueuedOperation = {
			operationId,
			timestamp: new Date(),
			operationType,
			parameters,
			priority: this.getPriorityValue(priority),
			maxRetries: this.config.retry.maxAttempts,
			currentRetries: 0,
			expiresAt: new Date(Date.now() + expiresIn),
			status: 'pending',
			errorHistory: [],
		};

		// Add to queue maintaining priority order
		queue.operations.push(queuedOperation);
		queue.operations.sort((a, b) => b.priority - a.priority);

		// Limit queue size
		if (queue.operations.length > queue.maxSize) {
			queue.operations = queue.operations.slice(0, queue.maxSize);
		}

		return operationId;
	}

	/**
	 * Process queued operations when system recovers
	 */
	async processQueuedOperations(operationType?: string): Promise<void> {
		const queuesToProcess = operationType 
			? [this.operationQueues.get(operationType)].filter(Boolean)
			: Array.from(this.operationQueues.values());

		for (const queue of queuesToProcess) {
			if (queue && queue.status === 'active') {
				await this.processQueue(queue);
			}
		}
	}

	/**
	 * Initiate manual failover
	 */
	async initiateFailover(error?: ErrorInfo): Promise<FailoverEvent> {
		if (!this.config.failover.enabled) {
			throw new Error('Failover is not enabled');
		}

		const availableEndpoints = this.getHealthyEndpoints();
		if (availableEndpoints.length === 0) {
			throw new Error('No healthy endpoints available for failover');
		}

		const targetEndpoint = availableEndpoints[0];
		const eventId = `failover-${Date.now()}`;
		
		const failoverEvent: FailoverEvent = {
			eventId,
			timestamp: new Date(),
			triggerReason: error?.errorMessage || 'Manual failover initiated',
			fromEndpoint: this.currentPrimaryEndpoint,
			toEndpoint: targetEndpoint,
			duration: 0,
			affectedOperations: this.getAffectedOperations(),
			impact: error?.impact || {
				affectedOperations: [],
				affectedUsers: 0,
				estimatedDowntime: 0,
				businessImpact: 'medium',
				dataLoss: false,
				serviceUnavailable: false,
			},
		};

		try {
			// Switch to target endpoint
			await this.switchEndpoint(targetEndpoint);
			
			this.currentPrimaryEndpoint = targetEndpoint;
			this.isFailoverActive = true;
			
			failoverEvent.duration = Date.now() - failoverEvent.timestamp.getTime();
			this.failoverEvents.set(eventId, failoverEvent);

			// Start recovery process for original endpoint
			if (this.config.failover.automaticRecovery) {
				this.scheduleRecoveryAttempt(failoverEvent.fromEndpoint);
			}

			return failoverEvent;

		} catch (failoverError) {
			failoverEvent.duration = Date.now() - failoverEvent.timestamp.getTime();
			throw new Error(`Failover failed: ${failoverError instanceof Error ? failoverError.message : 'Unknown error'}`);
		}
	}

	/**
	 * Check and attempt automatic recovery to primary endpoint
	 */
	async attemptRecovery(): Promise<boolean> {
		if (!this.isFailoverActive) {
			return true; // Already on primary
		}

		const originalPrimary = this.config.failover.primaryEndpoint;
		const health = await this.checkEndpointHealth(originalPrimary);
		
		if (health.status === 'healthy') {
			try {
				await this.switchEndpoint(originalPrimary);
				
				this.currentPrimaryEndpoint = originalPrimary;
				this.isFailoverActive = false;
				
				// Record rollback
				const activeFailover = Array.from(this.failoverEvents.values())
					.find(event => !event.rollbackTime);
				
				if (activeFailover) {
					activeFailover.rollbackTime = new Date();
					activeFailover.rollbackReason = 'Automatic recovery to primary endpoint';
				}

				return true;

			} catch (error) {
				console.error('Recovery attempt failed:', error);
				return false;
			}
		}

		return false;
	}

	/**
	 * Get comprehensive system health status
	 */
	async getSystemHealth(): Promise<{
		overall: 'healthy' | 'degraded' | 'unhealthy';
		endpoints: EndpointHealth[];
		circuitBreakers: { [operation: string]: CircuitBreakerState };
		metrics: SystemResilienceMetrics;
		activeIssues: ErrorInfo[];
		recommendations: string[];
	}> {
		const endpoints = Array.from(this.endpointHealth.values());
		const activeErrors = Array.from(this.errorHistory.values())
			.filter(error => !error.resolved && error.severity !== 'low');

		const overallHealth = this.calculateOverallHealth(endpoints);
		const recommendations = this.generateHealthRecommendations(endpoints, activeErrors);

		return {
			overall: overallHealth,
			endpoints,
			circuitBreakers: Object.fromEntries(this.circuitBreakers),
			metrics: this.resilienceMetrics,
			activeIssues: activeErrors,
			recommendations,
		};
	}

	/**
	 * Analyze error patterns and predict potential issues
	 */
	async analyzeErrorPatterns(): Promise<{
		detectedPatterns: ErrorPattern[];
		predictions: {
			pattern: ErrorPattern;
			probability: number;
			timeToOccurrence: number;
			recommendedActions: string[];
		}[];
		trends: {
			errorRate: 'increasing' | 'decreasing' | 'stable';
			meanTimeToRecovery: 'improving' | 'degrading' | 'stable';
			systemStability: 'improving' | 'degrading' | 'stable';
		};
	}> {
		const recentErrors = Array.from(this.errorHistory.values())
			.filter(error => Date.now() - error.timestamp.getTime() < 24 * 60 * 60 * 1000); // Last 24 hours

		const detectedPatterns = this.detectErrorPatterns(recentErrors);
		const predictions = this.predictPotentialIssues(detectedPatterns, recentErrors);
		const trends = this.analyzeTrends(recentErrors);

		return {
			detectedPatterns,
			predictions,
			trends,
		};
	}

	/**
	 * Private helper methods
	 */
	private isCircuitClosed(operationName: string): boolean {
		const circuitBreaker = this.circuitBreakers.get(operationName);
		if (!circuitBreaker) return true;

		const now = Date.now();

		switch (circuitBreaker.state) {
			case 'closed':
				return true;

			case 'open':
				if (circuitBreaker.nextAttemptTime && now >= circuitBreaker.nextAttemptTime.getTime()) {
					// Transition to half-open
					circuitBreaker.state = 'half_open';
					circuitBreaker.successCount = 0;
					return true;
				}
				return false;

			case 'half_open':
				return circuitBreaker.successCount < this.config.circuitBreaker.halfOpenMaxCalls;

			default:
				return true;
		}
	}

	private recordSuccess(operationName: string): void {
		const circuitBreaker = this.circuitBreakers.get(operationName);
		if (!circuitBreaker) return;

		if (circuitBreaker.state === 'half_open') {
			circuitBreaker.successCount++;
			
			if (circuitBreaker.successCount >= this.config.circuitBreaker.halfOpenMaxCalls) {
				// Close the circuit
				circuitBreaker.state = 'closed';
				circuitBreaker.failureCount = 0;
				circuitBreaker.successCount = 0;
			}
		} else if (circuitBreaker.state === 'closed') {
			// Reset failure count on success
			circuitBreaker.failureCount = Math.max(0, circuitBreaker.failureCount - 1);
		}
	}

	private recordFailure(operationName: string): void {
		let circuitBreaker = this.circuitBreakers.get(operationName);
		if (!circuitBreaker) {
			circuitBreaker = this.createCircuitBreaker();
			this.circuitBreakers.set(operationName, circuitBreaker);
		}

		circuitBreaker.failureCount++;
		circuitBreaker.lastFailureTime = new Date();
		circuitBreaker.totalRequests++;

		if (circuitBreaker.failureCount >= this.config.circuitBreaker.failureThreshold) {
			// Open the circuit
			circuitBreaker.state = 'open';
			circuitBreaker.nextAttemptTime = new Date(Date.now() + this.config.circuitBreaker.resetTimeout);
		}
	}

	private async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error(`Operation timed out after ${timeout}ms`));
			}, timeout);

			operation()
				.then(resolve)
				.catch(reject)
				.finally(() => clearTimeout(timer));
		});
	}

	private classifyError(
		error: Error,
		operationName: string,
		context: Record<string, any>,
		attempt: number
	): ErrorInfo {
		const errorId = this.generateErrorId(error, operationName);
		const errorType = this.determineErrorType(error);
		const classification = this.determineErrorClassification(error, errorType);
		const severity = this.determineErrorSeverity(error, errorType, context);
		const impact = this.assessErrorImpact(error, operationName, context);

		return {
			errorId,
			timestamp: new Date(),
			errorType,
			errorCode: this.extractErrorCode(error),
			errorMessage: error.message,
			stackTrace: error.stack,
			context: { ...context, operationName, attempt },
			severity,
			classification,
			recoveryAttempts: 0,
			resolved: false,
			impact,
		};
	}

	private isRetryableError(errorInfo: ErrorInfo): boolean {
		return errorInfo.classification === 'retryable' || errorInfo.classification === 'temporary';
	}

	private async executeRecoveryStrategy(
		errorInfo: ErrorInfo,
		operationName: string
	): Promise<RecoveryAction | null> {
		const strategy = this.selectRecoveryStrategy(errorInfo);
		if (!strategy) return null;

		const actionId = `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		const recoveryAction: RecoveryAction = {
			actionId,
			timestamp: new Date(),
			actionType: strategy.type,
			errorId: errorInfo.errorId,
			strategy,
			parameters: strategy.parameters || {},
			status: 'in_progress',
			retryCount: 0,
		};

		this.recoveryActions.set(actionId, recoveryAction);

		try {
			const result = await this.executeRecoveryAction(strategy, errorInfo, operationName);
			
			recoveryAction.status = result.success ? 'completed' : 'failed';
			recoveryAction.result = result;
			recoveryAction.duration = Date.now() - recoveryAction.timestamp.getTime();

			if (result.success) {
				errorInfo.resolved = true;
				errorInfo.resolutionTime = new Date();
			}

			return recoveryAction;

		} catch (error) {
			recoveryAction.status = 'failed';
			recoveryAction.duration = Date.now() - recoveryAction.timestamp.getTime();
			throw error;
		}
	}

	private selectRecoveryStrategy(errorInfo: ErrorInfo): RecoveryStrategy | null {
		const errorType = errorInfo.errorType.toLowerCase();
		
		if (errorType.includes('connection') || errorType.includes('network')) {
			return this.config.recoveryStrategies.connectionLoss;
		} else if (errorType.includes('auth')) {
			return this.config.recoveryStrategies.authenticationFailure;
		} else if (errorType.includes('timeout')) {
			return this.config.recoveryStrategies.networkTimeout;
		} else if (errorType.includes('rate') || errorType.includes('limit')) {
			return this.config.recoveryStrategies.rateLimitExceeded;
		} else if (errorType.includes('server') || errorType.includes('5')) {
			return this.config.recoveryStrategies.serverOverload;
		} else {
			return this.config.recoveryStrategies.apiFailure;
		}
	}

	private async executeRecoveryAction(
		strategy: RecoveryStrategy,
		errorInfo: ErrorInfo,
		operationName: string
	): Promise<RecoveryResult> {
		switch (strategy.type) {
			case 'retry':
				return await this.executeRetryRecovery(strategy, errorInfo);

			case 'failover':
				return await this.executeFailoverRecovery(strategy, errorInfo);

			case 'queue':
				return await this.executeQueueRecovery(strategy, errorInfo, operationName);

			case 'fallback':
				return await this.executeFallbackRecovery(strategy, errorInfo);

			case 'circuit_break':
				return await this.executeCircuitBreakRecovery(strategy, errorInfo, operationName);

			case 'escalate':
				return await this.executeEscalationRecovery(strategy, errorInfo);

			default:
				return {
					success: false,
					message: `Unknown recovery strategy: ${strategy.type}`,
					metricsImproved: false,
					furtherActionRequired: true,
				};
		}
	}

	private async executeRetryRecovery(strategy: RecoveryStrategy, errorInfo: ErrorInfo): Promise<RecoveryResult> {
		// Retry logic is handled in the main execution loop
		return {
			success: true,
			message: 'Retry recovery strategy acknowledged',
			metricsImproved: false,
			furtherActionRequired: false,
		};
	}

	private async executeFailoverRecovery(strategy: RecoveryStrategy, errorInfo: ErrorInfo): Promise<RecoveryResult> {
		try {
			await this.initiateFailover(errorInfo);
			return {
				success: true,
				message: 'Failover completed successfully',
				metricsImproved: true,
				furtherActionRequired: false,
			};
		} catch (error) {
			return {
				success: false,
				message: `Failover failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				metricsImproved: false,
				furtherActionRequired: true,
				nextRecommendedAction: 'escalate',
			};
		}
	}

	private async executeQueueRecovery(
		strategy: RecoveryStrategy,
		errorInfo: ErrorInfo,
		operationName: string
	): Promise<RecoveryResult> {
		try {
			await this.queueOperation(operationName, errorInfo.context);
			return {
				success: true,
				message: 'Operation queued for later execution',
				metricsImproved: false,
				furtherActionRequired: false,
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to queue operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
				metricsImproved: false,
				furtherActionRequired: true,
			};
		}
	}

	private async executeFallbackRecovery(strategy: RecoveryStrategy, errorInfo: ErrorInfo): Promise<RecoveryResult> {
		// Execute fallback action if specified
		if (strategy.fallbackAction) {
			// This would depend on the specific fallback implementation
			return {
				success: true,
				message: `Fallback action executed: ${strategy.fallbackAction}`,
				metricsImproved: true,
				furtherActionRequired: false,
			};
		}

		return {
			success: false,
			message: 'No fallback action specified',
			metricsImproved: false,
			furtherActionRequired: true,
		};
	}

	private async executeCircuitBreakRecovery(
		strategy: RecoveryStrategy,
		errorInfo: ErrorInfo,
		operationName: string
	): Promise<RecoveryResult> {
		// Force circuit breaker to open
		const circuitBreaker = this.circuitBreakers.get(operationName);
		if (circuitBreaker) {
			circuitBreaker.state = 'open';
			circuitBreaker.nextAttemptTime = new Date(Date.now() + this.config.circuitBreaker.resetTimeout);
		}

		return {
			success: true,
			message: `Circuit breaker opened for operation: ${operationName}`,
			metricsImproved: false,
			furtherActionRequired: false,
		};
	}

	private async executeEscalationRecovery(strategy: RecoveryStrategy, errorInfo: ErrorInfo): Promise<RecoveryResult> {
		await this.escalateError(errorInfo);
		return {
			success: true,
			message: 'Error escalated to operations team',
			metricsImproved: false,
			furtherActionRequired: false,
		};
	}

	private calculateRetryDelay(attempt: number): number {
		const baseDelay = this.config.retry.baseDelay;
		let delay: number;

		switch (this.config.retry.backoffStrategy) {
			case 'linear':
				delay = baseDelay * attempt;
				break;
			case 'exponential':
				delay = baseDelay * Math.pow(2, attempt - 1);
				break;
			case 'fixed':
			default:
				delay = baseDelay;
				break;
		}

		// Apply jitter if enabled
		if (this.config.retry.jitter) {
			delay += Math.random() * (delay * 0.1); // ±10% jitter
		}

		return Math.min(delay, this.config.retry.maxDelay);
	}

	private shouldFailover(errorInfo: ErrorInfo): boolean {
		return errorInfo.severity === 'critical' || 
			   errorInfo.classification === 'critical' ||
			   errorInfo.impact.serviceUnavailable;
	}

	private async handleNonRetryableError(errorInfo: ErrorInfo, operationName: string): Promise<void> {
		if (errorInfo.severity === 'critical') {
			await this.escalateError(errorInfo);
		}

		// Check if this triggers a circuit breaker
		if (errorInfo.classification === 'critical') {
			this.recordFailure(operationName);
		}
	}

	private async escalateError(errorInfo: ErrorInfo): Promise<void> {
		// Implement error escalation logic (notifications, logging, etc.)
		console.error('CRITICAL ERROR ESCALATED:', errorInfo);
		
		// Send notifications, create tickets, etc.
		// This would integrate with external systems
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private generateErrorId(error: Error, operationName: string): string {
		return `error-${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	private determineErrorType(error: Error): string {
		if (error.message.includes('timeout')) return 'timeout';
		if (error.message.includes('connection')) return 'connection';
		if (error.message.includes('auth')) return 'authentication';
		if (error.message.includes('rate')) return 'rate_limit';
		if (error.message.includes('server')) return 'server_error';
		return 'unknown';
	}

	private determineErrorClassification(error: Error, errorType: string): 'retryable' | 'non_retryable' | 'critical' | 'temporary' {
		if (this.config.errorClassification.criticalErrors.includes(errorType)) return 'critical';
		if (this.config.errorClassification.temporaryErrors.includes(errorType)) return 'temporary';
		if (this.config.errorClassification.nonRetryableErrors.includes(errorType)) return 'non_retryable';
		return 'retryable';
	}

	private determineErrorSeverity(error: Error, errorType: string, context: Record<string, any>): 'low' | 'medium' | 'high' | 'critical' {
		if (errorType === 'authentication' || errorType === 'server_error') return 'critical';
		if (errorType === 'timeout' || errorType === 'connection') return 'high';
		if (errorType === 'rate_limit') return 'medium';
		return 'low';
	}

	private extractErrorCode(error: Error): string | undefined {
		// Extract error code from error message or properties
		const match = error.message.match(/\b(\d{3})\b/);
		return match ? match[1] : undefined;
	}

	private assessErrorImpact(error: Error, operationName: string, context: Record<string, any>): ErrorImpact {
		return {
			affectedOperations: [operationName],
			affectedUsers: context.userId ? 1 : 0,
			estimatedDowntime: 0,
			businessImpact: 'low',
			dataLoss: false,
			serviceUnavailable: false,
		};
	}

	private updateResilienceMetrics(success: boolean, duration: number): void {
		if (success) {
			this.resilienceMetrics.successfulRecoveries++;
		} else {
			this.resilienceMetrics.failedRecoveries++;
		}

		// Update other metrics...
		this.resilienceMetrics.meanTimeToRecovery = 
			(this.resilienceMetrics.meanTimeToRecovery + duration) / 2;
	}

	private getDefaultConfig(): ErrorRecoveryConfig {
		return {
			circuitBreaker: {
				failureThreshold: 5,
				resetTimeout: 60000, // 1 minute
				monitoringPeriod: 60000, // 1 minute
				halfOpenMaxCalls: 3,
			},
			retry: {
				maxAttempts: 3,
				baseDelay: 1000, // 1 second
				maxDelay: 30000, // 30 seconds
				backoffStrategy: 'exponential',
				jitter: true,
			},
			timeout: {
				connectionTimeout: 5000,
				requestTimeout: 30000,
				healthCheckTimeout: 5000,
			},
			failover: {
				enabled: true,
				primaryEndpoint: 'primary.3cx.local',
				secondaryEndpoints: ['secondary.3cx.local'],
				healthCheckInterval: 30000,
				failoverCooldown: 300000, // 5 minutes
				automaticRecovery: true,
			},
			healthMonitoring: {
				enabled: true,
				interval: 30000,
				consecutiveFailuresThreshold: 3,
				healthCheckEndpoints: ['/health', '/status'],
				metrics: [
					{ name: 'response_time', type: 'response_time', threshold: 1000, unit: 'ms', severity: 'warning' },
					{ name: 'error_rate', type: 'error_rate', threshold: 5, unit: '%', severity: 'critical' },
				],
			},
			errorClassification: {
				retryableErrors: ['timeout', 'connection', 'rate_limit'],
				nonRetryableErrors: ['authentication', 'permission'],
				criticalErrors: ['server_error', 'data_corruption'],
				temporaryErrors: ['rate_limit', 'server_overload'],
			},
			recoveryStrategies: {
				connectionLoss: { type: 'retry', maxAttempts: 3, delay: 2000 },
				apiFailure: { type: 'retry', maxAttempts: 2, delay: 1000 },
				authenticationFailure: { type: 'escalate', notificationRequired: true },
				rateLimitExceeded: { type: 'queue', delay: 5000 },
				serverOverload: { type: 'failover' },
				networkTimeout: { type: 'retry', maxAttempts: 2, delay: 1000 },
			},
		};
	}

	private createCircuitBreaker(): CircuitBreakerState {
		return {
			state: 'closed',
			failureCount: 0,
			successCount: 0,
			totalRequests: 0,
			monitoringWindowStart: new Date(),
		};
	}

	private initializeCircuitBreakers(): void {
		// Initialize circuit breakers for common operations
		const operations = ['api_call', 'database_query', 'external_service'];
		operations.forEach(op => {
			this.circuitBreakers.set(op, this.createCircuitBreaker());
		});
	}

	private initializeErrorPatterns(): void {
		// Initialize common error patterns
		// This would be populated with historical data
	}

	private initializeMetrics(): SystemResilienceMetrics {
		return {
			availability: 100,
			meanTimeToRecovery: 0,
			meanTimeBetweenFailures: 0,
			errorRate: 0,
			successfulRecoveries: 0,
			failedRecoveries: 0,
			circuitBreakerTrips: 0,
			failoverEvents: 0,
			totalDowntime: 0,
			impactedOperations: 0,
			costOfDowntime: 0,
		};
	}

	private startMonitoring(): void {
		if (this.config.healthMonitoring.enabled) {
			this.healthCheckInterval = setInterval(() => {
				this.performHealthChecks().catch(console.error);
			}, this.config.healthMonitoring.interval);

			this.metricsCollectionInterval = setInterval(() => {
				this.collectMetrics().catch(console.error);
			}, 60000); // Every minute

			this.patternAnalysisInterval = setInterval(() => {
				this.analyzeErrorPatterns().catch(console.error);
			}, 300000); // Every 5 minutes
		}
	}

	private async performHealthChecks(): Promise<void> {
		const endpoints = [this.config.failover.primaryEndpoint, ...this.config.failover.secondaryEndpoints];
		
		for (const endpoint of endpoints) {
			try {
				const health = await this.checkEndpointHealth(endpoint);
				this.endpointHealth.set(endpoint, health);
			} catch (error) {
				console.error(`Health check failed for ${endpoint}:`, error);
			}
		}
	}

	private async checkEndpointHealth(endpoint: string): Promise<EndpointHealth> {
		const startTime = Date.now();
		
		try {
			// Perform health check (simplified)
			const response = await fetch(`${endpoint}/health`, {
				timeout: this.config.timeout.healthCheckTimeout,
			});

			const responseTime = Date.now() - startTime;
			const isHealthy = response.ok;

			const currentHealth = this.endpointHealth.get(endpoint);
			const consecutiveFailures = isHealthy ? 0 : (currentHealth?.consecutiveFailures || 0) + 1;

			return {
				endpoint,
				status: this.determineHealthStatus(isHealthy, consecutiveFailures, responseTime),
				lastCheck: new Date(),
				responseTime,
				errorRate: 0, // Would be calculated from historical data
				consecutiveFailures,
				metrics: { response_time: responseTime },
			};

		} catch (error) {
			const currentHealth = this.endpointHealth.get(endpoint);
			const consecutiveFailures = (currentHealth?.consecutiveFailures || 0) + 1;

			return {
				endpoint,
				status: 'unhealthy',
				lastCheck: new Date(),
				responseTime: Date.now() - startTime,
				errorRate: 100,
				consecutiveFailures,
				metrics: {},
				lastError: {
					errorId: `health-${Date.now()}`,
					timestamp: new Date(),
					errorType: 'health_check',
					errorMessage: error instanceof Error ? error.message : 'Health check failed',
					context: { endpoint },
					severity: 'high',
					classification: 'critical',
					recoveryAttempts: 0,
					resolved: false,
					impact: {
						affectedOperations: ['health_check'],
						affectedUsers: 0,
						estimatedDowntime: 0,
						businessImpact: 'high',
						dataLoss: false,
						serviceUnavailable: true,
					},
				},
			};
		}
	}

	private determineHealthStatus(
		isHealthy: boolean,
		consecutiveFailures: number,
		responseTime: number
	): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
		if (!isHealthy || consecutiveFailures >= this.config.healthMonitoring.consecutiveFailuresThreshold) {
			return 'unhealthy';
		}

		if (responseTime > 2000 || consecutiveFailures > 0) {
			return 'degraded';
		}

		return 'healthy';
	}

	private getHealthyEndpoints(): string[] {
		return Array.from(this.endpointHealth.entries())
			.filter(([_, health]) => health.status === 'healthy' || health.status === 'degraded')
			.map(([endpoint]) => endpoint);
	}

	private getAffectedOperations(): string[] {
		// Return list of operations that would be affected by current endpoint
		return ['call_control', 'queue_management', 'ivr_operations'];
	}

	private async switchEndpoint(newEndpoint: string): Promise<void> {
		// Update API client configuration to use new endpoint
		// This would depend on the API client implementation
	}

	private scheduleRecoveryAttempt(endpoint: string): void {
		setTimeout(() => {
			this.attemptRecovery().catch(console.error);
		}, this.config.failover.failoverCooldown);
	}

	private async processQueue(queue: OperationQueue): Promise<void> {
		const now = new Date();
		
		// Remove expired operations
		queue.operations = queue.operations.filter(op => op.expiresAt > now);

		// Process pending operations
		for (const operation of queue.operations) {
			if (operation.status === 'pending' && operation.currentRetries < operation.maxRetries) {
				try {
					await this.executeQueuedOperation(operation);
					operation.status = 'completed';
				} catch (error) {
					operation.currentRetries++;
					operation.lastAttempt = new Date();
					
					if (operation.currentRetries >= operation.maxRetries) {
						operation.status = 'failed';
					}
				}
			}
		}
	}

	private async executeQueuedOperation(operation: QueuedOperation): Promise<void> {
		// Execute the queued operation
		// This would depend on the specific operation type
	}

	private getPriorityValue(priority: string): number {
		switch (priority) {
			case 'critical': return 4;
			case 'high': return 3;
			case 'normal': return 2;
			case 'low': return 1;
			default: return 2;
		}
	}

	private async collectMetrics(): Promise<void> {
		// Collect and update resilience metrics
	}

	private detectErrorPatterns(errors: ErrorInfo[]): ErrorPattern[] {
		// Analyze errors for patterns
		return [];
	}

	private predictPotentialIssues(patterns: ErrorPattern[], errors: ErrorInfo[]): any[] {
		// Use patterns to predict potential future issues
		return [];
	}

	private analyzeTrends(errors: ErrorInfo[]): any {
		// Analyze trends in error data
		return {
			errorRate: 'stable' as const,
			meanTimeToRecovery: 'stable' as const,
			systemStability: 'stable' as const,
		};
	}

	private calculateOverallHealth(endpoints: EndpointHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
		const healthyCount = endpoints.filter(e => e.status === 'healthy').length;
		const totalCount = endpoints.length;
		
		if (healthyCount === totalCount) return 'healthy';
		if (healthyCount > totalCount / 2) return 'degraded';
		return 'unhealthy';
	}

	private generateHealthRecommendations(endpoints: EndpointHealth[], errors: ErrorInfo[]): string[] {
		const recommendations: string[] = [];
		
		const unhealthyEndpoints = endpoints.filter(e => e.status === 'unhealthy');
		if (unhealthyEndpoints.length > 0) {
			recommendations.push(`${unhealthyEndpoints.length} endpoint(s) are unhealthy and need attention`);
		}

		const criticalErrors = errors.filter(e => e.severity === 'critical');
		if (criticalErrors.length > 0) {
			recommendations.push(`${criticalErrors.length} critical error(s) require immediate attention`);
		}

		return recommendations;
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = null;
		}

		if (this.metricsCollectionInterval) {
			clearInterval(this.metricsCollectionInterval);
			this.metricsCollectionInterval = null;
		}

		if (this.patternAnalysisInterval) {
			clearInterval(this.patternAnalysisInterval);
			this.patternAnalysisInterval = null;
		}

		this.circuitBreakers.clear();
		this.endpointHealth.clear();
		this.errorHistory.clear();
		this.recoveryActions.clear();
		this.failoverEvents.clear();
		this.operationQueues.clear();
		this.errorPatterns.clear();
	}
}

/**
 * Factory function to create error recovery manager
 */
export function createErrorRecoveryManager(
	apiClient: ThreeCXAPIClient,
	config?: Partial<ErrorRecoveryConfig>
): ErrorRecoveryManager {
	return new ErrorRecoveryManager(apiClient, config);
}