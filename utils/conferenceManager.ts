/**
 * Advanced Conference Manager for 3CX
 * Comprehensive conference management with participant control, moderation, and advanced features
 */

import { ThreeCXAPIClient } from './apiClient';
import { CallResponse } from '../types';

export interface ConferenceRoom {
	conferenceId: string;
	name: string;
	description?: string;
	roomNumber: string;
	status: 'active' | 'inactive' | 'locked' | 'maintenance';
	capacity: number;
	currentParticipants: number;
	participants: ConferenceParticipant[];
	settings: ConferenceSettings;
	moderators: string[];
	createdAt: Date;
	startTime?: Date;
	endTime?: Date;
	recordingPath?: string;
	isRecording: boolean;
	isPersistent: boolean;
	metadata: Record<string, any>;
}

export interface ConferenceParticipant {
	participantId: string;
	callId: string;
	extension: string;
	displayName: string;
	phoneNumber: string;
	joinTime: Date;
	status: 'connected' | 'muted' | 'on_hold' | 'talking' | 'disconnected';
	role: 'moderator' | 'presenter' | 'participant' | 'observer';
	permissions: ConferencePermissions;
	audioLevel: number;
	videoEnabled: boolean;
	screenSharing: boolean;
	lastActivity: Date;
	metadata: Record<string, any>;
}

export interface ConferenceSettings {
	requirePin: boolean;
	pin?: string;
	moderatorPin?: string;
	allowGuestAccess: boolean;
	muteOnEntry: boolean;
	lockOnStart: boolean;
	recordingEnabled: boolean;
	autoRecording: boolean;
	maxParticipants: number;
	enableWaitingRoom: boolean;
	enableChat: boolean;
	enableScreenShare: boolean;
	enableVideoConferencing: boolean;
	announcementSettings: {
		announceJoin: boolean;
		announceLeave: boolean;
		joinSound?: string;
		leaveSound?: string;
	};
	security: {
		requireAuthentication: boolean;
		allowedDomains?: string[];
		restrictedExtensions?: string[];
		encryptionEnabled: boolean;
	};
}

export interface ConferencePermissions {
	canSpeak: boolean;
	canMute: boolean;
	canUnmute: boolean;
	canKickParticipants: boolean;
	canInviteParticipants: boolean;
	canStartRecording: boolean;
	canStopRecording: boolean;
	canLockConference: boolean;
	canModifySettings: boolean;
	canScreenShare: boolean;
	canUseChat: boolean;
}

export interface ConferenceInvitation {
	invitationId: string;
	conferenceId: string;
	inviteeExtension: string;
	inviteePhoneNumber?: string;
	invitedBy: string;
	invitedAt: Date;
	status: 'pending' | 'accepted' | 'declined' | 'expired';
	message?: string;
	expiresAt?: Date;
}

export interface ConferenceTemplate {
	templateId: string;
	name: string;
	description: string;
	settings: ConferenceSettings;
	defaultModerators: string[];
	schedulingOptions: {
		allowScheduling: boolean;
		maxAdvanceBooking: number; // days
		minDuration: number; // minutes
		maxDuration: number; // minutes
	};
	createdAt: Date;
	isActive: boolean;
}

