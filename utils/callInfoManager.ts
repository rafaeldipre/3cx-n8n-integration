/**
 * Call Information Manager Service for 3CX Call Monitoring and Data Retrieval
 * Handles call history, active calls, statistics, and real-time monitoring
 */

import { ThreeCXAPIClient } from './apiClient';
import {
	CallInfo,
	CallEvent,
	CallHistoryFilter,
	CallHistoryResponse,
	ActiveCallsResponse,
	CallStatistics,
	ExtensionInfo,
	CallEventData,
	PaginationOptions,
} from '../types';

export interface CallInfoManagerConfig {
	/** Enable real-time event monitoring */
	enableRealTimeMonitoring?: boolean;
	/** Default pagination limit */
	defaultPageLimit?: number;
	/** Event polling interval in milliseconds */
	eventPollingInterval?: number;
	/** Enable detailed logging */
	enableLogging?: boolean;
	/** Cache timeout for static data in milliseconds */
	cacheTimeout?: number;
}

export interface EventSubscription {
	subscriptionId: string;
	eventTypes: string[];
	callback: (event: CallEvent) => void;
	filter?: EventFilter;
	isActive: boolean;
}

export interface EventFilter {
	extension?: string;
	callDirection?: 'inbound' | 'outbound' | 'internal';
	eventTypes?: string[];
}

export interface CallInfoStats {
	totalCalls: number;
	activeCalls: number;
	callsToday: number;
	averageResponseTime: number;
	lastUpdate: Date;
}

export class CallInfoManager {
	private apiClient: ThreeCXAPIClient;
	private config: CallInfoManagerConfig;
	private eventSubscriptions = new Map<string, EventSubscription>();
	private subscriptionCounter = 0;
	private pollingTimer: NodeJS.Timeout | null = null;
	private lastEventTimestamp: Date | null = null;
	private extensionCache = new Map<string, { data: ExtensionInfo; timestamp: Date }>();

	constructor(apiClient: ThreeCXAPIClient, config: CallInfoManagerConfig = {}) {
		this.apiClient = apiClient;
		this.config = {
			enableRealTimeMonitoring: true,
			defaultPageLimit: 50,
			eventPollingInterval: 5000,
			enableLogging: false,
			cacheTimeout: 300000, // 5 minutes
			...config
		};

		if (this.config.enableRealTimeMonitoring) {
			this.startEventMonitoring();
		}
	}

	/**
	 * Get call history with filtering and pagination
	 */
	async getCallHistory(filter: CallHistoryFilter = {}): Promise<CallHistoryResponse> {
		const {
			startDate,
			endDate,
			extension,
			direction,
			status,
			phoneNumber,
			did,
			minDuration,
			maxDuration,
			hasRecording,
			offset = 0,
			limit = this.config.defaultPageLimit,
		} = filter;

		const queryParams = new URLSearchParams();
		
		if (startDate) queryParams.append('start_date', startDate.toISOString());
		if (endDate) queryParams.append('end_date', endDate.toISOString());
		if (extension) queryParams.append('extension', extension);
		if (direction) queryParams.append('direction', direction);
		if (status) queryParams.append('status', status);
		if (phoneNumber) queryParams.append('phone_number', phoneNumber);
		if (did) queryParams.append('did', did);
		if (minDuration !== undefined) queryParams.append('min_duration', minDuration.toString());
		if (maxDuration !== undefined) queryParams.append('max_duration', maxDuration.toString());
		if (hasRecording !== undefined) queryParams.append('has_recording', hasRecording.toString());
		queryParams.append('offset', offset.toString());
		queryParams.append('limit', limit!.toString());

		const response = await this.apiClient.request<CallHistoryResponse>(
			`/history/calls?${queryParams.toString()}`,
			{
				method: 'GET',
				timeout: 30000,
			}
		);

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to retrieve call history');
		}

		// Process call data to ensure proper date parsing
		const processedCalls = response.data!.calls.map(call => ({
			...call,
			startTime: new Date(call.startTime),
			endTime: call.endTime ? new Date(call.endTime) : undefined,
		}));

