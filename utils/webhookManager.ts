/**
 * Advanced Webhook Manager for 3CX Real-time Event Notifications
 * Provides instant event notifications through webhooks with advanced features
 */

import { ThreeCXAPIClient } from './apiClient';
import { CallEvent, CallInfo, ConnectionConfig } from '../types';

export interface WebhookSubscription {
	subscriptionId: string;
	name: string;
	webhookUrl: string;
	eventTypes: string[];
	filters: WebhookFilter;
	authentication: WebhookAuth;
	delivery: WebhookDeliverySettings;
	status: 'active' | 'paused' | 'failed' | 'disabled';
	createdAt: Date;
	lastDelivery?: Date;
	failureCount: number;
	successCount: number;
	totalEvents: number;
	metadata: Record<string, any>;
}

export interface WebhookFilter {
	/** Filter by extension(s) */
	extensions?: string[];
	/** Filter by call direction */
	directions?: ('inbound' | 'outbound' | 'internal')[];
	/** Filter by call status */
	statuses?: string[];
	/** Filter by phone number patterns */
	phoneNumberPatterns?: string[];
	/** Filter by DID patterns */
	didPatterns?: string[];
	/** Minimum call duration to include */
	minDuration?: number;
	/** Maximum call duration to include */
	maxDuration?: number;
	/** Time-based filters */
	timeFilters?: {
		startTime?: string; // HH:MM format
		endTime?: string;   // HH:MM format
		daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
		timezone?: string;
	};
	/** Custom filter expressions */
	customFilters?: {
		field: string;
		operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'gt' | 'lt';
		value: any;
	}[];
}

export interface WebhookAuth {
	type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth2' | 'hmac';
	credentials: {
		username?: string;
		password?: string;
		token?: string;
		apiKey?: string;
		secret?: string;
		clientId?: string;
		clientSecret?: string;
		tokenUrl?: string;
	};
	headers?: Record<string, string>;
}

export interface WebhookDeliverySettings {
	/** Retry attempts on failure */
	retryAttempts: number;
	/** Retry backoff strategy */
	retryBackoff: 'linear' | 'exponential' | 'fixed';
	/** Initial retry delay in seconds */
	retryDelay: number;
	/** Maximum retry delay in seconds */
	maxRetryDelay: number;
	/** Timeout for webhook delivery */
	timeout: number;
	/** Enable delivery confirmation */
	requireConfirmation: boolean;
	/** Batch delivery settings */
	batching?: {
		enabled: boolean;
		maxBatchSize: number;
		maxWaitTime: number; // seconds
		flushOnTypes?: string[]; // Event types that trigger immediate flush
	};
	/** Rate limiting */
	rateLimit?: {
		maxRequestsPerSecond: number;
		maxRequestsPerMinute: number;
	};
	/** Content compression */
	compression?: 'none' | 'gzip' | 'deflate';
	/** Custom headers */
	customHeaders?: Record<string, string>;
}

export interface WebhookEvent {
	eventId: string;
	subscriptionId: string;
	timestamp: Date;
	eventType: string;
	callId: string;
	extension: string;
	data: any;
	metadata: {
		source: string;
		version: string;
		sequence: number;
		correlationId?: string;
	};
}

export interface WebhookDeliveryAttempt {
	attemptId: string;
	subscriptionId: string;
	eventId: string;
	webhookUrl: string;
	attempt: number;
	timestamp: Date;
	status: 'pending' | 'success' | 'failure' | 'timeout';
	httpStatus?: number;
	responseTime?: number;
	errorMessage?: string;
	responseBody?: string;
	nextRetryAt?: Date;
}

export interface WebhookBatch {
	batchId: string;
	subscriptionId: string;
	events: WebhookEvent[];
	createdAt: Date;
	deliveredAt?: Date;
	status: 'pending' | 'delivered' | 'failed';
}

export interface WebhookTemplate {
	templateId: string;
	name: string;
	description: string;
	eventTypes: string[];
	filters: WebhookFilter;
	delivery: WebhookDeliverySettings;
	isDefault: boolean;
	createdAt: Date;
}

