/**
 * 3CX API Client with HTTP/2 connection pooling and advanced error handling
 * Implements rate limiting, retry logic, and circuit breaker patterns
 */

import { AuthenticationManager } from './auth';
import { ConnectionConfig, APIResponse, APIError } from '../types';

export interface RequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	headers?: Record<string, string>;
	body?: any;
	timeout?: number;
	retries?: number;
	retryDelay?: number;
	priority?: 'low' | 'normal' | 'high';
}

export interface RateLimitInfo {
	limit: number;
	remaining: number;
	resetTime: Date;
}

export interface CircuitBreakerState {
	state: 'closed' | 'open' | 'half-open';
	failureCount: number;
	lastFailureTime: Date | null;
	nextAttemptTime: Date | null;
}

export class ThreeCXAPIClient {
	private authManager: AuthenticationManager;
	private baseUrl: string;
	private defaultTimeout: number;
	private defaultRetries: number;
	private defaultRetryDelay: number;
	
	// Rate limiting
	private rateLimitInfo: RateLimitInfo | null = null;
	private requestQueue: Array<{ resolve: Function; reject: Function; request: () => Promise<any> }> = [];
	private isProcessingQueue = false;
	
	// Circuit breaker
	private circuitBreaker: CircuitBreakerState = {
		state: 'closed',
		failureCount: 0,
		lastFailureTime: null,
		nextAttemptTime: null,
	};
	private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
	private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
	private readonly CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS = 3;
	
	// Connection management
	private readonly keepAliveAgent: any;

	constructor(config: ConnectionConfig, authManager: AuthenticationManager) {
		this.authManager = authManager;
		this.baseUrl = config.baseUrl.replace(/\/$/, '');
		this.defaultTimeout = config.timeout || 30000;
		this.defaultRetries = config.retryAttempts || 3;
		this.defaultRetryDelay = config.retryDelay || 1000;

		// Create HTTP/2 agent with keep-alive for Node.js environments
		if (typeof window === 'undefined') {
			const http2 = require('http2');
			this.keepAliveAgent = new http2.Agent({
				keepAlive: true,
				keepAliveMsecs: 30000,
				maxSockets: 10,
				maxFreeSockets: 5,
			});
		}
	}

	/**
	 * Make API request with full error handling and retry logic
	 */
	async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<APIResponse<T>> {
		// Check circuit breaker
		if (this.circuitBreaker.state === 'open') {
			if (this.circuitBreaker.nextAttemptTime && new Date() < this.circuitBreaker.nextAttemptTime) {
				throw new Error('Circuit breaker is open - API temporarily unavailable');
			}
			// Transition to half-open
			this.circuitBreaker.state = 'half-open';
		}

		// Queue request if rate limited
		if (this.shouldQueueRequest()) {
			return this.queueRequest(() => this.executeRequest<T>(endpoint, options));
		}

		return this.executeRequest<T>(endpoint, options);
	}