export interface ConferenceSchedule {
	scheduleId: string;
	conferenceId: string;
	title: string;
	description?: string;
	organizer: string;
	startTime: Date;
	endTime: Date;
	recurrence?: {
		type: 'daily' | 'weekly' | 'monthly';
		interval: number;
		daysOfWeek?: number[];
		endDate?: Date;
		maxOccurrences?: number;
	};
	invitees: string[];
	reminders: {
		time: number; // minutes before
		method: 'email' | 'sms' | 'notification';
	}[];
	status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

export interface ConferenceAnalytics {
	conferenceId: string;
	duration: number;
	peakParticipants: number;
	averageParticipants: number;
	totalParticipantMinutes: number;
	joinMetrics: {
		averageJoinTime: number;
		failedJoins: number;
		dropouts: number;
	};
	audioQuality: {
		averageScore: number;
		issueCount: number;
		commonIssues: string[];
	};
	participantFeedback?: {
		ratings: number[];
		comments: string[];
	};
	networkStatistics: {
		averageLatency: number;
		packetLoss: number;
		bandwidth: number;
	};
}

export class ConferenceManager {
	private apiClient: ThreeCXAPIClient;
	private activeConferences = new Map<string, ConferenceRoom>();
	private conferenceTemplates = new Map<string, ConferenceTemplate>();
	private pendingInvitations = new Map<string, ConferenceInvitation>();
	private conferenceSchedules = new Map<string, ConferenceSchedule>();
	private conferenceCounter = 0;

	constructor(apiClient: ThreeCXAPIClient) {
		this.apiClient = apiClient;
		this.initializeDefaultTemplates();
	}