export interface WebhookStatistics {
	subscriptionId: string;
	period: {
		startDate: Date;
		endDate: Date;
	};
	totalEvents: number;
	deliveredEvents: number;
	failedEvents: number;
	averageResponseTime: number;
	deliveryRate: number;
	errorRate: number;
	topEventTypes: { eventType: string; count: number }[];
	topErrorTypes: { error: string; count: number }[];
	throughput: {
		eventsPerHour: number;
		peakHour: Date;
		peakEvents: number;
	};
}

export class WebhookManager {
	private apiClient: ThreeCXAPIClient;
	private subscriptions = new Map<string, WebhookSubscription>();
	private pendingEvents = new Map<string, WebhookEvent[]>();
	private deliveryAttempts = new Map<string, WebhookDeliveryAttempt[]>();
	private webhookBatches = new Map<string, WebhookBatch>();
	private templates = new Map<string, WebhookTemplate>();
	private subscriptionCounter = 0;
	private eventCounter = 0;
	private batchCounter = 0;

	// Processing queues
	private deliveryQueue: WebhookEvent[] = [];
	private retryQueue: WebhookDeliveryAttempt[] = [];
	private batchQueues = new Map<string, WebhookEvent[]>();

	// Timers
	private processingTimer: NodeJS.Timeout | null = null;
	private retryTimer: NodeJS.Timeout | null = null;
	private batchTimers = new Map<string, NodeJS.Timeout>();

	constructor(apiClient: ThreeCXAPIClient) {
		this.apiClient = apiClient;
		this.initializeDefaultTemplates();
		this.startProcessing();
	}

