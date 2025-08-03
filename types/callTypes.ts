/**
 * Call Control Types for 3CX Call Control Integration
 * Contains all interfaces and types for call control operations
 */

export type CallOperation = 
	| 'answer'
	| 'hangup' 
	| 'transfer'
	| 'park'
	| 'hold'
	| 'resume'
	| 'conference'
	| 'play_audio'
	| 'collect_dtmf';

export type TransferType = 'blind' | 'attended' | 'warm';
export type OperationResult = 'success' | 'error' | 'timeout' | 'not_found';

/**
 * Base interface for all call control operations
 */
export interface BaseCallRequest {
	/** Call ID to operate on */
	callId: string;
	/** Operation to perform */
	operation: CallOperation;
	/** Request timestamp */
	timestamp: Date;
}

/**
 * Generic call response interface
 */
export interface CallResponse {
	/** Operation result */
	result: OperationResult;
	/** Success flag */
	success: boolean;
	/** Call ID that was operated on */
	callId: string;
	/** Operation that was performed */
	operation: CallOperation;
	/** Response message */
	message: string;
	/** Response timestamp */
	timestamp: Date;
	/** Additional response data */
	data?: Record<string, any>;
	/** Error details if operation failed */
	error?: ErrorDetails;
}

/**
 * Error details for failed operations
 */
export interface ErrorDetails {
	/** Error code */
	code: string;
	/** Error message */
	message: string;
	/** Additional error data */
	details?: Record<string, any>;
}

/**
 * Answer call request
 */
export interface AnswerCallRequest extends BaseCallRequest {
	operation: 'answer';
	/** Extension to answer with */
	extension: string;
}

/**
 * Hangup call request
 */
export interface HangupCallRequest extends BaseCallRequest {
	operation: 'hangup';
	/** Reason for hangup (optional) */
	reason?: string;
}

/**
 * Transfer call request
 */
export interface TransferCallRequest extends BaseCallRequest {
	operation: 'transfer';
	/** Transfer target (extension or external number) */
	target: string;
	/** Transfer type */
	transferType: TransferType;
	/** Announcement to play before transfer (optional) */
	announcement?: string;
}

/**
 * Park call request
 */
export interface ParkCallRequest extends BaseCallRequest {
	operation: 'park';
	/** Specific park slot (optional, auto-assign if not provided) */
	parkSlot?: string;
	/** Park timeout in seconds (optional) */
	timeout?: number;
}

/**
 * Hold call request
 */
export interface HoldCallRequest extends BaseCallRequest {
	operation: 'hold';
	/** Music on hold option */
	musicOnHold?: boolean;
}

/**
 * Resume call request
 */
export interface ResumeCallRequest extends BaseCallRequest {
	operation: 'resume';
}

/**
 * Conference call request
 */
export interface ConferenceCallRequest extends BaseCallRequest {
	operation: 'conference';
	/** Conference room ID or extension */
	conferenceTarget: string;
	/** Join existing conference or create new */
	action: 'join' | 'create';
	/** Conference PIN if required */
	pin?: string;
}

/**
 * Play audio request
 */
export interface PlayAudioRequest extends BaseCallRequest {
	operation: 'play_audio';
	/** Audio file path or URL */
	audioPath: string;
	/** Audio options */
	options?: AudioOptions;
}

/**
 * Audio playback options
 */
export interface AudioOptions {
	/** Loop audio playback */
	loop?: boolean;
	/** Volume level (0-100) */
	volume?: number;
	/** Stop current audio before playing new */
	stopCurrent?: boolean;
	/** Audio format (if not auto-detected) */
	format?: 'wav' | 'mp3' | 'ogg';
}

/**
 * Collect DTMF request
 */
export interface CollectDTMFRequest extends BaseCallRequest {
	operation: 'collect_dtmf';
	/** DTMF collection options */
	options: DTMFOptions;
}

/**
 * DTMF collection options
 */
