/**
 * Advanced Call Control Manager for 3CX
 * Implements advanced features like call recording, whisper, barge-in, and supervisor functions
 */

import { ThreeCXAPIClient } from './apiClient';
import { CallResponse } from '../types';

export interface CallRecordingOptions {
	/** Start recording automatically when call begins */
	autoStart?: boolean;
	/** Record both legs of the call */
	recordBothLegs?: boolean;
	/** Audio format for recording */
	format?: 'wav' | 'mp3' | 'ogg';
	/** Audio quality (0-100) */
	quality?: number;
	/** Maximum recording duration in seconds */
	maxDuration?: number;
	/** Recording storage location */
	storageLocation?: string;
	/** Include call metadata in recording */
	includeMetadata?: boolean;
	/** Encryption for sensitive recordings */
	encrypt?: boolean;
	/** Custom recording filename pattern */
	filenamePattern?: string;
}

export interface CallWhisperOptions {
	/** Audio message to whisper */
	audioMessage: string;
	/** Target participant (agent, customer, all) */
	target: 'agent' | 'customer' | 'all';
	/** Whisper mode (announcement, coaching) */
	mode: 'announcement' | 'coaching';
	/** Volume level for whisper */
	volume?: number;
	/** Duration limit for whisper */
	maxDuration?: number;
	/** Enable two-way whisper (coaching mode) */
	enableTwoWay?: boolean;
}

export interface CallBargeOptions {
	/** Barge mode (listen, whisper, takeover) */
	mode: 'listen' | 'whisper' | 'takeover';
	/** Supervisor extension */
	supervisorExtension: string;
	/** Announcement to agents when supervisor joins */
	joinAnnouncement?: string;
	/** Enable supervisor controls during barge */
	enableControls?: boolean;
	/** Record supervisor session */
	recordSession?: boolean;
}

export interface CallMonitoringOptions {
	/** Monitor mode (silent, announced) */
	mode: 'silent' | 'announced';
	/** Supervisor extension */
	supervisorExtension: string;
	/** Enable real-time metrics */
	enableMetrics?: boolean;
	/** Monitor duration limit */
	maxDuration?: number;
	/** Alert thresholds */
	alertThresholds?: {
		callDuration?: number;
		holdTime?: number;
		silenceDetection?: number;
	};
}

export interface RecordingSession {
	recordingId: string;
	callId: string;
	startTime: Date;
	endTime?: Date;
	status: 'recording' | 'paused' | 'stopped' | 'completed' | 'failed';
	options: CallRecordingOptions;
	filePath?: string;
	fileSize?: number;
	duration?: number;
	metadata?: Record<string, any>;
}

export interface SupervisorSession {
	sessionId: string;
	supervisorExtension: string;
	targetCallId: string;
	mode: 'monitor' | 'whisper' | 'barge';
	startTime: Date;
	endTime?: Date;
	status: 'active' | 'paused' | 'ended';
	permissions: string[];
	recordings?: string[];
}

export interface CallAnalytics {
	callId: string;
	duration: number;
	holdTime: number;
	talkTime: number;
	silenceTime: number;
	transferCount: number;
	dtmfInputs: string[];
	qualityMetrics: {
		audioQuality: number;
		latency: number;
		jitter: number;
		packetLoss: number;
	};
	agentMetrics: {
		responseTime: number;
		talkRatio: number;
		interruptionCount: number;
	};
}

export class AdvancedCallControlManager {
	private apiClient: ThreeCXAPIClient;
	private activeRecordings = new Map<string, RecordingSession>();
	private supervisorSessions = new Map<string, SupervisorSession>();
	private callAnalytics = new Map<string, CallAnalytics>();
	private sessionCounter = 0;

	constructor(apiClient: ThreeCXAPIClient) {
		this.apiClient = apiClient;
	}

