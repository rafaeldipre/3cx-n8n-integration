/**
 * Call Manager Service for 3CX Direct Call Control Operations
 * Provides high-level interface for call control operations
 */

import { ThreeCXAPIClient } from './apiClient';
import {
	CallControlRequest,
	CallControlResponse,
	CallResponse,
	AnswerCallRequest,
	HangupCallRequest,
	TransferCallRequest,
	ParkCallRequest,
	HoldCallRequest,
	ResumeCallRequest,
	ConferenceCallRequest,
	PlayAudioRequest,
	CollectDTMFRequest,
	DTMFResponse,
	AudioResponse,
	TransferResponse,
	ParkResponse,
	ConferenceResponse,
	BatchCallRequest,
	BatchCallResponse,
	CallControlCapabilities,
	CallOperation,
	TransferType,
	DTMFOptions,
	AudioOptions,
} from '../types';

export interface CallManagerConfig {
	/** Default extension for call operations */
	defaultExtension: string;
	/** Maximum concurrent operations */
	maxConcurrentOperations?: number;
	/** Default timeout for operations */
	defaultTimeout?: number;
	/** Enable detailed logging */
	enableLogging?: boolean;
}

export interface ActiveOperation {
	operationId: string;
	callId: string;
	operation: CallOperation;
	startTime: Date;
	promise: Promise<CallControlResponse>;
}

export class CallManager {
	private apiClient: ThreeCXAPIClient;
	private config: CallManagerConfig;
	private activeOperations = new Map<string, ActiveOperation>();
	private operationCounter = 0;

	constructor(apiClient: ThreeCXAPIClient, config: CallManagerConfig) {
		this.apiClient = apiClient;
		this.config = {
			maxConcurrentOperations: 50,
			defaultTimeout: 30000,
			enableLogging: false,
			...config
		};
	}

	/**
	 * Answer an incoming call
	 */
	async answerCall(callId: string, extension?: string): Promise<CallResponse> {
		const request: AnswerCallRequest = {
			callId,
			operation: 'answer',
			extension: extension || this.config.defaultExtension,
			timestamp: new Date(),
		};

		return this.executeOperation(request, async () => {
			const response = await this.apiClient.request<CallResponse>(`/calls/${callId}/answer`, {
				method: 'POST',
				body: { extension: request.extension },
				timeout: this.config.defaultTimeout,
			});

			if (!response.success) {
				throw new Error(response.error?.message || 'Failed to answer call');
			}

			return {
				result: 'success',
				success: true,
				callId,
				operation: 'answer',
				message: `Call ${callId} answered successfully by extension ${request.extension}`,
				timestamp: new Date(),
				data: response.data,
			};
		});
	}

	/**
	 * Hangup/terminate a call
	 */
	async hangupCall(callId: string, reason?: string): Promise<CallResponse> {
		const request: HangupCallRequest = {
			callId,
			operation: 'hangup',
			reason,
			timestamp: new Date(),
		};

		return this.executeOperation(request, async () => {
			const response = await this.apiClient.request<CallResponse>(`/calls/${callId}/hangup`, {
				method: 'POST',
				body: reason ? { reason } : undefined,
				timeout: this.config.defaultTimeout,
			});

			if (!response.success) {
				throw new Error(response.error?.message || 'Failed to hangup call');
			}

			return {
				result: 'success',
				success: true,
				callId,
				operation: 'hangup',
				message: `Call ${callId} terminated successfully${reason ? ` (${reason})` : ''}`,
				timestamp: new Date(),
				data: response.data,
			};
		});
	}

	/**
	 * Transfer a call to another extension or external number
	 */
	async transferCall(
		callId: string, 
		target: string, 
		transferType: TransferType = 'blind',
		announcement?: string
	): Promise<TransferResponse> {
		const request: TransferCallRequest = {
			callId,
			operation: 'transfer',
			target,
			transferType,
			announcement,
			timestamp: new Date(),
		};

		return this.executeOperation(request, async () => {
			const response = await this.apiClient.request<TransferResponse>(`/calls/${callId}/transfer`, {
				method: 'POST',
				body: {
					target,
					transfer_type: transferType,
					announcement,
				},
				timeout: this.config.defaultTimeout,
			});

			if (!response.success) {
				throw new Error(response.error?.message || 'Failed to transfer call');
			}

			const result: TransferResponse = {
				result: 'success',
				success: true,
				callId,
				operation: 'transfer',
				target,
				transferType,
				completed: true,
				message: `Call ${callId} transferred successfully to ${target}`,
				timestamp: new Date(),
				data: response.data,
				newCallId: response.data?.newCallId,
			};

			return result;
		}) as Promise<TransferResponse>;
	}

