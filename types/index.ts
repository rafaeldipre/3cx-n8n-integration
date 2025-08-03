/**
 * Type definitions export for 3CX Call Control Integration
 */

// Call Information Types
export * from './callInfoTypes';

// Call Control Types  
export * from './callTypes';

// Common utility types
export interface APIError {
	code: number;
	message: string;
	details?: Record<string, any>;
}

export interface APIResponse<T = any> {
	success: boolean;
	data?: T;
	error?: APIError;
	timestamp: Date;
}

export interface PaginationOptions {
	offset?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
}

export interface ConnectionConfig {
	baseUrl: string;
	clientId: string;
	apiSecret: string;
	timeout?: number;
	retryAttempts?: number;
	retryDelay?: number;
}