/**
 * Advanced DTMF Manager for 3CX Call Control
 * Enhanced DTMF collection with validation, patterns, and intelligent timeout handling
 */

import { ThreeCXAPIClient } from './apiClient';
import { DTMFOptions, DTMFResponse } from '../types';

export interface AdvancedDTMFOptions extends DTMFOptions {
	/** Expected input pattern (regex) */
	expectedPattern?: string;
	/** Custom validation function */
	customValidator?: (digits: string) => { valid: boolean; message?: string };
	/** Retry attempts on invalid input */
	retryAttempts?: number;
	/** Audio prompt for retry */
	retryPrompt?: string;
	/** Audio prompt for invalid input */
	invalidPrompt?: string;
	/** Audio prompt for timeout */
	timeoutPrompt?: string;
	/** Enable digit confirmation */
	enableConfirmation?: boolean;
	/** Confirmation prompt */
	confirmationPrompt?: string;
	/** Digits to confirm input (e.g., "1 for yes, 2 for no") */
	confirmationOptions?: { [key: string]: 'confirm' | 'retry' | 'cancel' };
	/** Enable input masking for sensitive data */
	maskInput?: boolean;
	/** Progressive timeout (increasing timeout for each digit) */
	progressiveTimeout?: boolean;
	/** Context-aware prompts based on previous inputs */
	contextAwarePrompts?: boolean;
	/** Input history for context */
	inputHistory?: string[];
}

export interface DTMFInputPattern {
	name: string;
	pattern: RegExp;
	description: string;
	examples: string[];
	minLength: number;
	maxLength: number;
}

export interface DTMFCollectionSession {
	sessionId: string;
	callId: string;
	startTime: Date;
	status: 'collecting' | 'validating' | 'confirming' | 'completed' | 'failed' | 'cancelled';
	options: AdvancedDTMFOptions;
	collectedDigits: string;
	attempts: number;
	lastActivity: Date;
	validationErrors: string[];
	context: DTMFContext;
}

export interface DTMFContext {
	previousInputs: string[];
	currentStep: string;
	workflow: string;
	metadata: Record<string, any>;
}

export interface DTMFValidationResult {
	valid: boolean;
	message?: string;
	suggestions?: string[];
	severity: 'info' | 'warning' | 'error';
}

export interface DTMFWorkflow {
	workflowId: string;
	name: string;
	description: string;
	steps: DTMFWorkflowStep[];
	context: Record<string, any>;
}

export interface DTMFWorkflowStep {
	stepId: string;
	name: string;
	prompt: string;
	options: AdvancedDTMFOptions;
	nextSteps: { [input: string]: string }; // input -> next stepId
	validationRules: DTMFValidationRule[];
}

export interface DTMFValidationRule {
	type: 'pattern' | 'length' | 'custom' | 'lookup';
	value: any;
	message: string;
	severity: 'warning' | 'error';
}

export class AdvancedDTMFManager {
	private apiClient: ThreeCXAPIClient;
	private activeSessions = new Map<string, DTMFCollectionSession>();
	private workflows = new Map<string, DTMFWorkflow>();
	private inputPatterns = new Map<string, DTMFInputPattern>();
	private sessionCounter = 0;

	// Predefined common patterns
	private readonly commonPatterns: DTMFInputPattern[] = [
		{
			name: 'phone_number',
			pattern: /^\d{10,15}$/,
			description: 'Phone number (10-15 digits)',
			examples: ['1234567890', '15551234567'],
			minLength: 10,
			maxLength: 15,
		},
		{
			name: 'account_number',
			pattern: /^\d{6,12}$/,
			description: 'Account number (6-12 digits)',
			examples: ['123456', '123456789012'],
			minLength: 6,
			maxLength: 12,
		},
		{
			name: 'pin_code',
			pattern: /^\d{4,8}$/,
			description: 'PIN code (4-8 digits)',
			examples: ['1234', '12345678'],
			minLength: 4,
			maxLength: 8,
		},
		{
			name: 'ssn_last4',
			pattern: /^\d{4}$/,
			description: 'Last 4 digits of SSN',
			examples: ['1234'],
			minLength: 4,
			maxLength: 4,
		},
		{
			name: 'zip_code',
			pattern: /^\d{5}$/,
			description: 'ZIP code (5 digits)',
			examples: ['12345'],
			minLength: 5,
			maxLength: 5,
		},
		{
			name: 'menu_option',
			pattern: /^[1-9]$/,
			description: 'Menu option (1-9)',
			examples: ['1', '9'],
			minLength: 1,
			maxLength: 1,
		},
		{
			name: 'confirmation',
			pattern: /^[12]$/,
			description: 'Confirmation (1=Yes, 2=No)',
			examples: ['1', '2'],
			minLength: 1,
			maxLength: 1,
		},
	];