	/**
	 * Execute the actual HTTP request
	 */
	private async executeRequest<T>(endpoint: string, options: RequestOptions): Promise<APIResponse<T>> {
		const {
			method = 'GET',
			headers = {},
			body,
			timeout = this.defaultTimeout,
			retries = this.defaultRetries,
			retryDelay = this.defaultRetryDelay,
		} = options;

		const url = `${this.baseUrl}/callcontrol${endpoint}`;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				// Get valid authentication token
				const token = await this.authManager.getValidToken();

				// Prepare request options
				const requestHeaders = {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'User-Agent': 'n8n-3cx-call-control/1.0.0',
					...headers,
				};

				const requestOptions: RequestInit = {
					method,
					headers: requestHeaders,
					signal: AbortSignal.timeout(timeout),
				};

				// Add body for non-GET requests
				if (body && method !== 'GET') {
					requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
				}

				// Add HTTP/2 agent if available
				if (this.keepAliveAgent) {
					(requestOptions as any).agent = this.keepAliveAgent;
				}

				// Make the request
				const response = await fetch(url, requestOptions);

				// Update rate limit info from headers
				this.updateRateLimitInfo(response);

				// Handle different response statuses
				const result = await this.handleResponse<T>(response);

				// Success - reset circuit breaker
				this.onRequestSuccess();

				return result;

			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				
				// Check if this is a retryable error
				if (!this.isRetryableError(lastError) || attempt === retries) {
					this.onRequestFailure(lastError);
					break;
				}

				// Wait before retry with exponential backoff
				const delay = retryDelay * Math.pow(2, attempt);
				await this.sleep(delay);
			}
		}

		// All retries exhausted
		this.onRequestFailure(lastError!);
		
		return {
			success: false,
			error: {
				code: 0,
				message: lastError!.message,
				details: { attempts: retries + 1 }
			},
			timestamp: new Date(),
		};
	}

	/**
	 * Handle HTTP response and parse result
	 */
	private async handleResponse<T>(response: Response): Promise<APIResponse<T>> {
		const timestamp = new Date();

		try {
			// Check for rate limiting
			if (response.status === 429) {
				const retryAfter = response.headers.get('Retry-After');
				const resetTime = retryAfter 
					? new Date(Date.now() + parseInt(retryAfter) * 1000)
					: new Date(Date.now() + 60000); // Default 1 minute

				throw new Error(`Rate limited. Retry after: ${resetTime.toISOString()}`);
			}

			// Parse response body
			let data: any = null;
			const contentType = response.headers.get('content-type');
			
			if (contentType?.includes('application/json')) {
				try {
					data = await response.json();
				} catch (parseError) {
					// If JSON parsing fails but status is ok, return success with no data
					if (response.ok) {
						return { success: true, timestamp };
					}
					throw new Error('Invalid JSON response');
				}
			} else if (contentType?.includes('text/')) {
				data = await response.text();
			}

			// Handle successful responses
			if (response.ok) {
				return {
					success: true,
					data: data as T,
					timestamp,
				};
			}

			// Handle error responses
			const error: APIError = {
				code: response.status,
				message: this.getErrorMessage(response.status, data),
				details: { 
					status: response.status,
					statusText: response.statusText,
					data 
				}
			};

			return {
				success: false,
				error,
				timestamp,
			};

		} catch (error) {
			return {
				success: false,
				error: {
					code: response.status,
					message: error instanceof Error ? error.message : 'Unknown error',
					details: { status: response.status }
				},
				timestamp,
			};
		}
	}

	/**
	 * Get human-readable error message based on status code
	 */
	private getErrorMessage(status: number, data: any): string {
		switch (status) {
			case 400:
				return data?.message || 'Bad request - invalid parameters';
			case 401:
				return 'Authentication failed - invalid credentials';
			case 403:
				return 'Access forbidden - insufficient permissions';
			case 404:
				return data?.message || 'Resource not found';
			case 409:
				return data?.message || 'Conflict - resource already exists or is in use';
			case 422:
				return data?.message || 'Validation failed - invalid data';
			case 429:
				return 'Rate limit exceeded - too many requests';
			case 500:
				return 'Internal server error - 3CX server error';
			case 502:
				return 'Bad gateway - 3CX server is unavailable';
			case 503:
				return 'Service unavailable - 3CX server is temporarily down';
			case 504:
				return 'Gateway timeout - 3CX server response timeout';
			default:
				return data?.message || `HTTP ${status} error`;
		}
	}

	/**
	 * Check if error is retryable
	 */
	private isRetryableError(error: Error): boolean {
		// Network errors are retryable
		if (error.name === 'AbortError' || error.message.includes('fetch')) {
			return true;
		}

		// Rate limiting is retryable
		if (error.message.includes('Rate limited')) {
			return true;
		}

		// 5xx server errors are retryable
		if (error.message.includes('500') || 
			error.message.includes('502') || 
			error.message.includes('503') || 
			error.message.includes('504')) {
			return true;
		}

		return false;
	}

	/**
	 * Update rate limit information from response headers
	 */
	private updateRateLimitInfo(response: Response): void {
		const limit = response.headers.get('X-RateLimit-Limit');
		const remaining = response.headers.get('X-RateLimit-Remaining');
		const reset = response.headers.get('X-RateLimit-Reset');

		if (limit && remaining && reset) {
			this.rateLimitInfo = {
				limit: parseInt(limit),
				remaining: parseInt(remaining),
				resetTime: new Date(parseInt(reset) * 1000),
			};
		}
	}

	/**
	 * Check if request should be queued due to rate limiting
	 */
	private shouldQueueRequest(): boolean {
		if (!this.rateLimitInfo) return false;
		
		const now = new Date();
		
		// If rate limit has reset, clear the info
		if (now >= this.rateLimitInfo.resetTime) {
			this.rateLimitInfo = null;
			return false;
		}

		// Queue if no remaining requests
		return this.rateLimitInfo.remaining <= 0;
	}

	/**
	 * Queue request for later execution
	 */
	private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			this.requestQueue.push({ resolve, reject, request });
			this.processQueue();
		});
	}

	/**
	 * Process queued requests
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessingQueue || this.requestQueue.length === 0) return;
		
		this.isProcessingQueue = true;

		while (this.requestQueue.length > 0) {
			// Wait for rate limit reset if needed
			if (this.rateLimitInfo && new Date() < this.rateLimitInfo.resetTime) {
				const waitTime = this.rateLimitInfo.resetTime.getTime() - Date.now();
				await this.sleep(waitTime);
				this.rateLimitInfo = null; // Reset after waiting
			}

			const { resolve, reject, request } = this.requestQueue.shift()!;
			
			try {
				const result = await request();
				resolve(result);
			} catch (error) {
				reject(error);
			}

			// Check if we need to queue more requests
			if (this.shouldQueueRequest()) {
				break;
			}
		}

		this.isProcessingQueue = false;
	}

	/**
	 * Handle successful request for circuit breaker
	 */
	private onRequestSuccess(): void {
		if (this.circuitBreaker.state === 'half-open' || this.circuitBreaker.failureCount > 0) {
			this.circuitBreaker = {
				state: 'closed',
				failureCount: 0,
				lastFailureTime: null,
				nextAttemptTime: null,
			};
		}
	}

	/**
	 * Handle failed request for circuit breaker
	 */
	private onRequestFailure(error: Error): void {
		this.circuitBreaker.failureCount++;
		this.circuitBreaker.lastFailureTime = new Date();

		if (this.circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
			this.circuitBreaker.state = 'open';
			this.circuitBreaker.nextAttemptTime = new Date(Date.now() + this.CIRCUIT_BREAKER_TIMEOUT);
		}
	}

	/**
	 * Get current circuit breaker state (for monitoring)
	 */
	getCircuitBreakerState(): CircuitBreakerState {
		return { ...this.circuitBreaker };
	}

	/**
	 * Get current rate limit info (for monitoring)
	 */
	getRateLimitInfo(): RateLimitInfo | null {
		return this.rateLimitInfo ? { ...this.rateLimitInfo } : null;
	}

	/**
	 * Sleep utility function
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Health check endpoint
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const response = await this.request('/health', { 
				timeout: 5000,
				retries: 1 
			});
			return response.success;
		} catch {
			return false;
		}
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		// Clear request queue
		this.requestQueue.forEach(({ reject }) => {
			reject(new Error('API client destroyed'));
		});
		this.requestQueue = [];

		// Reset circuit breaker
		this.circuitBreaker = {
			state: 'closed',
			failureCount: 0,
			lastFailureTime: null,
			nextAttemptTime: null,
		};

		// Clear rate limit info
		this.rateLimitInfo = null;
	}
}

/**
 * Factory function to create API client
 */
export function createAPIClient(config: ConnectionConfig, authManager: AuthenticationManager): ThreeCXAPIClient {
	return new ThreeCXAPIClient(config, authManager);
}