	/**
	 * Create a new conference room
	 */
	async createConference(
		name: string,
		settings: Partial<ConferenceSettings> = {},
		templateId?: string
	): Promise<ConferenceRoom> {
		const conferenceId = `conf-${++this.conferenceCounter}-${Date.now()}`;
		const roomNumber = this.generateRoomNumber();

		// Use template settings if provided
		let conferenceSettings: ConferenceSettings = this.getDefaultSettings();
		if (templateId) {
			const template = this.conferenceTemplates.get(templateId);
			if (template) {
				conferenceSettings = { ...template.settings, ...settings };
			}
		} else {
			conferenceSettings = { ...conferenceSettings, ...settings };
		}

		const response = await this.apiClient.request(`/conferences/create`, {
			method: 'POST',
			body: {
				conference_id: conferenceId,
				name,
				room_number: roomNumber,
				settings: conferenceSettings,
				capacity: conferenceSettings.maxParticipants,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to create conference');
		}

		const conference: ConferenceRoom = {
			conferenceId,
			name,
			roomNumber,
			status: 'inactive',
			capacity: conferenceSettings.maxParticipants,
			currentParticipants: 0,
			participants: [],
			settings: conferenceSettings,
			moderators: [],
			createdAt: new Date(),
			isRecording: false,
			isPersistent: false,
			metadata: {},
		};

		this.activeConferences.set(conferenceId, conference);

		return conference;
	}

	/**
	 * Join a participant to conference
	 */
	async joinConference(
		conferenceId: string,
		callId: string,
		extension: string,
		options: {
			pin?: string;
			displayName?: string;
			role?: 'moderator' | 'presenter' | 'participant' | 'observer';
			phoneNumber?: string;
			muted?: boolean;
		} = {}
	): Promise<{ participantId: string; success: boolean }> {
		const conference = this.activeConferences.get(conferenceId);
		if (!conference) {
			throw new Error(`Conference ${conferenceId} not found`);
		}

		// Validate capacity
		if (conference.currentParticipants >= conference.capacity) {
			throw new Error('Conference is at maximum capacity');
		}

		// Validate PIN if required
		if (conference.settings.requirePin) {
			const requiredPin = options.role === 'moderator' 
				? conference.settings.moderatorPin || conference.settings.pin
				: conference.settings.pin;
			
			if (!options.pin || options.pin !== requiredPin) {
				throw new Error('Invalid conference PIN');
			}
		}

		// Check if conference is locked
		if (conference.status === 'locked' && options.role !== 'moderator') {
			throw new Error('Conference is locked to new participants');
		}

		const participantId = `part-${Date.now()}-${extension}`;

		const response = await this.apiClient.request(`/conferences/${conferenceId}/join`, {
			method: 'POST',
			body: {
				participant_id: participantId,
				call_id: callId,
				extension,
				display_name: options.displayName || extension,
				role: options.role || 'participant',
				phone_number: options.phoneNumber,
				muted: options.muted || conference.settings.muteOnEntry,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to join conference');
		}

		// Add participant to conference
		const participant: ConferenceParticipant = {
			participantId,
			callId,
			extension,
			displayName: options.displayName || extension,
			phoneNumber: options.phoneNumber || '',
			joinTime: new Date(),
			status: options.muted || conference.settings.muteOnEntry ? 'muted' : 'connected',
			role: options.role || 'participant',
			permissions: this.getParticipantPermissions(options.role || 'participant'),
			audioLevel: 0,
			videoEnabled: false,
			screenSharing: false,
			lastActivity: new Date(),
			metadata: {},
		};

		conference.participants.push(participant);
		conference.currentParticipants++;

		// Add to moderators list if applicable
		if (participant.role === 'moderator' && !conference.moderators.includes(extension)) {
			conference.moderators.push(extension);
		}

		// Activate conference if this is the first participant
		if (conference.status === 'inactive') {
			conference.status = 'active';
			conference.startTime = new Date();
		}

		// Play join announcement if enabled
		if (conference.settings.announcementSettings.announceJoin) {
			await this.playAnnouncement(conferenceId, 'participant_joined', {
				participantName: participant.displayName,
			});
		}

		return {
			participantId,
			success: true,
		};
	}

	/**
	 * Remove participant from conference
	 */
	async leaveConference(
		conferenceId: string,
		participantId: string,
		reason: 'voluntary' | 'kicked' | 'disconnected' = 'voluntary'
	): Promise<{ success: boolean }> {
		const conference = this.activeConferences.get(conferenceId);
		if (!conference) {
			throw new Error(`Conference ${conferenceId} not found`);
		}

		const participantIndex = conference.participants.findIndex(p => p.participantId === participantId);
		if (participantIndex === -1) {
			throw new Error(`Participant ${participantId} not found in conference`);
		}

		const participant = conference.participants[participantIndex];

		const response = await this.apiClient.request(`/conferences/${conferenceId}/leave`, {
			method: 'POST',
			body: {
				participant_id: participantId,
				reason,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to leave conference');
		}

		// Remove participant
		conference.participants.splice(participantIndex, 1);
		conference.currentParticipants--;

		// Remove from moderators if applicable
		if (participant.role === 'moderator') {
			const modIndex = conference.moderators.indexOf(participant.extension);
			if (modIndex !== -1) {
				conference.moderators.splice(modIndex, 1);
			}
		}

		// Play leave announcement if enabled
		if (conference.settings.announcementSettings.announceLeave) {
			await this.playAnnouncement(conferenceId, 'participant_left', {
				participantName: participant.displayName,
			});
		}

		// End conference if no participants remain
		if (conference.currentParticipants === 0) {
			await this.endConference(conferenceId);
		}

		return { success: true };
	}

	/**
	 * Mute/unmute participant
	 */
	async muteParticipant(
		conferenceId: string,
		participantId: string,
		mute: boolean,
		moderatorExtension?: string
	): Promise<CallResponse> {
		const conference = this.activeConferences.get(conferenceId);
		if (!conference) {
			throw new Error(`Conference ${conferenceId} not found`);
		}

		const participant = conference.participants.find(p => p.participantId === participantId);
		if (!participant) {
			throw new Error(`Participant ${participantId} not found`);
		}

		// Check permissions
		if (moderatorExtension && !conference.moderators.includes(moderatorExtension)) {
			throw new Error('Only moderators can mute/unmute other participants');
		}

		const action = mute ? 'mute' : 'unmute';
		const response = await this.apiClient.request(`/conferences/${conferenceId}/participants/${participantId}/${action}`, {
			method: 'POST',
			body: { moderator: moderatorExtension },
		});

		if (!response.success) {
			throw new Error(response.error?.message || `Failed to ${action} participant`);
		}

		// Update participant status
		participant.status = mute ? 'muted' : 'connected';
		participant.lastActivity = new Date();

		return {
			result: 'success',
			success: true,
			callId: participant.callId,
			operation: `participant_${action}`,
			message: `Participant ${participant.displayName} ${action}d successfully`,
			timestamp: new Date(),
			data: { participantId, conferenceId, status: participant.status },
		};
	}

	/**
	 * Mute/unmute all participants
	 */
	async muteAllParticipants(
		conferenceId: string,
		mute: boolean,
		moderatorExtension: string,
		excludeModerators: boolean = true
	): Promise<CallResponse> {
		const conference = this.activeConferences.get(conferenceId);
		if (!conference) {
			throw new Error(`Conference ${conferenceId} not found`);
		}

		// Check moderator permissions
		if (!conference.moderators.includes(moderatorExtension)) {
			throw new Error('Only moderators can mute all participants');
		}

		const action = mute ? 'mute_all' : 'unmute_all';
		const response = await this.apiClient.request(`/conferences/${conferenceId}/${action}`, {
			method: 'POST',
			body: {
				moderator: moderatorExtension,
				exclude_moderators: excludeModerators,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || `Failed to ${action} participants`);
		}

		// Update participant statuses
		let affectedCount = 0;
		conference.participants.forEach(participant => {
			if (excludeModerators && participant.role === 'moderator') {
				return; // Skip moderators
			}
			participant.status = mute ? 'muted' : 'connected';
			participant.lastActivity = new Date();
			affectedCount++;
		});

		return {
			result: 'success',
			success: true,
			callId: '',
			operation: action,
			message: `${affectedCount} participants ${mute ? 'muted' : 'unmuted'} successfully`,
			timestamp: new Date(),
			data: { conferenceId, affectedCount, excludeModerators },
		};
	}

	/**
	 * Start/stop conference recording
	 */
	async toggleConferenceRecording(
		conferenceId: string,
		start: boolean,
		moderatorExtension: string,
		options: {
			format?: 'wav' | 'mp3' | 'mp4';
			quality?: number;
			includeVideo?: boolean;
		} = {}
	): Promise<{ success: boolean; recordingPath?: string }> {
		const conference = this.activeConferences.get(conferenceId);
		if (!conference) {
			throw new Error(`Conference ${conferenceId} not found`);
		}

		// Check permissions
		if (!conference.moderators.includes(moderatorExtension)) {
			throw new Error('Only moderators can control recording');
		}

		if (!conference.settings.recordingEnabled) {
			throw new Error('Recording is not enabled for this conference');
		}

		const action = start ? 'start' : 'stop';
		const response = await this.apiClient.request(`/conferences/${conferenceId}/recording/${action}`, {
			method: 'POST',
			body: {
				moderator: moderatorExtension,
				format: options.format || 'wav',
				quality: options.quality || 80,
				include_video: options.includeVideo || false,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || `Failed to ${action} recording`);
		}

		conference.isRecording = start;
		if (start) {
			conference.recordingPath = response.data?.recording_path;
		}

		return {
			success: true,
			recordingPath: response.data?.recording_path,
		};
	}

	/**
	 * Lock/unlock conference
	 */
	async lockConference(
		conferenceId: string,
		lock: boolean,
		moderatorExtension: string
	): Promise<CallResponse> {
		const conference = this.activeConferences.get(conferenceId);
		if (!conference) {
			throw new Error(`Conference ${conferenceId} not found`);
		}

		// Check permissions
		if (!conference.moderators.includes(moderatorExtension)) {
			throw new Error('Only moderators can lock/unlock conference');
		}

		const action = lock ? 'lock' : 'unlock';
		const response = await this.apiClient.request(`/conferences/${conferenceId}/${action}`, {
			method: 'POST',
			body: { moderator: moderatorExtension },
		});

		if (!response.success) {
			throw new Error(response.error?.message || `Failed to ${action} conference`);
		}

		conference.status = lock ? 'locked' : 'active';

		return {
			result: 'success',
			success: true,
			callId: '',
			operation: `conference_${action}`,
			message: `Conference ${lock ? 'locked' : 'unlocked'} successfully`,
			timestamp: new Date(),
			data: { conferenceId, status: conference.status },
		};
	}

	/**
	 * Invite participant to conference
	 */
	async inviteToConference(
		conferenceId: string,
		inviteeExtension: string,
		invitedBy: string,
		options: {
			phoneNumber?: string;
			message?: string;
			expiresIn?: number; // minutes
		} = {}
	): Promise<{ invitationId: string; success: boolean }> {
		const conference = this.activeConferences.get(conferenceId);
		if (!conference) {
			throw new Error(`Conference ${conferenceId} not found`);
		}

		const invitationId = `inv-${Date.now()}-${inviteeExtension}`;
		const expiresAt = options.expiresIn 
			? new Date(Date.now() + options.expiresIn * 60 * 1000)
			: undefined;

		const response = await this.apiClient.request(`/conferences/${conferenceId}/invite`, {
			method: 'POST',
			body: {
				invitation_id: invitationId,
				invitee_extension: inviteeExtension,
				invitee_phone: options.phoneNumber,
				invited_by: invitedBy,
				message: options.message || `You are invited to join conference: ${conference.name}`,
				expires_at: expiresAt?.toISOString(),
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to send conference invitation');
		}

		const invitation: ConferenceInvitation = {
			invitationId,
			conferenceId,
			inviteeExtension,
			inviteePhoneNumber: options.phoneNumber,
			invitedBy,
			invitedAt: new Date(),
			status: 'pending',
			message: options.message,
			expiresAt,
		};

		this.pendingInvitations.set(invitationId, invitation);

		return {
			invitationId,
			success: true,
		};
	}

	/**
	 * End conference
	 */
	async endConference(conferenceId: string, moderatorExtension?: string): Promise<CallResponse> {
		const conference = this.activeConferences.get(conferenceId);
		if (!conference) {
			throw new Error(`Conference ${conferenceId} not found`);
		}

		// Check permissions if moderator specified
		if (moderatorExtension && !conference.moderators.includes(moderatorExtension)) {
			throw new Error('Only moderators can end conference');
		}

		const response = await this.apiClient.request(`/conferences/${conferenceId}/end`, {
			method: 'POST',
			body: { moderator: moderatorExtension },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to end conference');
		}

		// Update conference status
		conference.status = 'inactive';
		conference.endTime = new Date();

		// Stop recording if active
		if (conference.isRecording) {
			conference.isRecording = false;
		}

		// Remove all participants
		conference.participants = [];
		conference.currentParticipants = 0;

		// Remove from active conferences if not persistent
		if (!conference.isPersistent) {
			this.activeConferences.delete(conferenceId);
		}

		return {
			result: 'success',
			success: true,
			callId: '',
			operation: 'end_conference',
			message: `Conference ${conference.name} ended successfully`,
			timestamp: new Date(),
			data: {
				conferenceId,
				duration: conference.endTime.getTime() - (conference.startTime?.getTime() || 0),
				participantCount: conference.participants.length,
			},
		};
	}

	/**
	 * Get conference information
	 */
	getConference(conferenceId: string): ConferenceRoom | undefined {
		return this.activeConferences.get(conferenceId);
	}

	/**
	 * List active conferences
	 */
	getActiveConferences(): ConferenceRoom[] {
		return Array.from(this.activeConferences.values());
	}

	/**
	 * Get conference analytics
	 */
	async getConferenceAnalytics(conferenceId: string): Promise<ConferenceAnalytics> {
		const response = await this.apiClient.request<ConferenceAnalytics>(`/conferences/${conferenceId}/analytics`, {
			method: 'GET',
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to get conference analytics');
		}

		return response.data!;
	}

	/**
	 * Helper methods
	 */
	private generateRoomNumber(): string {
		return Math.floor(1000 + Math.random() * 9000).toString();
	}

	private getDefaultSettings(): ConferenceSettings {
		return {
			requirePin: false,
			allowGuestAccess: true,
			muteOnEntry: false,
			lockOnStart: false,
			recordingEnabled: true,
			autoRecording: false,
			maxParticipants: 50,
			enableWaitingRoom: false,
			enableChat: true,
			enableScreenShare: true,
			enableVideoConferencing: false,
			announcementSettings: {
				announceJoin: false,
				announceLeave: false,
			},
			security: {
				requireAuthentication: false,
				encryptionEnabled: true,
			},
		};
	}

	private getParticipantPermissions(role: string): ConferencePermissions {
		switch (role) {
			case 'moderator':
				return {
					canSpeak: true,
					canMute: true,
					canUnmute: true,
					canKickParticipants: true,
					canInviteParticipants: true,
					canStartRecording: true,
					canStopRecording: true,
					canLockConference: true,
					canModifySettings: true,
					canScreenShare: true,
					canUseChat: true,
				};
			case 'presenter':
				return {
					canSpeak: true,
					canMute: true,
					canUnmute: true,
					canKickParticipants: false,
					canInviteParticipants: true,
					canStartRecording: false,
					canStopRecording: false,
					canLockConference: false,
					canModifySettings: false,
					canScreenShare: true,
					canUseChat: true,
				};
			case 'observer':
				return {
					canSpeak: false,
					canMute: false,
					canUnmute: false,
					canKickParticipants: false,
					canInviteParticipants: false,
					canStartRecording: false,
					canStopRecording: false,
					canLockConference: false,
					canModifySettings: false,
					canScreenShare: false,
					canUseChat: true,
				};
			default: // participant
				return {
					canSpeak: true,
					canMute: true,
					canUnmute: true,
					canKickParticipants: false,
					canInviteParticipants: false,
					canStartRecording: false,
					canStopRecording: false,
					canLockConference: false,
					canModifySettings: false,
					canScreenShare: false,
					canUseChat: true,
				};
		}
	}

	private async playAnnouncement(
		conferenceId: string,
		type: string,
		data: Record<string, any>
	): Promise<void> {
		try {
			await this.apiClient.request(`/conferences/${conferenceId}/announcement`, {
				method: 'POST',
				body: { type, data },
			});
		} catch (error) {
			// Ignore announcement errors
		}
	}

	private initializeDefaultTemplates(): void {
		// Add default conference templates
		const templates: ConferenceTemplate[] = [
			{
				templateId: 'standard',
				name: 'Standard Meeting',
				description: 'Standard conference room for regular meetings',
				settings: this.getDefaultSettings(),
				defaultModerators: [],
				schedulingOptions: {
					allowScheduling: true,
					maxAdvanceBooking: 30,
					minDuration: 15,
					maxDuration: 480,
				},
				createdAt: new Date(),
				isActive: true,
			},
			{
				templateId: 'webinar',
				name: 'Webinar',
				description: 'Large audience webinar with presenter controls',
				settings: {
					...this.getDefaultSettings(),
					maxParticipants: 500,
					muteOnEntry: true,
					lockOnStart: true,
					recordingEnabled: true,
					autoRecording: true,
				},
				defaultModerators: [],
				schedulingOptions: {
					allowScheduling: true,
					maxAdvanceBooking: 90,
					minDuration: 30,
					maxDuration: 720,
				},
				createdAt: new Date(),
				isActive: true,
			},
		];

		templates.forEach(template => {
			this.conferenceTemplates.set(template.templateId, template);
		});
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.activeConferences.clear();
		this.conferenceTemplates.clear();
		this.pendingInvitations.clear();
		this.conferenceSchedules.clear();
	}
}

/**
 * Factory function to create conference manager
 */
export function createConferenceManager(apiClient: ThreeCXAPIClient): ConferenceManager {
	return new ConferenceManager(apiClient);
}