	/**
	 * Create webhook subscription
	 */
	async createWebhookSubscription(
		name: string,
		webhookUrl: string,
		eventTypes: string[],
		options: {
			filters?: Partial<WebhookFilter>;
			authentication?: Partial<WebhookAuth>;
			delivery?: Partial<WebhookDeliverySettings>;
			templateId?: string;
		} = {}
	): Promise<WebhookSubscription> {
		// Validate webhook URL
		if (!this.isValidUrl(webhookUrl)) {
			throw new Error('Invalid webhook URL');
		}

		const subscriptionId = `webhook-${++this.subscriptionCounter}-${Date.now()}`;

		// Use template if provided
		let settings: any = {};
		if (options.templateId) {
			const template = this.templates.get(options.templateId);
			if (template) {
				settings = {
					filters: template.filters,
					delivery: template.delivery,
				};
			}
		}

		const subscription: WebhookSubscription = {
			subscriptionId,
			name,
			webhookUrl,
			eventTypes,
			filters: { ...settings.filters, ...options.filters } || {},
			authentication: {
				type: 'none',
				credentials: {},
				...options.authentication,
			},
			delivery: {
				retryAttempts: 3,
				retryBackoff: 'exponential',
				retryDelay: 1,
				maxRetryDelay: 300,
				timeout: 30,
				requireConfirmation: false,
				...settings.delivery,
				...options.delivery,
			},
			status: 'active',
			createdAt: new Date(),
			failureCount: 0,
			successCount: 0,
			totalEvents: 0,
			metadata: {},
		};

		// Register webhook with 3CX
		const response = await this.apiClient.request('/webhooks/subscribe', {
			method: 'POST',
			body: {
				subscription_id: subscriptionId,
				webhook_url: webhookUrl,
				event_types: eventTypes,
				filters: subscription.filters,
				authentication: subscription.authentication,
				delivery_settings: subscription.delivery,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to create webhook subscription');
		}

		this.subscriptions.set(subscriptionId, subscription);

		// Initialize batch queue if batching is enabled
		if (subscription.delivery.batching?.enabled) {
			this.batchQueues.set(subscriptionId, []);
		}

		return subscription;
	}

	/**
	 * Update webhook subscription
	 */
	async updateWebhookSubscription(
		subscriptionId: string,
		updates: {
			name?: string;
			webhookUrl?: string;
			eventTypes?: string[];
			filters?: Partial<WebhookFilter>;
			authentication?: Partial<WebhookAuth>;
			delivery?: Partial<WebhookDeliverySettings>;
			status?: 'active' | 'paused' | 'disabled';
		}
	): Promise<WebhookSubscription> {
		const subscription = this.subscriptions.get(subscriptionId);
		if (!subscription) {
			throw new Error(`Webhook subscription ${subscriptionId} not found`);
		}

		// Apply updates
		if (updates.name) subscription.name = updates.name;
		if (updates.webhookUrl) {
			if (!this.isValidUrl(updates.webhookUrl)) {
				throw new Error('Invalid webhook URL');
			}
			subscription.webhookUrl = updates.webhookUrl;
		}
		if (updates.eventTypes) subscription.eventTypes = updates.eventTypes;
		if (updates.filters) subscription.filters = { ...subscription.filters, ...updates.filters };
		if (updates.authentication) subscription.authentication = { ...subscription.authentication, ...updates.authentication };
		if (updates.delivery) subscription.delivery = { ...subscription.delivery, ...updates.delivery };
		if (updates.status) subscription.status = updates.status;

		// Update webhook with 3CX
		const response = await this.apiClient.request(`/webhooks/${subscriptionId}`, {
			method: 'PUT',
			body: {
				webhook_url: subscription.webhookUrl,
				event_types: subscription.eventTypes,
				filters: subscription.filters,
				authentication: subscription.authentication,
				delivery_settings: subscription.delivery,
				status: subscription.status,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to update webhook subscription');
		}

		return subscription;
	}

	/**
	 * Delete webhook subscription
	 */
	async deleteWebhookSubscription(subscriptionId: string): Promise<void> {
		const subscription = this.subscriptions.get(subscriptionId);
		if (!subscription) {
			throw new Error(`Webhook subscription ${subscriptionId} not found`);
		}

		// Unregister webhook from 3CX
		const response = await this.apiClient.request(`/webhooks/${subscriptionId}`, {
			method: 'DELETE',
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to delete webhook subscription');
		}

		// Clean up local data
		this.subscriptions.delete(subscriptionId);
		this.pendingEvents.delete(subscriptionId);
		this.batchQueues.delete(subscriptionId);
		
		// Clear batch timer
		const batchTimer = this.batchTimers.get(subscriptionId);
		if (batchTimer) {
			clearTimeout(batchTimer);
			this.batchTimers.delete(subscriptionId);
		}
	}

	/**
	 * Process incoming webhook event
	 */
	async processIncomingEvent(
		eventType: string,
		callId: string,
		extension: string,
		eventData: any,
		correlationId?: string
	): Promise<void> {
		const eventId = `event-${++this.eventCounter}-${Date.now()}`;
		
		const webhookEvent: WebhookEvent = {
			eventId,
			subscriptionId: '', // Will be set for each subscription
			timestamp: new Date(),
			eventType,
			callId,
			extension,
			data: eventData,
			metadata: {
				source: '3cx-n8n',
				version: '2.0.0',
				sequence: this.eventCounter,
				correlationId,
			},
		};

		// Process for each active subscription
		for (const subscription of this.subscriptions.values()) {
			if (subscription.status !== 'active') continue;

			// Check if subscription is interested in this event type
			if (!subscription.eventTypes.includes(eventType)) continue;

			// Apply filters
			if (!this.passesFilters(webhookEvent, subscription.filters)) continue;

			// Create subscription-specific event
			const subscriptionEvent: WebhookEvent = {
				...webhookEvent,
				subscriptionId: subscription.subscriptionId,
			};

			// Handle batching
			if (subscription.delivery.batching?.enabled) {
				this.addToBatch(subscription.subscriptionId, subscriptionEvent);
			} else {
				// Add to delivery queue
				this.deliveryQueue.push(subscriptionEvent);
			}

			subscription.totalEvents++;
		}
	}

	/**
	 * Add event to batch
	 */
	private addToBatch(subscriptionId: string, event: WebhookEvent): void {
		const subscription = this.subscriptions.get(subscriptionId);
		if (!subscription || !subscription.delivery.batching?.enabled) return;

		let batchQueue = this.batchQueues.get(subscriptionId);
		if (!batchQueue) {
			batchQueue = [];
			this.batchQueues.set(subscriptionId, batchQueue);
		}

		batchQueue.push(event);

		const batchSettings = subscription.delivery.batching;

		// Check if batch should be flushed immediately
		const shouldFlushImmediate = batchSettings.flushOnTypes?.includes(event.eventType);
		const shouldFlushSize = batchQueue.length >= batchSettings.maxBatchSize;

		if (shouldFlushImmediate || shouldFlushSize) {
			this.flushBatch(subscriptionId);
		} else {
			// Set/reset batch timer
			this.setBatchTimer(subscriptionId);
		}
	}

	/**
	 * Set batch timer for delayed flush
	 */
	private setBatchTimer(subscriptionId: string): void {
		const subscription = this.subscriptions.get(subscriptionId);
		if (!subscription?.delivery.batching?.enabled) return;

		// Clear existing timer
		const existingTimer = this.batchTimers.get(subscriptionId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Set new timer
		const timer = setTimeout(() => {
			this.flushBatch(subscriptionId);
		}, subscription.delivery.batching.maxWaitTime * 1000);

		this.batchTimers.set(subscriptionId, timer);
	}

	/**
	 * Flush batch for subscription
	 */
	private flushBatch(subscriptionId: string): void {
		const batchQueue = this.batchQueues.get(subscriptionId);
		if (!batchQueue || batchQueue.length === 0) return;

		const batchId = `batch-${++this.batchCounter}-${Date.now()}`;
		const batch: WebhookBatch = {
			batchId,
			subscriptionId,
			events: [...batchQueue],
			createdAt: new Date(),
			status: 'pending',
		};

		// Clear the queue
		batchQueue.length = 0;

		// Clear timer
		const timer = this.batchTimers.get(subscriptionId);
		if (timer) {
			clearTimeout(timer);
			this.batchTimers.delete(subscriptionId);
		}

		// Store batch and add to delivery queue
		this.webhookBatches.set(batchId, batch);
		
		// Create a single event representing the batch
		const batchEvent: WebhookEvent = {
			eventId: `batch-${batchId}`,
			subscriptionId,
			timestamp: batch.createdAt,
			eventType: 'batch',
			callId: '',
			extension: '',
			data: {
				batchId,
				eventCount: batch.events.length,
				events: batch.events,
			},
			metadata: {
				source: '3cx-n8n',
				version: '2.0.0',
				sequence: this.eventCounter++,
				correlationId: batchId,
			},
		};

		this.deliveryQueue.push(batchEvent);
	}

	/**
	 * Check if event passes subscription filters
	 */
	private passesFilters(event: WebhookEvent, filters: WebhookFilter): boolean {
		// Extension filter
		if (filters.extensions && filters.extensions.length > 0) {
			if (!filters.extensions.includes(event.extension)) return false;
		}

		// Direction filter
		if (filters.directions && filters.directions.length > 0) {
			const direction = event.data.direction;
			if (direction && !filters.directions.includes(direction)) return false;
		}

		// Status filter
		if (filters.statuses && filters.statuses.length > 0) {
			const status = event.data.status;
			if (status && !filters.statuses.includes(status)) return false;
		}

		// Phone number pattern filter
		if (filters.phoneNumberPatterns && filters.phoneNumberPatterns.length > 0) {
			const fromNumber = event.data.fromNumber || '';
			const toNumber = event.data.toNumber || '';
			const phoneNumber = `${fromNumber} ${toNumber}`;
			
			const matchesPattern = filters.phoneNumberPatterns.some(pattern => {
				const regex = new RegExp(pattern);
				return regex.test(phoneNumber);
			});
			
			if (!matchesPattern) return false;
		}

		// Duration filter
		if (filters.minDuration !== undefined || filters.maxDuration !== undefined) {
			const duration = event.data.duration;
			if (duration !== undefined) {
				if (filters.minDuration !== undefined && duration < filters.minDuration) return false;
				if (filters.maxDuration !== undefined && duration > filters.maxDuration) return false;
			}
		}

		// Time-based filters
		if (filters.timeFilters) {
			const eventTime = event.timestamp;
			const eventHour = eventTime.getHours();
			const eventMinute = eventTime.getMinutes();
			const eventDay = eventTime.getDay();

			// Check time range
			if (filters.timeFilters.startTime || filters.timeFilters.endTime) {
				const startTime = this.parseTime(filters.timeFilters.startTime || '00:00');
				const endTime = this.parseTime(filters.timeFilters.endTime || '23:59');
				const eventTimeMinutes = eventHour * 60 + eventMinute;

				if (eventTimeMinutes < startTime || eventTimeMinutes > endTime) return false;
			}

			// Check days of week
			if (filters.timeFilters.daysOfWeek && filters.timeFilters.daysOfWeek.length > 0) {
				if (!filters.timeFilters.daysOfWeek.includes(eventDay)) return false;
			}
		}

		// Custom filters
		if (filters.customFilters && filters.customFilters.length > 0) {
			for (const filter of filters.customFilters) {
				if (!this.evaluateCustomFilter(event, filter)) return false;
			}
		}

		return true;
	}

	/**
	 * Parse time string (HH:MM) to minutes
	 */
	private parseTime(timeStr: string): number {
		const [hours, minutes] = timeStr.split(':').map(Number);
		return hours * 60 + minutes;
	}

	/**
	 * Evaluate custom filter
	 */
	private evaluateCustomFilter(event: WebhookEvent, filter: any): boolean {
		const fieldValue = this.getFieldValue(event, filter.field);
		const filterValue = filter.value;

		switch (filter.operator) {
			case 'equals':
				return fieldValue === filterValue;
			case 'contains':
				return String(fieldValue).includes(String(filterValue));
			case 'startsWith':
				return String(fieldValue).startsWith(String(filterValue));
			case 'endsWith':
				return String(fieldValue).endsWith(String(filterValue));
			case 'regex':
				const regex = new RegExp(filterValue);
				return regex.test(String(fieldValue));
			case 'gt':
				return Number(fieldValue) > Number(filterValue);
			case 'lt':
				return Number(fieldValue) < Number(filterValue);
			default:
				return true;
		}
	}

	/**
	 * Get field value from event using dot notation
	 */
	private getFieldValue(event: WebhookEvent, fieldPath: string): any {
		const paths = fieldPath.split('.');
		let value: any = event;

		for (const path of paths) {
			if (value && typeof value === 'object' && path in value) {
				value = value[path];
			} else {
				return undefined;
			}
		}

		return value;
	}

	/**
	 * Start processing timers
	 */
	private startProcessing(): void {
		// Process delivery queue every 100ms
		this.processingTimer = setInterval(() => {
			this.processDeliveryQueue();
		}, 100);

		// Process retry queue every 5 seconds
		this.retryTimer = setInterval(() => {
			this.processRetryQueue();
		}, 5000);
	}

	/**
	 * Process delivery queue
	 */
	private async processDeliveryQueue(): Promise<void> {
		if (this.deliveryQueue.length === 0) return;

		const event = this.deliveryQueue.shift();
		if (!event) return;

		const subscription = this.subscriptions.get(event.subscriptionId);
		if (!subscription || subscription.status !== 'active') return;

		await this.deliverWebhook(event, subscription);
	}

	/**
	 * Process retry queue
	 */
	private async processRetryQueue(): Promise<void> {
		const now = new Date();
		const readyToRetry = this.retryQueue.filter(attempt => 
			attempt.nextRetryAt && attempt.nextRetryAt <= now
		);

		for (const attempt of readyToRetry) {
			// Remove from retry queue
			const index = this.retryQueue.indexOf(attempt);
			if (index !== -1) {
				this.retryQueue.splice(index, 1);
			}

			// Create new event for retry
			const subscription = this.subscriptions.get(attempt.subscriptionId);
			if (subscription && subscription.status === 'active') {
				const retryEvent: WebhookEvent = {
					eventId: attempt.eventId,
					subscriptionId: attempt.subscriptionId,
					timestamp: new Date(),
					eventType: 'retry',
					callId: '',
					extension: '',
					data: { originalAttemptId: attempt.attemptId },
					metadata: {
						source: '3cx-n8n',
						version: '2.0.0',
						sequence: this.eventCounter++,
						correlationId: attempt.eventId,
					},
				};

				await this.deliverWebhook(retryEvent, subscription, attempt.attempt + 1);
			}
		}
	}

	/**
	 * Deliver webhook to endpoint
	 */
	private async deliverWebhook(
		event: WebhookEvent,
		subscription: WebhookSubscription,
		attemptNumber: number = 1
	): Promise<void> {
		const attemptId = `attempt-${Date.now()}-${attemptNumber}`;
		const startTime = Date.now();

		const attempt: WebhookDeliveryAttempt = {
			attemptId,
			subscriptionId: subscription.subscriptionId,
			eventId: event.eventId,
			webhookUrl: subscription.webhookUrl,
			attempt: attemptNumber,
			timestamp: new Date(),
			status: 'pending',
		};

		try {
			// Prepare headers
			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
				'User-Agent': '3CX-n8n-Webhook/2.0',
				'X-Event-Type': event.eventType,
				'X-Event-ID': event.eventId,
				'X-Subscription-ID': subscription.subscriptionId,
				'X-Timestamp': event.timestamp.toISOString(),
				'X-Attempt': attemptNumber.toString(),
				...subscription.delivery.customHeaders,
				...subscription.authentication.headers,
			};

			// Add authentication headers
			if (subscription.authentication.type === 'bearer' && subscription.authentication.credentials.token) {
				headers['Authorization'] = `Bearer ${subscription.authentication.credentials.token}`;
			} else if (subscription.authentication.type === 'api_key' && subscription.authentication.credentials.apiKey) {
				headers['X-API-Key'] = subscription.authentication.credentials.apiKey;
			} else if (subscription.authentication.type === 'basic' && subscription.authentication.credentials.username) {
				const auth = Buffer.from(
					`${subscription.authentication.credentials.username}:${subscription.authentication.credentials.password || ''}`
				).toString('base64');
				headers['Authorization'] = `Basic ${auth}`;
			}

			// Prepare payload
			let payload = JSON.stringify(event);

			// Apply compression if enabled
			if (subscription.delivery.compression === 'gzip') {
				// In a real implementation, you would compress the payload
				headers['Content-Encoding'] = 'gzip';
			}

			// Make HTTP request
			const response = await fetch(subscription.webhookUrl, {
				method: 'POST',
				headers,
				body: payload,
				signal: AbortSignal.timeout(subscription.delivery.timeout * 1000),
			});

			const responseTime = Date.now() - startTime;
			const responseBody = await response.text();

			attempt.httpStatus = response.status;
			attempt.responseTime = responseTime;
			attempt.responseBody = responseBody.substring(0, 1000); // Limit response body size

			if (response.ok) {
				// Success
				attempt.status = 'success';
				subscription.successCount++;
				subscription.lastDelivery = new Date();
				subscription.failureCount = 0; // Reset failure count on success
			} else {
				// HTTP error
				attempt.status = 'failure';
				attempt.errorMessage = `HTTP ${response.status}: ${response.statusText}`;
				this.handleDeliveryFailure(event, subscription, attempt, attemptNumber);
			}

		} catch (error) {
			// Network or timeout error
			const responseTime = Date.now() - startTime;
			attempt.responseTime = responseTime;
			attempt.status = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'failure';
			attempt.errorMessage = error instanceof Error ? error.message : 'Unknown error';
			
			this.handleDeliveryFailure(event, subscription, attempt, attemptNumber);
		}

		// Store delivery attempt
		let attempts = this.deliveryAttempts.get(event.eventId);
		if (!attempts) {
			attempts = [];
			this.deliveryAttempts.set(event.eventId, attempts);
		}
		attempts.push(attempt);
	}

	/**
	 * Handle delivery failure and schedule retry
	 */
	private handleDeliveryFailure(
		event: WebhookEvent,
		subscription: WebhookSubscription,
		attempt: WebhookDeliveryAttempt,
		attemptNumber: number
	): void {
		subscription.failureCount++;

		// Check if we should retry
		if (attemptNumber < subscription.delivery.retryAttempts) {
			// Calculate next retry time
			let delay = subscription.delivery.retryDelay;
			
			switch (subscription.delivery.retryBackoff) {
				case 'exponential':
					delay = Math.min(delay * Math.pow(2, attemptNumber - 1), subscription.delivery.maxRetryDelay);
					break;
				case 'linear':
					delay = Math.min(delay * attemptNumber, subscription.delivery.maxRetryDelay);
					break;
				case 'fixed':
				default:
					delay = subscription.delivery.retryDelay;
					break;
			}

			attempt.nextRetryAt = new Date(Date.now() + delay * 1000);
			this.retryQueue.push(attempt);
		} else {
			// Max retries exceeded
			if (subscription.failureCount >= 10) {
				// Disable subscription after 10 consecutive failures
				subscription.status = 'failed';
			}
		}
	}

	/**
	 * Validate URL format
	 */
	private isValidUrl(url: string): boolean {
		try {
			const parsedUrl = new URL(url);
			return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
		} catch {
			return false;
		}
	}

	/**
	 * Initialize default templates
	 */
	private initializeDefaultTemplates(): void {
		const templates: WebhookTemplate[] = [
			{
				templateId: 'standard',
				name: 'Standard Events',
				description: 'Basic call events with standard delivery',
				eventTypes: ['call_started', 'call_answered', 'call_ended'],
				filters: {},
				delivery: {
					retryAttempts: 3,
					retryBackoff: 'exponential',
					retryDelay: 1,
					maxRetryDelay: 60,
					timeout: 30,
					requireConfirmation: false,
				},
				isDefault: true,
				createdAt: new Date(),
			},
			{
				templateId: 'high_volume',
				name: 'High Volume Batched',
				description: 'Batched delivery for high-volume environments',
				eventTypes: ['call_started', 'call_answered', 'call_ended', 'call_transferred'],
				filters: {},
				delivery: {
					retryAttempts: 5,
					retryBackoff: 'exponential',
					retryDelay: 2,
					maxRetryDelay: 300,
					timeout: 60,
					requireConfirmation: false,
					batching: {
						enabled: true,
						maxBatchSize: 100,
						maxWaitTime: 30,
						flushOnTypes: ['call_ended'],
					},
				},
				isDefault: false,
				createdAt: new Date(),
			},
		];

		templates.forEach(template => {
			this.templates.set(template.templateId, template);
		});
	}

	/**
	 * Get webhook statistics
	 */
	async getWebhookStatistics(
		subscriptionId: string,
		startDate: Date,
		endDate: Date
	): Promise<WebhookStatistics> {
		const subscription = this.subscriptions.get(subscriptionId);
		if (!subscription) {
			throw new Error(`Webhook subscription ${subscriptionId} not found`);
		}

		// In a real implementation, this would query a database
		// For now, return basic statistics from memory
		const stats: WebhookStatistics = {
			subscriptionId,
			period: { startDate, endDate },
			totalEvents: subscription.totalEvents,
			deliveredEvents: subscription.successCount,
			failedEvents: subscription.failureCount,
			averageResponseTime: 150, // Placeholder
			deliveryRate: subscription.totalEvents > 0 ? (subscription.successCount / subscription.totalEvents) * 100 : 0,
			errorRate: subscription.totalEvents > 0 ? (subscription.failureCount / subscription.totalEvents) * 100 : 0,
			topEventTypes: [],
			topErrorTypes: [],
			throughput: {
				eventsPerHour: 0,
				peakHour: startDate,
				peakEvents: 0,
			},
		};

		return stats;
	}

	/**
	 * Get subscription details
	 */
	getSubscription(subscriptionId: string): WebhookSubscription | undefined {
		return this.subscriptions.get(subscriptionId);
	}

	/**
	 * List all subscriptions
	 */
	getSubscriptions(): WebhookSubscription[] {
		return Array.from(this.subscriptions.values());
	}

	/**
	 * Get delivery attempts for an event
	 */
	getDeliveryAttempts(eventId: string): WebhookDeliveryAttempt[] {
		return this.deliveryAttempts.get(eventId) || [];
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		// Clear timers
		if (this.processingTimer) {
			clearInterval(this.processingTimer);
			this.processingTimer = null;
		}
		if (this.retryTimer) {
			clearInterval(this.retryTimer);
			this.retryTimer = null;
		}

		// Clear batch timers
		for (const timer of this.batchTimers.values()) {
			clearTimeout(timer);
		}

		// Clear data
		this.subscriptions.clear();
		this.pendingEvents.clear();
		this.deliveryAttempts.clear();
		this.webhookBatches.clear();
		this.batchQueues.clear();
		this.batchTimers.clear();
		this.deliveryQueue.length = 0;
		this.retryQueue.length = 0;
	}
}

/**
 * Factory function to create webhook manager
 */
export function createWebhookManager(apiClient: ThreeCXAPIClient): WebhookManager {
	return new WebhookManager(apiClient);
}