	constructor(apiClient: ThreeCXAPIClient) {
		this.apiClient = apiClient;
		this.initializeCommonPatterns();
	}

	/**
	 * Collect DTMF with advanced validation and retry logic
	 */
	async collectDTMFAdvanced(
		callId: string,
		options: AdvancedDTMFOptions,
		context?: DTMFContext
	): Promise<DTMFResponse> {
		const sessionId = `dtmf-${++this.sessionCounter}-${Date.now()}`;
		
		const session: DTMFCollectionSession = {
			sessionId,
			callId,
			startTime: new Date(),
			status: 'collecting',
			options: {
				retryAttempts: 2,
				enableConfirmation: false,
				maskInput: false,
				progressiveTimeout: false,
				contextAwarePrompts: false,
				...options,
			},
			collectedDigits: '',
			attempts: 0,
			lastActivity: new Date(),
			validationErrors: [],
			context: context || {
				previousInputs: [],
				currentStep: 'input',
				workflow: 'default',
				metadata: {},
			},
		};

		this.activeSessions.set(sessionId, session);

		try {
			return await this.executeCollectionWithRetry(session);
		} finally {
			this.activeSessions.delete(sessionId);
		}
	}

	/**
	 * Execute collection with retry logic
	 */
	private async executeCollectionWithRetry(session: DTMFCollectionSession): Promise<DTMFResponse> {
		const maxAttempts = (session.options.retryAttempts || 2) + 1;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			session.attempts = attempt;
			session.lastActivity = new Date();

			try {
				// Determine the prompt to use
				const prompt = this.getContextualPrompt(session, attempt);
				
				// Calculate timeout for this attempt
				const timeout = this.calculateTimeout(session, attempt);

				// Collect DTMF digits
				const dtmfResponse = await this.collectDigits(session, prompt, timeout);

				if (dtmfResponse.completed) {
					// Validate the collected digits
					const validation = await this.validateInput(session, dtmfResponse.digits);
					
					if (validation.valid) {
						// Check if confirmation is needed
						if (session.options.enableConfirmation && session.status !== 'confirming') {
							return await this.handleConfirmation(session, dtmfResponse.digits);
						} else {
							// Input is valid and confirmed (if needed)
							session.status = 'completed';
							session.collectedDigits = dtmfResponse.digits;
							
							return {
								...dtmfResponse,
								result: 'success',
								success: true,
								digits: session.options.maskInput ? this.maskDigits(dtmfResponse.digits) : dtmfResponse.digits,
								terminationReason: 'completed',
								data: {
									...dtmfResponse.data,
									sessionId: session.sessionId,
									attempts: session.attempts,
									validationResult: validation,
									context: session.context,
								},
							};
						}
					} else {
						// Input is invalid, prepare for retry
						session.validationErrors.push(validation.message || 'Invalid input');
						
						if (attempt < maxAttempts) {
							// Play invalid input prompt if configured
							if (session.options.invalidPrompt) {
								await this.playPrompt(session.callId, session.options.invalidPrompt);
							}
							continue; // Retry
						} else {
							// Max attempts reached
							session.status = 'failed';
							return {
								...dtmfResponse,
								result: 'error',
								success: false,
								digits: '',
								completed: false,
								terminationReason: 'max_attempts_reached',
								message: `DTMF collection failed after ${maxAttempts} attempts: ${validation.message}`,
								data: {
									sessionId: session.sessionId,
									attempts: session.attempts,
									validationErrors: session.validationErrors,
									lastValidationResult: validation,
								},
							};
						}
					}
				} else {
					// Collection was not completed (timeout, hangup, etc.)
					if (attempt < maxAttempts && dtmfResponse.terminationReason === 'timeout') {
						// Play timeout prompt if configured
						if (session.options.timeoutPrompt) {
							await this.playPrompt(session.callId, session.options.timeoutPrompt);
						}
						continue; // Retry
					} else {
						// Return the failed response
						session.status = 'failed';
						return dtmfResponse;
					}
				}

			} catch (error) {
				if (attempt < maxAttempts) {
					continue; // Retry on error
				} else {
					session.status = 'failed';
					throw error;
				}
			}
		}

