/**
 * Call Information Types for 3CX Call Control Integration
 * Contains all interfaces and types for call information and monitoring
 */

export type CallStatus = 'ringing' | 'answered' | 'missed' | 'ended' | 'parked' | 'held' | 'transferred';
export type CallDirection = 'inbound' | 'outbound' | 'internal';
export type CallType = 'voice' | 'video' | 'conference';

/**
 * Core call information interface
 */
export interface CallInfo {
	/** Unique call identifier from 3CX */
	callId: string;
	/** Caller phone number */
	fromNumber: string;
	/** Called phone number */
	toNumber: string;
	/** Call start timestamp */
	startTime: Date;
	/** Call end timestamp (if call has ended) */
	endTime?: Date;
	/** Call duration in seconds */
	duration?: number;
	/** Current call status */
	status: CallStatus;
	/** Extension involved in the call */
	extension: string;
	/** DID (Direct Inward Dialing) number */
	did: string;
	/** Call direction */
	direction: CallDirection;
	/** Call type */
	type: CallType;
	/** Recording URL if available */
	recordingUrl?: string;
	/** Queue information if call was queued */
	queueInfo?: QueueInfo;
	/** Transfer information if call was transferred */
	transferInfo?: TransferInfo;
	/** Conference information if call is part of conference */
	conferenceInfo?: ConferenceInfo;
	/** Additional metadata */
	metadata?: Record<string, any>;
}

/**
 * Queue information for calls that were queued
 */
export interface QueueInfo {
	/** Queue identifier */
	queueId: string;
	/** Queue name */
	queueName: string;
	/** Time spent in queue (seconds) */
	waitTime: number;
	/** Position in queue when answered */
	position: number;
}

/**
 * Transfer information for transferred calls
 */
export interface TransferInfo {
	/** Transfer type */
	type: 'blind' | 'attended' | 'warm';
	/** Target extension or number */
	target: string;
	/** Transfer timestamp */
	transferTime: Date;
	/** Transfer initiator */
	initiator: string;
}

/**
 * Conference information for conference calls
 */
export interface ConferenceInfo {
	/** Conference identifier */
	conferenceId: string;
	/** Conference name */
	conferenceName: string;
	/** Number of participants */
	participantCount: number;
	/** Conference start time */
	startTime: Date;
	/** Conference moderator */
	moderator?: string;
}

/**
 * Call event for real-time monitoring
 */
export interface CallEvent {
	/** Event type */
	eventType: 'call_started' | 'call_answered' | 'call_ended' | 'call_transferred' | 'call_parked' | 'call_held' | 'call_resumed' | 'dtmf_received';
	/** Call ID associated with event */
	callId: string;
	/** Event timestamp */
	timestamp: Date;
	/** Extension involved */
	extension: string;
	/** Event-specific data */
	data: CallEventData;
}

/**
 * Event-specific data union type
 */
export type CallEventData = 
	| CallStartedData
	| CallAnsweredData
	| CallEndedData
	| CallTransferredData
	| CallParkedData
	| CallHeldData
	| CallResumedData
	| DTMFReceivedData;

export interface CallStartedData {
	fromNumber: string;
	toNumber: string;
	direction: CallDirection;
	did: string;
}

export interface CallAnsweredData {
	answerTime: Date;
	extension: string;
}

export interface CallEndedData {
	endTime: Date;
	duration: number;
	reason: 'normal' | 'busy' | 'no_answer' | 'failed' | 'cancelled';
}

export interface CallTransferredData {
	target: string;
	type: 'blind' | 'attended';
	transferTime: Date;
}

export interface CallParkedData {
	parkSlot: string;
	parkTime: Date;
}

export interface CallHeldData {
	holdTime: Date;
}

export interface CallResumedData {
	resumeTime: Date;
}

export interface DTMFReceivedData {
	digit: string;
	timestamp: Date;
}

/**
 * Call history filter options
 */
export interface CallHistoryFilter {
	/** Start date for filter range */
	startDate?: Date;
	/** End date for filter range */
	endDate?: Date;
	/** Filter by extension */
	extension?: string;
	/** Filter by call direction */
	direction?: CallDirection;
	/** Filter by call status */
	status?: CallStatus;
	/** Filter by phone number (from or to) */
	phoneNumber?: string;
	/** Filter by DID */
	did?: string;
	/** Minimum call duration in seconds */
	minDuration?: number;
	/** Maximum call duration in seconds */
	maxDuration?: number;
	/** Include only calls with recordings */
	hasRecording?: boolean;
	/** Pagination offset */
	offset?: number;
	/** Pagination limit */
	limit?: number;
}

/**
 * Call history response
 */
export interface CallHistoryResponse {
	/** Array of call information */
	calls: CallInfo[];
	/** Total number of calls matching filter */
	totalCount: number;
	/** Current page offset */
	offset: number;
	/** Number of calls returned */
	limit: number;
	/** Flag indicating if more results are available */
	hasMore: boolean;
}

/**
 * Active calls response
 */
export interface ActiveCallsResponse {
	/** Array of currently active calls */
	calls: CallInfo[];
	/** Total number of active calls */
	totalCount: number;
	/** Response timestamp */
	timestamp: Date;
}

/**
 * Call statistics interface
 */
export interface CallStatistics {
	/** Total number of calls */
	totalCalls: number;
	/** Number of answered calls */
	answeredCalls: number;
	/** Number of missed calls */
	missedCalls: number;
	/** Average call duration in seconds */
	averageDuration: number;
	/** Total call duration in seconds */
	totalDuration: number;
	/** Answer rate percentage */
	answerRate: number;
	/** Statistics period */
	period: {
		startDate: Date;
		endDate: Date;
	};
}

/**
 * Extension information
 */
export interface ExtensionInfo {
	/** Extension number */
	extension: string;
	/** Extension name/display name */
	name: string;
	/** Extension status */
	status: 'available' | 'busy' | 'away' | 'dnd' | 'offline';
	/** Current call ID if on a call */
	currentCallId?: string;
	/** Extension type */
	type: 'user' | 'queue' | 'conference' | 'ivr';
}