export interface DTMFOptions {
	/** Maximum number of digits to collect */
	maxDigits: number;
	/** Timeout in seconds */
	timeout: number;
	/** Termination character (e.g., '#') */
	terminator?: string;
	/** Audio prompt to play before collecting */
	playPrompt?: string;
	/** Minimum number of digits required */
	minDigits?: number;
	/** Inter-digit timeout in seconds */
	interDigitTimeout?: number;
	/** First digit timeout in seconds */
	firstDigitTimeout?: number;
}

/**
 * DTMF collection response
 */
export interface DTMFResponse extends CallResponse {
	operation: 'collect_dtmf';
	/** Collected digits */
	digits: string;
	/** Collection completed successfully */
	completed: boolean;
	/** Termination reason */
	terminationReason: 'max_digits' | 'timeout' | 'terminator' | 'hangup' | 'error';
	/** Collection duration in seconds */
	duration: number;
}

/**
 * Audio playback response
 */
export interface AudioResponse extends CallResponse {
	operation: 'play_audio';
	/** Audio file that was played */
	audioPath: string;
	/** Playback completed successfully */
	completed: boolean;
	/** Playback duration in seconds */
	duration: number;
	/** Playback termination reason */
	terminationReason: 'completed' | 'stopped' | 'hangup' | 'error';
}

/**
 * Transfer operation response
 */
export interface TransferResponse extends CallResponse {
	operation: 'transfer';
	/** Transfer target */
	target: string;
	/** Transfer type that was used */
	transferType: TransferType;
	/** Transfer completed successfully */
	completed: boolean;
	/** New call ID after transfer (if applicable) */
	newCallId?: string;
}

/**
 * Park operation response
 */
export interface ParkResponse extends CallResponse {
	operation: 'park';
	/** Park slot assigned */
	parkSlot: string;
	/** Park timeout configured */
	timeout?: number;
	/** Retrieval code for unparking */
	retrievalCode?: string;
}

/**
 * Conference operation response
 */
export interface ConferenceResponse extends CallResponse {
	operation: 'conference';
	/** Conference ID */
	conferenceId: string;
	/** Conference room number */
	conferenceRoom: string;
	/** Number of participants in conference */
	participantCount: number;
	/** Conference action that was performed */
	action: 'join' | 'create';
}

/**
 * Union type for all call control requests
 */
export type CallControlRequest = 
	| AnswerCallRequest
	| HangupCallRequest
	| TransferCallRequest
	| ParkCallRequest
	| HoldCallRequest
	| ResumeCallRequest
	| ConferenceCallRequest
	| PlayAudioRequest
	| CollectDTMFRequest;

/**
 * Union type for all call control responses
 */
export type CallControlResponse = 
	| CallResponse
	| DTMFResponse
	| AudioResponse
	| TransferResponse
	| ParkResponse
	| ConferenceResponse;

/**
 * Batch operation request for multiple calls
 */
export interface BatchCallRequest {
	/** Array of call operations to perform */
	operations: CallControlRequest[];
	/** Execute operations in parallel or sequence */
	executionMode: 'parallel' | 'sequence';
	/** Stop on first error in sequence mode */
	stopOnError?: boolean;
}

/**
 * Batch operation response
 */
export interface BatchCallResponse {
	/** Array of individual operation responses */
	responses: CallControlResponse[];
	/** Overall batch success */
	success: boolean;
	/** Number of successful operations */
	successCount: number;
	/** Number of failed operations */
	errorCount: number;
	/** Batch execution time in milliseconds */
	executionTime: number;
}

/**
 * Call control capabilities for a specific extension
 */
export interface CallControlCapabilities {
	/** Extension number */
	extension: string;
	/** Available operations for this extension */
	availableOperations: CallOperation[];
	/** Maximum concurrent calls supported */
	maxConcurrentCalls: number;
	/** Audio formats supported */
	supportedAudioFormats: string[];
	/** DTMF collection support */
	dtmfSupport: boolean;
	/** Conference capabilities */
	conferenceSupport: boolean;
	/** Transfer capabilities */
	transferSupport: {
		blind: boolean;
		attended: boolean;
		warm: boolean;
	};
}