	/**
	 * Start call recording with advanced options
	 */
	async startCallRecording(
		callId: string,
		options: CallRecordingOptions = {}
	): Promise<{ recordingId: string; filePath: string; success: boolean }> {
		const recordingId = `rec-${++this.sessionCounter}-${Date.now()}`;
		
		const recordingOptions = {
			format: 'wav',
			quality: 80,
			recordBothLegs: true,
			includeMetadata: true,
			encrypt: false,
			filenamePattern: 'call_{callId}_{timestamp}',
			...options,
		};

		const response = await this.apiClient.request(`/calls/${callId}/recording/start`, {
			method: 'POST',
			body: {
				recording_id: recordingId,
				format: recordingOptions.format,
				quality: recordingOptions.quality,
				record_both_legs: recordingOptions.recordBothLegs,
				storage_location: recordingOptions.storageLocation,
				include_metadata: recordingOptions.includeMetadata,
				encrypt: recordingOptions.encrypt,
				filename_pattern: recordingOptions.filenamePattern,
				max_duration: recordingOptions.maxDuration,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to start call recording');
		}

		const recordingSession: RecordingSession = {
			recordingId,
			callId,
			startTime: new Date(),
			status: 'recording',
			options: recordingOptions,
			filePath: response.data?.file_path,
			metadata: {
				startedBy: 'system',
				callStartTime: new Date(),
			},
		};

		this.activeRecordings.set(recordingId, recordingSession);

		return {
			recordingId,
			filePath: response.data?.file_path || '',
			success: true,
		};
	}

	/**
	 * Stop call recording
	 */
	async stopCallRecording(recordingId: string): Promise<{
		success: boolean;
		filePath: string;
		duration: number;
		fileSize: number;
	}> {
		const recording = this.activeRecordings.get(recordingId);
		if (!recording) {
			throw new Error(`Recording session ${recordingId} not found`);
		}

		const response = await this.apiClient.request(`/calls/${recording.callId}/recording/stop`, {
			method: 'POST',
			body: { recording_id: recordingId },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to stop call recording');
		}

		// Update recording session
		recording.status = 'completed';
		recording.endTime = new Date();
		recording.duration = Math.floor((recording.endTime.getTime() - recording.startTime.getTime()) / 1000);
		recording.fileSize = response.data?.file_size || 0;
		recording.filePath = response.data?.file_path || recording.filePath;

		// Remove from active recordings
		this.activeRecordings.delete(recordingId);

		return {
			success: true,
			filePath: recording.filePath || '',
			duration: recording.duration,
			fileSize: recording.fileSize,
		};
	}

	/**
	 * Pause/resume call recording
	 */
	async pauseCallRecording(recordingId: string, pause: boolean = true): Promise<CallResponse> {
		const recording = this.activeRecordings.get(recordingId);
		if (!recording) {
			throw new Error(`Recording session ${recordingId} not found`);
		}

		const action = pause ? 'pause' : 'resume';
		const response = await this.apiClient.request(`/calls/${recording.callId}/recording/${action}`, {
			method: 'POST',
			body: { recording_id: recordingId },
		});

		if (!response.success) {
			throw new Error(response.error?.message || `Failed to ${action} call recording`);
		}

		recording.status = pause ? 'paused' : 'recording';

		return {
			result: 'success',
			success: true,
			callId: recording.callId,
			operation: `recording_${action}`,
			message: `Call recording ${action}d successfully`,
			timestamp: new Date(),
			data: { recordingId, status: recording.status },
		};
	}

	/**
	 * Start call whisper/coaching
	 */
	async startCallWhisper(
		callId: string,
		options: CallWhisperOptions
	): Promise<{ sessionId: string; success: boolean }> {
		const sessionId = `whisper-${++this.sessionCounter}-${Date.now()}`;

		const response = await this.apiClient.request(`/calls/${callId}/whisper/start`, {
			method: 'POST',
			body: {
				session_id: sessionId,
				audio_message: options.audioMessage,
				target: options.target,
				mode: options.mode,
				volume: options.volume || 100,
				max_duration: options.maxDuration || 300, // 5 minutes default
				enable_two_way: options.enableTwoWay || false,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to start call whisper');
		}

		return {
			sessionId,
			success: true,
		};
	}

	/**
	 * Stop call whisper
	 */
	async stopCallWhisper(callId: string, sessionId: string): Promise<CallResponse> {
		const response = await this.apiClient.request(`/calls/${callId}/whisper/stop`, {
			method: 'POST',
			body: { session_id: sessionId },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to stop call whisper');
		}

		return {
			result: 'success',
			success: true,
			callId,
			operation: 'stop_whisper',
			message: 'Call whisper stopped successfully',
			timestamp: new Date(),
			data: { sessionId },
		};
	}

	/**
	 * Start supervisor barge-in
	 */
	async startCallBarge(
		callId: string,
		options: CallBargeOptions
	): Promise<{ sessionId: string; success: boolean }> {
		const sessionId = `barge-${++this.sessionCounter}-${Date.now()}`;

		const response = await this.apiClient.request(`/calls/${callId}/barge/start`, {
			method: 'POST',
			body: {
				session_id: sessionId,
				mode: options.mode,
				supervisor_extension: options.supervisorExtension,
				join_announcement: options.joinAnnouncement,
				enable_controls: options.enableControls || true,
				record_session: options.recordSession || false,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to start call barge');
		}

		// Create supervisor session
		const supervisorSession: SupervisorSession = {
			sessionId,
			supervisorExtension: options.supervisorExtension,
			targetCallId: callId,
			mode: 'barge',
			startTime: new Date(),
			status: 'active',
			permissions: this.getBargePermissions(options.mode),
			recordings: options.recordSession ? [sessionId] : undefined,
		};

		this.supervisorSessions.set(sessionId, supervisorSession);

		return {
			sessionId,
			success: true,
		};
	}

	/**
	 * Start call monitoring (silent/announced)
	 */
	async startCallMonitoring(
		callId: string,
		options: CallMonitoringOptions
	): Promise<{ sessionId: string; success: boolean }> {
		const sessionId = `monitor-${++this.sessionCounter}-${Date.now()}`;

		const response = await this.apiClient.request(`/calls/${callId}/monitor/start`, {
			method: 'POST',
			body: {
				session_id: sessionId,
				mode: options.mode,
				supervisor_extension: options.supervisorExtension,
				enable_metrics: options.enableMetrics || true,
				max_duration: options.maxDuration || 3600, // 1 hour default
				alert_thresholds: options.alertThresholds,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to start call monitoring');
		}

		// Create supervisor session
		const supervisorSession: SupervisorSession = {
			sessionId,
			supervisorExtension: options.supervisorExtension,
			targetCallId: callId,
			mode: 'monitor',
			startTime: new Date(),
			status: 'active',
			permissions: ['listen', 'metrics'],
		};

		this.supervisorSessions.set(sessionId, supervisorSession);

		return {
			sessionId,
			success: true,
		};
	}

	/**
	 * End supervisor session (monitoring/barge)
	 */
	async endSupervisorSession(sessionId: string): Promise<CallResponse> {
		const session = this.supervisorSessions.get(sessionId);
		if (!session) {
			throw new Error(`Supervisor session ${sessionId} not found`);
		}

		const endpoint = session.mode === 'monitor' ? 'monitor' : 'barge';
		const response = await this.apiClient.request(`/calls/${session.targetCallId}/${endpoint}/stop`, {
			method: 'POST',
			body: { session_id: sessionId },
		});

		if (!response.success) {
			throw new Error(response.error?.message || `Failed to end ${session.mode} session`);
		}

		// Update session
		session.status = 'ended';
		session.endTime = new Date();

		// Remove from active sessions
		this.supervisorSessions.delete(sessionId);

		return {
			result: 'success',
			success: true,
			callId: session.targetCallId,
			operation: `end_${session.mode}`,
			message: `${session.mode} session ended successfully`,
			timestamp: new Date(),
			data: { sessionId, duration: session.endTime.getTime() - session.startTime.getTime() },
		};
	}

	/**
	 * Get call analytics and quality metrics
	 */
	async getCallAnalytics(callId: string): Promise<CallAnalytics> {
		const response = await this.apiClient.request<CallAnalytics>(`/calls/${callId}/analytics`, {
			method: 'GET',
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to get call analytics');
		}

		const analytics = response.data!;
		this.callAnalytics.set(callId, analytics);

		return analytics;
	}

	/**
	 * Enable/disable call sentiment analysis
	 */
	async toggleSentimentAnalysis(
		callId: string,
		enable: boolean,
		options?: {
			realTime?: boolean;
			language?: string;
			keywords?: string[];
			alertThresholds?: {
				negativeSentiment?: number;
				escalationKeywords?: string[];
			};
		}
	): Promise<CallResponse> {
		const action = enable ? 'enable' : 'disable';
		const response = await this.apiClient.request(`/calls/${callId}/sentiment/${action}`, {
			method: 'POST',
			body: options,
		});

		if (!response.success) {
			throw new Error(response.error?.message || `Failed to ${action} sentiment analysis`);
		}

		return {
			result: 'success',
			success: true,
			callId,
			operation: `sentiment_${action}`,
			message: `Sentiment analysis ${action}d successfully`,
			timestamp: new Date(),
			data: response.data,
		};
	}

	/**
	 * Force call disconnect (emergency feature)
	 */
	async forceCallDisconnect(callId: string, reason: string): Promise<CallResponse> {
		const response = await this.apiClient.request(`/calls/${callId}/force-disconnect`, {
			method: 'POST',
			body: { reason },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to force call disconnect');
		}

		return {
			result: 'success',
			success: true,
			callId,
			operation: 'force_disconnect',
			message: `Call forcefully disconnected: ${reason}`,
			timestamp: new Date(),
			data: { reason },
		};
	}

	/**
	 * Set call priority for queue management
	 */
	async setCallPriority(
		callId: string,
		priority: 'low' | 'normal' | 'high' | 'urgent',
		reason?: string
	): Promise<CallResponse> {
		const response = await this.apiClient.request(`/calls/${callId}/priority`, {
			method: 'POST',
			body: { priority, reason },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to set call priority');
		}

		return {
			result: 'success',
			success: true,
			callId,
			operation: 'set_priority',
			message: `Call priority set to ${priority}`,
			timestamp: new Date(),
			data: { priority, reason },
		};
	}

	/**
	 * Get permissions for barge mode
	 */
	private getBargePermissions(mode: string): string[] {
		switch (mode) {
			case 'listen':
				return ['listen'];
			case 'whisper':
				return ['listen', 'whisper'];
			case 'takeover':
				return ['listen', 'whisper', 'takeover', 'control'];
			default:
				return ['listen'];
		}
	}

	/**
	 * Get active recording sessions
	 */
	getActiveRecordings(): RecordingSession[] {
		return Array.from(this.activeRecordings.values());
	}

	/**
	 * Get active supervisor sessions
	 */
	getActiveSupervisorSessions(): SupervisorSession[] {
		return Array.from(this.supervisorSessions.values());
	}

	/**
	 * Get call analytics cache
	 */
	getCachedCallAnalytics(): Map<string, CallAnalytics> {
		return new Map(this.callAnalytics);
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.activeRecordings.clear();
		this.supervisorSessions.clear();
		this.callAnalytics.clear();
	}
}

/**
 * Factory function to create advanced call control manager
 */
export function createAdvancedCallControlManager(apiClient: ThreeCXAPIClient): AdvancedCallControlManager {
	return new AdvancedCallControlManager(apiClient);
}