		return {
			...response.data!,
			calls: processedCalls,
		};
	}

	/**
	 * Get currently active calls
	 */
	async getActiveCalls(extension?: string): Promise<ActiveCallsResponse> {
		const queryParams = new URLSearchParams();
		if (extension) queryParams.append('extension', extension);

		const response = await this.apiClient.request<ActiveCallsResponse>(
			`/calls/active?${queryParams.toString()}`,
			{
				method: 'GET',
				timeout: 15000,
			}
		);

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to retrieve active calls');
		}

		// Process call data to ensure proper date parsing
		const processedCalls = response.data!.calls.map(call => ({
			...call,
			startTime: new Date(call.startTime),
			endTime: call.endTime ? new Date(call.endTime) : undefined,
		}));

		return {
			...response.data!,
			calls: processedCalls,
			timestamp: new Date(),
		};
	}

	/**
	 * Get specific call information by ID
	 */
	async getCallInfo(callId: string): Promise<CallInfo> {
		const response = await this.apiClient.request<CallInfo>(`/calls/${callId}`, {
			method: 'GET',
			timeout: 10000,
		});

		if (!response.success) {
			if (response.error?.code === 404) {
				throw new Error(`Call ${callId} not found or has ended`);
			}
			throw new Error(response.error?.message || 'Failed to retrieve call information');
		}

		// Process dates
		const callInfo = response.data!;
		return {
			...callInfo,
			startTime: new Date(callInfo.startTime),
			endTime: callInfo.endTime ? new Date(callInfo.endTime) : undefined,
		};
	}

	/**
	 * Get call statistics for a period
	 */
	async getCallStatistics(
		startDate: Date,
		endDate: Date,
		extension?: string
	): Promise<CallStatistics> {
		const queryParams = new URLSearchParams();
		queryParams.append('start_date', startDate.toISOString());
		queryParams.append('end_date', endDate.toISOString());
		if (extension) queryParams.append('extension', extension);

		const response = await this.apiClient.request<CallStatistics>(
			`/statistics/calls?${queryParams.toString()}`,
			{
				method: 'GET',
				timeout: 30000,
			}
		);

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to retrieve call statistics');
		}

		return {
			...response.data!,
			period: {
				startDate: new Date(response.data!.period.startDate),
				endDate: new Date(response.data!.period.endDate),
			},
		};
	}

	/**
	 * Get extension information with caching
	 */
	async getExtensionInfo(extension: string, useCache = true): Promise<ExtensionInfo> {
		// Check cache first
		if (useCache) {
			const cached = this.extensionCache.get(extension);
			if (cached && Date.now() - cached.timestamp.getTime() < this.config.cacheTimeout!) {
				return cached.data;
			}
		}

		const response = await this.apiClient.request<ExtensionInfo>(
			`/extensions/${extension}`,
			{
				method: 'GET',
				timeout: 10000,
			}
		);

		if (!response.success) {
			if (response.error?.code === 404) {
				throw new Error(`Extension ${extension} not found`);
			}
			throw new Error(response.error?.message || 'Failed to retrieve extension information');
		}

		// Cache the result
		this.extensionCache.set(extension, {
			data: response.data!,
			timestamp: new Date(),
		});

		return response.data!;
	}

	/**
	 * Get all extensions
	 */
	async getAllExtensions(includeOffline = false): Promise<ExtensionInfo[]> {
		const queryParams = new URLSearchParams();
		if (!includeOffline) queryParams.append('status', 'online');

		const response = await this.apiClient.request<{ extensions: ExtensionInfo[] }>(
			`/extensions?${queryParams.toString()}`,
			{
				method: 'GET',
				timeout: 15000,
			}
		);

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to retrieve extensions');
		}

		return response.data!.extensions;
	}

	/**
	 * Subscribe to real-time call events
	 */
	subscribeToEvents(
		eventTypes: string[],
		callback: (event: CallEvent) => void,
		filter?: EventFilter
	): string {
		const subscriptionId = `sub-${++this.subscriptionCounter}-${Date.now()}`;

		const subscription: EventSubscription = {
			subscriptionId,
			eventTypes,
			callback,
			filter,
			isActive: true,
		};

		this.eventSubscriptions.set(subscriptionId, subscription);

		if (this.config.enableLogging) {
			console.log(`Event subscription created: ${subscriptionId} for events: ${eventTypes.join(', ')}`);
		}

		return subscriptionId;
	}

	/**
	 * Unsubscribe from events
	 */
	unsubscribeFromEvents(subscriptionId: string): boolean {
		const subscription = this.eventSubscriptions.get(subscriptionId);
		if (!subscription) return false;

		subscription.isActive = false;
		this.eventSubscriptions.delete(subscriptionId);

		if (this.config.enableLogging) {
			console.log(`Event subscription removed: ${subscriptionId}`);
		}

		return true;
	}

	/**
	 * Start real-time event monitoring
	 */
	private startEventMonitoring(): void {
		if (this.pollingTimer) return;

		this.pollingTimer = setInterval(async () => {
			try {
				await this.pollForEvents();
			} catch (error) {
				if (this.config.enableLogging) {
					console.error('Event polling error:', error);
				}
			}
		}, this.config.eventPollingInterval);

		if (this.config.enableLogging) {
			console.log(`Event monitoring started with ${this.config.eventPollingInterval}ms interval`);
		}
	}

	/**
	 * Stop real-time event monitoring
	 */
	stopEventMonitoring(): void {
		if (this.pollingTimer) {
			clearInterval(this.pollingTimer);
			this.pollingTimer = null;

			if (this.config.enableLogging) {
				console.log('Event monitoring stopped');
			}
		}
	}

	/**
	 * Poll for new events
	 */
	private async pollForEvents(): Promise<void> {
		if (this.eventSubscriptions.size === 0) return;

		const queryParams = new URLSearchParams();
		if (this.lastEventTimestamp) {
			queryParams.append('since', this.lastEventTimestamp.toISOString());
		}

		const response = await this.apiClient.request<{ events: CallEvent[] }>(
			`/events?${queryParams.toString()}`,
			{
				method: 'GET',
				timeout: 10000,
				retries: 1, // Fewer retries for polling
			}
		);

		if (!response.success) {
			// Don't throw errors for polling failures, just log them
			if (this.config.enableLogging) {
				console.warn('Failed to poll for events:', response.error?.message);
			}
			return;
		}

		const events = response.data?.events || [];
		
		for (const event of events) {
			// Process event timestamp
			const processedEvent: CallEvent = {
				...event,
				timestamp: new Date(event.timestamp),
			};

			// Update last event timestamp
			if (!this.lastEventTimestamp || processedEvent.timestamp > this.lastEventTimestamp) {
				this.lastEventTimestamp = processedEvent.timestamp;
			}

			// Notify subscribers
			this.notifySubscribers(processedEvent);
		}
	}

	/**
	 * Notify event subscribers
	 */
	private notifySubscribers(event: CallEvent): void {
		for (const subscription of this.eventSubscriptions.values()) {
			if (!subscription.isActive) continue;

			// Check if subscription is interested in this event type
			if (!subscription.eventTypes.includes(event.eventType)) continue;

			// Apply filters
			if (subscription.filter) {
				if (subscription.filter.extension && subscription.filter.extension !== event.extension) {
					continue;
				}

				if (subscription.filter.callDirection) {
					const callData = event.data as any;
					if (callData.direction && callData.direction !== subscription.filter.callDirection) {
						continue;
					}
				}

				if (subscription.filter.eventTypes && !subscription.filter.eventTypes.includes(event.eventType)) {
					continue;
				}
			}

			try {
				subscription.callback(event);
			} catch (error) {
				if (this.config.enableLogging) {
					console.error(`Error in event callback for subscription ${subscription.subscriptionId}:`, error);
				}
			}
		}
	}

	/**
	 * Generate call report
	 */
	async generateCallReport(
		startDate: Date,
		endDate: Date,
		options: {
			extension?: string;
			includeDetails?: boolean;
			groupBy?: 'day' | 'hour' | 'extension';
		} = {}
	): Promise<{
		summary: CallStatistics;
		details?: CallInfo[];
		groupedData?: Record<string, CallStatistics>;
	}> {
		// Get statistics
		const summary = await this.getCallStatistics(startDate, endDate, options.extension);

		const result: any = { summary };

		// Include detailed call data if requested
		if (options.includeDetails) {
			const callHistory = await this.getCallHistory({
				startDate,
				endDate,
				extension: options.extension,
				limit: 1000, // Large limit for reports
			});
			result.details = callHistory.calls;
		}

		// Group data if requested
		if (options.groupBy) {
			result.groupedData = await this.generateGroupedStatistics(
				startDate,
				endDate,
				options.groupBy,
				options.extension
			);
		}

		return result;
	}

	/**
	 * Generate grouped statistics
	 */
	private async generateGroupedStatistics(
		startDate: Date,
		endDate: Date,
		groupBy: 'day' | 'hour' | 'extension',
		extension?: string
	): Promise<Record<string, CallStatistics>> {
		// This would typically make multiple API calls to get grouped data
		// For now, we'll return a placeholder implementation
		const queryParams = new URLSearchParams();
		queryParams.append('start_date', startDate.toISOString());
		queryParams.append('end_date', endDate.toISOString());
		queryParams.append('group_by', groupBy);
		if (extension) queryParams.append('extension', extension);

		const response = await this.apiClient.request<Record<string, CallStatistics>>(
			`/statistics/calls/grouped?${queryParams.toString()}`,
			{
				method: 'GET',
				timeout: 45000,
			}
		);

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to generate grouped statistics');
		}

		return response.data!;
	}

	/**
	 * Get current service statistics
	 */
	getServiceStats(): CallInfoStats {
		return {
			totalCalls: 0, // Would be tracked internally
			activeCalls: 0, // Would be tracked internally
			callsToday: 0, // Would be tracked internally
			averageResponseTime: 0, // Would be tracked internally
			lastUpdate: new Date(),
		};
	}

	/**
	 * Get active subscriptions (for monitoring)
	 */
	getActiveSubscriptions(): EventSubscription[] {
		return Array.from(this.eventSubscriptions.values()).filter(sub => sub.isActive);
	}

	/**
	 * Clear extension cache
	 */
	clearCache(): void {
		this.extensionCache.clear();
		if (this.config.enableLogging) {
			console.log('Extension cache cleared');
		}
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.stopEventMonitoring();
		this.eventSubscriptions.clear();
		this.clearCache();
	}
}

/**
 * Factory function to create call info manager
 */
export function createCallInfoManager(
	apiClient: ThreeCXAPIClient,
	config?: CallInfoManagerConfig
): CallInfoManager {
	return new CallInfoManager(apiClient, config);
}