		// This should never be reached, but just in case
		session.status = 'failed';
		throw new Error('DTMF collection failed: Maximum attempts exceeded');
	}

	/**
	 * Handle input confirmation workflow
	 */
	private async handleConfirmation(session: DTMFCollectionSession, digits: string): Promise<DTMFResponse> {
		session.status = 'confirming';
		session.collectedDigits = digits;

		// Play confirmation prompt
		const confirmationPrompt = session.options.confirmationPrompt || 
			`You entered ${this.formatDigitsForSpeech(digits)}. Press 1 to confirm, 2 to re-enter, or 9 to cancel.`;

		const confirmationOptions: AdvancedDTMFOptions = {
			maxDigits: 1,
			timeout: 30,
			terminator: '',
			expectedPattern: '^[129]$',
			retryAttempts: 1,
			playPrompt: confirmationPrompt,
		};

		const confirmResponse = await this.collectDigits(session, confirmationPrompt, 30);

		if (confirmResponse.completed) {
			const confirmDigit = confirmResponse.digits;
			const confirmOptions = session.options.confirmationOptions || {
				'1': 'confirm',
				'2': 'retry',
				'9': 'cancel',
			};

			const action = confirmOptions[confirmDigit];

			switch (action) {
				case 'confirm':
					session.status = 'completed';
					return {
						...confirmResponse,
						result: 'success',
						success: true,
						callId: session.callId,
						operation: 'collect_dtmf',
						digits: session.options.maskInput ? this.maskDigits(digits) : digits,
						completed: true,
						terminationReason: 'confirmed',
						duration: Math.floor((new Date().getTime() - session.startTime.getTime()) / 1000),
						message: `DTMF collection completed and confirmed for call ${session.callId}`,
						timestamp: new Date(),
						data: {
							sessionId: session.sessionId,
							attempts: session.attempts,
							confirmed: true,
							context: session.context,
						},
					};

				case 'retry':
					// Reset session for retry
					session.status = 'collecting';
					session.collectedDigits = '';
					session.attempts = 0;
					return await this.executeCollectionWithRetry(session);

				case 'cancel':
					session.status = 'cancelled';
					return {
						...confirmResponse,
						result: 'error',
						success: false,
						callId: session.callId,
						operation: 'collect_dtmf',
						digits: '',
						completed: false,
						terminationReason: 'cancelled',
						duration: Math.floor((new Date().getTime() - session.startTime.getTime()) / 1000),
						message: `DTMF collection cancelled by user for call ${session.callId}`,
						timestamp: new Date(),
						data: {
							sessionId: session.sessionId,
							cancelled: true,
						},
					};

				default:
					// Invalid confirmation option, treat as retry
					session.status = 'collecting';
					session.attempts = 0;
					return await this.executeCollectionWithRetry(session);
			}
		} else {
			// Confirmation timed out or failed, treat as retry
			session.status = 'collecting';
			session.attempts = 0;
			return await this.executeCollectionWithRetry(session);
		}
	}

	/**
	 * Validate DTMF input
	 */
	private async validateInput(session: DTMFCollectionSession, digits: string): Promise<DTMFValidationResult> {
		const options = session.options;

		// Length validation
		if (options.minDigits && digits.length < options.minDigits) {
			return {
				valid: false,
				message: `Input too short. Minimum ${options.minDigits} digits required.`,
				severity: 'error',
			};
		}

		// Pattern validation
		if (options.expectedPattern) {
			const pattern = new RegExp(options.expectedPattern);
			if (!pattern.test(digits)) {
				return {
					valid: false,
					message: 'Input format is invalid.',
					severity: 'error',
				};
			}
		}

		// Custom validation
		if (options.customValidator) {
			const customResult = options.customValidator(digits);
			if (!customResult.valid) {
				return {
					valid: false,
					message: customResult.message || 'Custom validation failed.',
					severity: 'error',
				};
			}
		}

		// All validations passed
		return {
			valid: true,
			message: 'Input is valid.',
			severity: 'info',
		};
	}

	/**
	 * Collect DTMF digits from 3CX API
	 */
	private async collectDigits(
		session: DTMFCollectionSession,
		prompt: string,
		timeout: number
	): Promise<DTMFResponse> {
		const response = await this.apiClient.request<DTMFResponse>(`/calls/${session.callId}/dtmf`, {
			method: 'POST',
			body: {
				max_digits: session.options.maxDigits,
				timeout,
				terminator: session.options.terminator,
				play_prompt: prompt,
				min_digits: session.options.minDigits,
				inter_digit_timeout: session.options.interDigitTimeout,
				first_digit_timeout: session.options.firstDigitTimeout,
				session_id: session.sessionId,
			},
			timeout: (timeout + 10) * 1000, // Add buffer to HTTP timeout
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to collect DTMF');
		}

		return response.data!;
	}

	/**
	 * Get contextual prompt based on attempt and history
	 */
	private getContextualPrompt(session: DTMFCollectionSession, attempt: number): string {
		if (attempt === 1) {
			return session.options.playPrompt || 'Please enter your input followed by the pound key.';
		} else {
			return session.options.retryPrompt || 'Please try again. Enter your input followed by the pound key.';
		}
	}

	/**
	 * Calculate timeout with progressive increase
	 */
	private calculateTimeout(session: DTMFCollectionSession, attempt: number): number {
		const baseTimeout = session.options.timeout || 30;
		
		if (session.options.progressiveTimeout) {
			// Increase timeout by 50% for each retry attempt
			return Math.min(baseTimeout * Math.pow(1.5, attempt - 1), 120); // Max 2 minutes
		}
		
		return baseTimeout;
	}

	/**
	 * Play audio prompt
	 */
	private async playPrompt(callId: string, prompt: string): Promise<void> {
		await this.apiClient.request(`/calls/${callId}/play`, {
			method: 'POST',
			body: { audio_path: prompt },
			timeout: 30000,
		});
	}

	/**
	 * Format digits for speech synthesis
	 */
	private formatDigitsForSpeech(digits: string): string {
		return digits.split('').join(' ');
	}

	/**
	 * Mask sensitive digits
	 */
	private maskDigits(digits: string, maskChar: string = '*'): string {
		if (digits.length <= 4) {
			return maskChar.repeat(digits.length);
		} else {
			// Show last 4 digits, mask the rest
			return maskChar.repeat(digits.length - 4) + digits.slice(-4);
		}
	}

	/**
	 * Initialize common input patterns
	 */
	private initializeCommonPatterns(): void {
		this.commonPatterns.forEach(pattern => {
			this.inputPatterns.set(pattern.name, pattern);
		});
	}

	/**
	 * Add custom input pattern
	 */
	addInputPattern(pattern: DTMFInputPattern): void {
		this.inputPatterns.set(pattern.name, pattern);
	}

	/**
	 * Get input pattern by name
	 */
	getInputPattern(name: string): DTMFInputPattern | undefined {
		return this.inputPatterns.get(name);
	}

	/**
	 * Create DTMF workflow
	 */
	createWorkflow(workflow: DTMFWorkflow): void {
		this.workflows.set(workflow.workflowId, workflow);
	}

	/**
	 * Execute DTMF workflow
	 */
	async executeWorkflow(callId: string, workflowId: string, context?: Record<string, any>): Promise<any> {
		const workflow = this.workflows.get(workflowId);
		if (!workflow) {
			throw new Error(`DTMF workflow ${workflowId} not found`);
		}

		const workflowContext: DTMFContext = {
			previousInputs: [],
			currentStep: workflow.steps[0]?.stepId || 'start',
			workflow: workflowId,
			metadata: { ...workflow.context, ...context },
		};

		return await this.executeWorkflowStep(callId, workflow, workflow.steps[0], workflowContext);
	}

	/**
	 * Execute individual workflow step
	 */
	private async executeWorkflowStep(
		callId: string,
		workflow: DTMFWorkflow,
		step: DTMFWorkflowStep,
		context: DTMFContext
	): Promise<any> {
		context.currentStep = step.stepId;

		const response = await this.collectDTMFAdvanced(callId, step.options, context);

		if (response.success && response.completed) {
			context.previousInputs.push(response.digits);

			// Determine next step based on input
			const nextStepId = step.nextSteps[response.digits] || step.nextSteps['default'];
			
			if (nextStepId) {
				const nextStep = workflow.steps.find(s => s.stepId === nextStepId);
				if (nextStep) {
					return await this.executeWorkflowStep(callId, workflow, nextStep, context);
				}
			}

			// Workflow completed
			return {
				workflowId: workflow.workflowId,
				completed: true,
				results: context.previousInputs,
				context,
			};
		} else {
			// Workflow failed
			return {
				workflowId: workflow.workflowId,
				completed: false,
				error: response.message,
				context,
			};
		}
	}

	/**
	 * Get active DTMF sessions
	 */
	getActiveSessions(): DTMFCollectionSession[] {
		return Array.from(this.activeSessions.values());
	}

	/**
	 * Cancel DTMF collection session
	 */
	async cancelSession(sessionId: string): Promise<boolean> {
		const session = this.activeSessions.get(sessionId);
		if (!session) return false;

		session.status = 'cancelled';
		this.activeSessions.delete(sessionId);

		// Optionally notify 3CX to stop collection
		try {
			await this.apiClient.request(`/calls/${session.callId}/dtmf/cancel`, {
				method: 'POST',
				body: { session_id: sessionId },
			});
		} catch (error) {
			// Ignore cancellation errors
		}

		return true;
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.activeSessions.clear();
		this.workflows.clear();
		this.inputPatterns.clear();
	}
}

/**
 * Factory function to create advanced DTMF manager
 */
export function createAdvancedDTMFManager(apiClient: ThreeCXAPIClient): AdvancedDTMFManager {
	return new AdvancedDTMFManager(apiClient);
}