	/**
	 * Park a call for later retrieval
	 */
	async parkCall(callId: string, parkSlot?: string, timeout?: number): Promise<ParkResponse> {
		const request: ParkCallRequest = {
			callId,
			operation: 'park',
			parkSlot,
			timeout,
			timestamp: new Date(),
		};

		return this.executeOperation(request, async () => {
			const response = await this.apiClient.request<ParkResponse>(`/calls/${callId}/park`, {
				method: 'POST',
				body: {
					park_slot: parkSlot,
					timeout,
				},
				timeout: this.config.defaultTimeout,
			});

			if (!response.success) {
				throw new Error(response.error?.message || 'Failed to park call');
			}

			const result: ParkResponse = {
				result: 'success',
				success: true,
				callId,
				operation: 'park',
				parkSlot: response.data?.parkSlot || parkSlot || 'auto-assigned',
				timeout,
				retrievalCode: response.data?.retrievalCode,
				message: `Call ${callId} parked successfully at slot ${response.data?.parkSlot}`,
				timestamp: new Date(),
				data: response.data,
			};

			return result;
		}) as Promise<ParkResponse>;
	}

	/**
	 * Put a call on hold
	 */
	async holdCall(callId: string, musicOnHold = true): Promise<CallResponse> {
		const request: HoldCallRequest = {
			callId,
			operation: 'hold',
			musicOnHold,
			timestamp: new Date(),
		};

		return this.executeOperation(request, async () => {
			const response = await this.apiClient.request<CallResponse>(`/calls/${callId}/hold`, {
				method: 'POST',
				body: { music_on_hold: musicOnHold },
				timeout: this.config.defaultTimeout,
			});

			if (!response.success) {
				throw new Error(response.error?.message || 'Failed to hold call');
			}

			return {
				result: 'success',
				success: true,
				callId,
				operation: 'hold',
				message: `Call ${callId} placed on hold`,
				timestamp: new Date(),
				data: response.data,
			};
		});
	}

	/**
	 * Resume a call from hold
	 */
	async resumeCall(callId: string): Promise<CallResponse> {
		const request: ResumeCallRequest = {
			callId,
			operation: 'resume',
			timestamp: new Date(),
		};

		return this.executeOperation(request, async () => {
			const response = await this.apiClient.request<CallResponse>(`/calls/${callId}/resume`, {
				method: 'POST',
				timeout: this.config.defaultTimeout,
			});

			if (!response.success) {
				throw new Error(response.error?.message || 'Failed to resume call');
			}

			return {
				result: 'success',
				success: true,
				callId,
				operation: 'resume',
				message: `Call ${callId} resumed from hold`,
				timestamp: new Date(),
				data: response.data,
			};
		});
	}

	/**
	 * Add call to conference
	 */
	async conferenceCall(
		callId: string, 
		conferenceTarget: string, 
		action: 'join' | 'create' = 'join',
		pin?: string
	): Promise<ConferenceResponse> {
		const request: ConferenceCallRequest = {
			callId,
			operation: 'conference',
			conferenceTarget,
			action,
			pin,
			timestamp: new Date(),
		};

		return this.executeOperation(request, async () => {
			const response = await this.apiClient.request<ConferenceResponse>(`/calls/${callId}/conference`, {
				method: 'POST',
				body: {
					conference_target: conferenceTarget,
					action,
					pin,
				},
				timeout: this.config.defaultTimeout,
			});

			if (!response.success) {
				throw new Error(response.error?.message || 'Failed to add call to conference');
			}

			const result: ConferenceResponse = {
				result: 'success',
				success: true,
				callId,
				operation: 'conference',
				conferenceId: response.data?.conferenceId || conferenceTarget,
				conferenceRoom: response.data?.conferenceRoom || conferenceTarget,
				participantCount: response.data?.participantCount || 0,
				action,
				message: `Call ${callId} ${action === 'join' ? 'joined' : 'created'} conference ${conferenceTarget}`,
				timestamp: new Date(),
				data: response.data,
			};

			return result;
		}) as Promise<ConferenceResponse>;
	}

