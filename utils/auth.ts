/**
 * Authentication Manager for 3CX Call Control API
 * Handles Bearer token lifecycle with automatic refresh
 */

import { ConnectionConfig, APIError } from '../types';

export interface TokenInfo {
	token: string;
	expiresAt: Date;
	refreshAt: Date;
	scope?: string;
}

export interface AuthenticationResult {
	success: boolean;
	token?: TokenInfo;
	error?: APIError;
}

export class AuthenticationManager {
	private baseUrl: string;
	private clientId: string;
	private apiSecret: string;
	private currentToken: TokenInfo | null = null;
	private refreshTimer: NodeJS.Timeout | null = null;
	private readonly TOKEN_REFRESH_BUFFER_MINUTES = 5;
	private readonly DEFAULT_TOKEN_LIFETIME_MINUTES = 60;
	private refreshPromise: Promise<AuthenticationResult> | null = null;

	constructor(config: ConnectionConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
		this.clientId = config.clientId;
		this.apiSecret = config.apiSecret;
	}

	/**
	 * Get current valid Bearer token, refreshing if necessary
	 */
	async getValidToken(): Promise<string> {
		// If no token exists, authenticate
		if (!this.currentToken) {
			const result = await this.authenticate();
			if (!result.success || !result.token) {
				throw new Error(`Authentication failed: ${result.error?.message || 'Unknown error'}`);
			}
			return result.token.token;
		}

		// If token is still valid and not due for refresh, return it
		const now = new Date();
		if (now < this.currentToken.refreshAt) {
			return this.currentToken.token;
		}

		// Token needs refresh
		if (this.refreshPromise) {
			// Refresh already in progress, wait for it
			const result = await this.refreshPromise;
			if (!result.success || !result.token) {
				throw new Error(`Token refresh failed: ${result.error?.message || 'Unknown error'}`);
			}
			return result.token.token;
		}

		// Initiate refresh
		this.refreshPromise = this.refreshToken();
		try {
			const result = await this.refreshPromise;
			if (!result.success || !result.token) {
				throw new Error(`Token refresh failed: ${result.error?.message || 'Unknown error'}`);
			}
			return result.token.token;
		} finally {
			this.refreshPromise = null;
		}
	}

	/**
	 * Initial authentication to get Bearer token
	 */
	async authenticate(): Promise<AuthenticationResult> {
		try {
			const response = await fetch(`${this.baseUrl}/callcontrol/auth/token`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
				},
				body: JSON.stringify({
					client_id: this.clientId,
					client_secret: this.apiSecret,
					grant_type: 'client_credentials',
					scope: 'call_control'
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: {
						code: response.status,
						message: data.error_description || data.error || 'Authentication failed',
						details: data
					}
				};
			}

			const token = this.parseTokenResponse(data);
			this.setCurrentToken(token);
			this.scheduleTokenRefresh();

			return {
				success: true,
				token
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: 0,
					message: error instanceof Error ? error.message : 'Network error during authentication',
					details: { originalError: error }
				}
			};
		}
	}

	/**
	 * Refresh existing Bearer token
	 */
	async refreshToken(): Promise<AuthenticationResult> {
		if (!this.currentToken) {
			return this.authenticate();
		}

		try {
			const response = await fetch(`${this.baseUrl}/callcontrol/auth/refresh`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Authorization': `Bearer ${this.currentToken.token}`
				},
				body: JSON.stringify({
					client_id: this.clientId,
					grant_type: 'refresh_token'
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				// If refresh fails with 401/403, try full authentication
				if (response.status === 401 || response.status === 403) {
					return this.authenticate();
				}

				return {
					success: false,
					error: {
						code: response.status,
						message: data.error_description || data.error || 'Token refresh failed',
						details: data
					}
				};
			}

			const token = this.parseTokenResponse(data);
			this.setCurrentToken(token);
			this.scheduleTokenRefresh();

			return {
				success: true,
				token
			};
		} catch (error) {
			// On network error, try full authentication
			return this.authenticate();
		}
	}

	/**
	 * Parse token response from 3CX API
	 */
	private parseTokenResponse(data: any): TokenInfo {
		const now = new Date();
		const expiresInSeconds = data.expires_in || this.DEFAULT_TOKEN_LIFETIME_MINUTES * 60;
		const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);
		const refreshAt = new Date(now.getTime() + (expiresInSeconds - this.TOKEN_REFRESH_BUFFER_MINUTES * 60) * 1000);

		return {
			token: data.access_token,
			expiresAt,
			refreshAt,
			scope: data.scope
		};
	}

	/**
	 * Set current token and clear any existing refresh timer
	 */
	private setCurrentToken(token: TokenInfo): void {
		this.currentToken = token;
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	/**
	 * Schedule automatic token refresh
	 */
	private scheduleTokenRefresh(): void {
		if (!this.currentToken) return;

		const now = new Date();
		const refreshIn = this.currentToken.refreshAt.getTime() - now.getTime();

		if (refreshIn > 0) {
			this.refreshTimer = setTimeout(async () => {
				try {
					await this.refreshToken();
				} catch (error) {
					console.error('Automatic token refresh failed:', error);
				}
			}, refreshIn);
		}
	}

	/**
	 * Check if current token is valid (not expired)
	 */
	isTokenValid(): boolean {
		if (!this.currentToken) return false;
		return new Date() < this.currentToken.expiresAt;
	}

	/**
	 * Check if token needs refresh (within buffer window)
	 */
	needsRefresh(): boolean {
		if (!this.currentToken) return true;
		return new Date() >= this.currentToken.refreshAt;
	}

	/**
	 * Get current token info (for debugging/monitoring)
	 */
	getTokenInfo(): TokenInfo | null {
		return this.currentToken ? { ...this.currentToken } : null;
	}

	/**
	 * Force token invalidation (will require new authentication)
	 */
	invalidateToken(): void {
		this.currentToken = null;
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
		this.refreshPromise = null;
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.invalidateToken();
	}
}

/**
 * Factory function to create authentication manager
 */
export function createAuthenticationManager(config: ConnectionConfig): AuthenticationManager {
	return new AuthenticationManager(config);
}

/**
 * Utility function to validate connection configuration
 */
export function validateConnectionConfig(config: Partial<ConnectionConfig>): string[] {
	const errors: string[] = [];

	if (!config.baseUrl) {
		errors.push('baseUrl is required');
	} else if (!config.baseUrl.startsWith('https://')) {
		errors.push('baseUrl must use HTTPS protocol');
	}

	if (!config.clientId) {
		errors.push('clientId is required');
	}

	if (!config.apiSecret) {
		errors.push('apiSecret is required');
	}

	return errors;
}