	/**
	 * Play audio file to caller
	 */
	async playAudio(callId: string, audioPath: string, options?: AudioOptions): Promise<AudioResponse> {
		const request: PlayAudioRequest = {
			callId,
			operation: 'play_audio',
			audioPath,
			options,
			timestamp: new Date(),
		};

		return this.executeOperation(request, async () => {
			const response = await this.apiClient.request<AudioResponse>(`/calls/${callId}/play`, {
				method: 'POST',
				body: {
					audio_path: audioPath,
					...options,
				},
				timeout: (options?.loop ? 60000 : this.config.defaultTimeout), // Longer timeout for looped audio
			});

			if (!response.success) {
				throw new Error(response.error?.message || 'Failed to play audio');
			}

			const result: AudioResponse = {
				result: 'success',
				success: true,
				callId,
				operation: 'play_audio',
				audioPath,
				completed: response.data?.completed || false,
				duration: response.data?.duration || 0,
				terminationReason: response.data?.terminationReason || 'completed',
				message: `Audio played successfully on call ${callId}`,
				timestamp: new Date(),
				data: response.data,
			};

			return result;
		}) as Promise<AudioResponse>;
	}

	/**
	 * Collect DTMF input from caller
	 */
	async collectDTMF(callId: string, options: DTMFOptions): Promise<DTMFResponse> {
		const request: CollectDTMFRequest = {
			callId,
			operation: 'collect_dtmf',
			options,
			timestamp: new Date(),
		};

		// Use longer timeout for DTMF collection
		const timeout = (options.timeout + (options.firstDigitTimeout || 0) + 5) * 1000;

		return this.executeOperation(request, async () => {
			const response = await this.apiClient.request<DTMFResponse>(`/calls/${callId}/dtmf`, {
				method: 'POST',
				body: {
					max_digits: options.maxDigits,
					timeout: options.timeout,
					terminator: options.terminator,
					play_prompt: options.playPrompt,
					min_digits: options.minDigits,
					inter_digit_timeout: options.interDigitTimeout,
					first_digit_timeout: options.firstDigitTimeout,
				},
				timeout,
			});

			if (!response.success) {
				throw new Error(response.error?.message || 'Failed to collect DTMF');
			}

			const result: DTMFResponse = {
				result: 'success',
				success: true,
				callId,
				operation: 'collect_dtmf',
				digits: response.data?.digits || '',
				completed: response.data?.completed || false,
				terminationReason: response.data?.terminationReason || 'timeout',
				duration: response.data?.duration || 0,
				message: `DTMF collection completed for call ${callId}`,
				timestamp: new Date(),
				data: response.data,
			};

			return result;
		}) as Promise<DTMFResponse>;
	}

	/**
	 * Execute multiple operations in batch
	 */
	async batchOperations(request: BatchCallRequest): Promise<BatchCallResponse> {
		const startTime = Date.now();
		const responses: CallControlResponse[] = [];
		let successCount = 0;
		let errorCount = 0;

		if (request.executionMode === 'parallel') {
			// Execute all operations in parallel
			const promises = request.operations.map(async (operation) => {
				try {
					const response = await this.executeOperationByType(operation);
					responses.push(response);
					successCount++;
					return response;
				} catch (error) {
					const errorResponse: CallResponse = {
						result: 'error',
						success: false,
						callId: operation.callId,
						operation: operation.operation,
						message: error instanceof Error ? error.message : 'Unknown error',
						timestamp: new Date(),
						error: {
							code: 'BATCH_OPERATION_FAILED',
							message: error instanceof Error ? error.message : 'Unknown error',
						},
					};
					responses.push(errorResponse);
					errorCount++;
					return errorResponse;
				}
			});

			await Promise.all(promises);
		} else {
			// Execute operations in sequence
			for (const operation of request.operations) {
				try {
					const response = await this.executeOperationByType(operation);
					responses.push(response);
					successCount++;
				} catch (error) {
					const errorResponse: CallResponse = {
						result: 'error',
						success: false,
						callId: operation.callId,
						operation: operation.operation,
						message: error instanceof Error ? error.message : 'Unknown error',
						timestamp: new Date(),
						error: {
							code: 'BATCH_OPERATION_FAILED',
							message: error instanceof Error ? error.message : 'Unknown error',
						},
					};
					responses.push(errorResponse);
					errorCount++;

					// Stop on error if configured
					if (request.stopOnError) {
						break;
					}
				}
			}
		}

		const executionTime = Date.now() - startTime;

		return {
			responses,
			success: errorCount === 0,
			successCount,
			errorCount,
			executionTime,
		};
	}

	/**
	 * Execute operation by type (helper for batch operations)
	 */
	private async executeOperationByType(operation: CallControlRequest): Promise<CallControlResponse> {
		switch (operation.operation) {
			case 'answer':
				return this.answerCall(operation.callId, (operation as AnswerCallRequest).extension);
			case 'hangup':
				return this.hangupCall(operation.callId, (operation as HangupCallRequest).reason);
			case 'transfer':
				const transferOp = operation as TransferCallRequest;
				return this.transferCall(operation.callId, transferOp.target, transferOp.transferType, transferOp.announcement);
			case 'park':
				const parkOp = operation as ParkCallRequest;
				return this.parkCall(operation.callId, parkOp.parkSlot, parkOp.timeout);
			case 'hold':
				return this.holdCall(operation.callId, (operation as HoldCallRequest).musicOnHold);
			case 'resume':
				return this.resumeCall(operation.callId);
			case 'conference':
				const confOp = operation as ConferenceCallRequest;
				return this.conferenceCall(operation.callId, confOp.conferenceTarget, confOp.action, confOp.pin);
			case 'play_audio':
				const audioOp = operation as PlayAudioRequest;
				return this.playAudio(operation.callId, audioOp.audioPath, audioOp.options);
			case 'collect_dtmf':
				return this.collectDTMF(operation.callId, (operation as CollectDTMFRequest).options);
			default:
				throw new Error(`Unsupported operation: ${operation.operation}`);
		}
	}

	/**
	 * Get call control capabilities for extension
	 */
	async getCapabilities(extension?: string): Promise<CallControlCapabilities> {
		const targetExtension = extension || this.config.defaultExtension;
		
		const response = await this.apiClient.request<CallControlCapabilities>(`/capabilities/${targetExtension}`, {
			method: 'GET',
			timeout: this.config.defaultTimeout,
		});

		if (!response.success) {
			// Return default capabilities if API doesn't support capabilities endpoint
			return {
				extension: targetExtension,
				availableOperations: ['answer', 'hangup', 'transfer', 'hold', 'resume'],
				maxConcurrentCalls: 10,
				supportedAudioFormats: ['wav', 'mp3'],
				dtmfSupport: true,
				conferenceSupport: true,
				transferSupport: {
					blind: true,
					attended: true,
					warm: false,
				},
			};
		}

		return response.data!;
	}

	/**
	 * Execute operation with concurrency control and monitoring
	 */
	private async executeOperation<T extends CallControlResponse>(
		request: CallControlRequest,
		executor: () => Promise<T>
	): Promise<T> {
		// Check concurrency limit
		if (this.activeOperations.size >= this.config.maxConcurrentOperations!) {
			throw new Error('Maximum concurrent operations limit reached');
		}

		const operationId = `${request.operation}-${++this.operationCounter}-${Date.now()}`;
		
		const activeOperation: ActiveOperation = {
			operationId,
			callId: request.callId,
			operation: request.operation,
			startTime: new Date(),
			promise: executor(),
		};

		this.activeOperations.set(operationId, activeOperation);

		try {
			const result = await activeOperation.promise;
			
			if (this.config.enableLogging) {
				const duration = Date.now() - activeOperation.startTime.getTime();
				console.log(`Operation ${request.operation} on call ${request.callId} completed in ${duration}ms`);
			}

			return result as T;
		} catch (error) {
			if (this.config.enableLogging) {
				const duration = Date.now() - activeOperation.startTime.getTime();
				console.error(`Operation ${request.operation} on call ${request.callId} failed after ${duration}ms:`, error);
			}
			throw error;
		} finally {
			this.activeOperations.delete(operationId);
		}
	}

	/**
	 * Get active operations (for monitoring)
	 */
	getActiveOperations(): ActiveOperation[] {
		return Array.from(this.activeOperations.values());
	}

	/**
	 * Cancel all active operations
	 */
	cancelAllOperations(): void {
		this.activeOperations.clear();
	}

	/**
	 * Get operation statistics
	 */
	getStats(): {
		activeOperations: number;
		maxConcurrent: number;
		defaultExtension: string;
	} {
		return {
			activeOperations: this.activeOperations.size,
			maxConcurrent: this.config.maxConcurrentOperations!,
			defaultExtension: this.config.defaultExtension,
		};
	}
}

/**
 * Factory function to create call manager
 */
export function createCallManager(apiClient: ThreeCXAPIClient, config: CallManagerConfig): CallManager {
	return new CallManager(apiClient, config);
}