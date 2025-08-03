/**
 * Advanced Audio Manager for 3CX Call Control
 * Handles audio streaming, format conversion, and advanced playback features
 */

import { ThreeCXAPIClient } from './apiClient';
import { AudioOptions, AudioResponse } from '../types';

export interface AudioStreamOptions extends AudioOptions {
	/** Enable audio streaming for large files */
	enableStreaming?: boolean;
	/** Stream chunk size in bytes */
	chunkSize?: number;
	/** Stream buffer size */
	bufferSize?: number;
	/** Enable adaptive bitrate streaming */
	adaptiveBitrate?: boolean;
	/** Target bitrate for streaming */
	targetBitrate?: number;
	/** Enable audio compression */
	enableCompression?: boolean;
	/** Compression quality (0-1) */
	compressionQuality?: number;
}

export interface AudioConversionOptions {
	/** Source audio format */
	sourceFormat: 'wav' | 'mp3' | 'ogg' | 'aac' | 'flac' | 'opus';
	/** Target audio format */
	targetFormat: 'wav' | 'mp3' | 'ogg' | 'gsm' | 'g711' | 'g729';
	/** Sample rate conversion */
	sampleRate?: number;
	/** Bit depth conversion */
	bitDepth?: 8 | 16 | 24 | 32;
	/** Number of channels */
	channels?: 1 | 2;
	/** Audio quality (0-100) */
	quality?: number;
}

export interface AudioMetadata {
	format: string;
	duration: number;
	sampleRate: number;
	bitDepth: number;
	channels: number;
	bitrate: number;
	size: number;
	codec: string;
}

export interface AudioPlaybackSession {
	sessionId: string;
	callId: string;
	audioPath: string;
	startTime: Date;
	status: 'preparing' | 'playing' | 'paused' | 'stopped' | 'completed' | 'error';
	currentPosition: number;
	totalDuration: number;
	options: AudioStreamOptions;
	metadata?: AudioMetadata;
}

export interface AudioLibrary {
	libraryId: string;
	name: string;
	description: string;
	audioFiles: AudioFile[];
	tags: string[];
	createdAt: Date;
	updatedAt: Date;
}

export interface AudioFile {
	fileId: string;
	name: string;
	filePath: string;
	format: string;
	metadata: AudioMetadata;
	tags: string[];
	category: string;
	isActive: boolean;
	uploadedAt: Date;
}

export class AdvancedAudioManager {
	private apiClient: ThreeCXAPIClient;
	private activePlaybackSessions = new Map<string, AudioPlaybackSession>();
	private audioLibraries = new Map<string, AudioLibrary>();
	private sessionCounter = 0;
	private readonly maxConcurrentSessions = 50;
	private readonly supportedFormats = ['wav', 'mp3', 'ogg', 'aac', 'flac', 'opus'];
	private readonly telephonyFormats = ['wav', 'mp3', 'ogg', 'gsm', 'g711', 'g729'];

	constructor(apiClient: ThreeCXAPIClient) {
		this.apiClient = apiClient;
	}

	/**
	 * Play audio with advanced options and streaming support
	 */
	async playAudioAdvanced(
		callId: string, 
		audioPath: string, 
		options: AudioStreamOptions = {}
	): Promise<AudioResponse> {
		// Check concurrent session limit
		if (this.activePlaybackSessions.size >= this.maxConcurrentSessions) {
			throw new Error('Maximum concurrent audio sessions reached');
		}

		const sessionId = `audio-${++this.sessionCounter}-${Date.now()}`;
		
		try {
			// Create playback session
			const session: AudioPlaybackSession = {
				sessionId,
				callId,
				audioPath,
				startTime: new Date(),
				status: 'preparing',
				currentPosition: 0,
				totalDuration: 0,
				options,
			};

			this.activePlaybackSessions.set(sessionId, session);

			// Get audio metadata
			const metadata = await this.getAudioMetadata(audioPath);
			session.metadata = metadata;
			session.totalDuration = metadata.duration;

			// Check if format conversion is needed
			const needsConversion = this.needsFormatConversion(metadata.format);
			let finalAudioPath = audioPath;

			if (needsConversion) {
				finalAudioPath = await this.convertAudioFormat(audioPath, {
					sourceFormat: metadata.format as any,
					targetFormat: 'wav', // Default telephony format
					sampleRate: 8000, // Standard telephony sample rate
					channels: 1, // Mono for telephony
				});
			}

			// Prepare audio for streaming if enabled
			if (options.enableStreaming && metadata.size > (options.chunkSize || 1024 * 1024)) {
				return await this.playAudioStreaming(session, finalAudioPath, options);
			} else {
				return await this.playAudioDirect(session, finalAudioPath, options);
			}

		} catch (error) {
			// Clean up session on error
			this.activePlaybackSessions.delete(sessionId);
			throw error;
		}
	}

	/**
	 * Stream large audio files in chunks
	 */
	private async playAudioStreaming(
		session: AudioPlaybackSession,
		audioPath: string,
		options: AudioStreamOptions
	): Promise<AudioResponse> {
		session.status = 'playing';
		
		const response = await this.apiClient.request<AudioResponse>(`/calls/${session.callId}/play/stream`, {
			method: 'POST',
			body: {
				audio_path: audioPath,
				session_id: session.sessionId,
				streaming: true,
				chunk_size: options.chunkSize || 64 * 1024, // 64KB chunks
				buffer_size: options.bufferSize || 256 * 1024, // 256KB buffer
				adaptive_bitrate: options.adaptiveBitrate || false,
				target_bitrate: options.targetBitrate || 64000, // 64 kbps default
				...this.prepareAudioOptions(options),
			},
			timeout: 120000, // Longer timeout for streaming
		});

		if (!response.success) {
			session.status = 'error';
			throw new Error(response.error?.message || 'Failed to start audio streaming');
		}

		// Update session with response data
		session.status = response.data?.completed ? 'completed' : 'playing';
		session.currentPosition = response.data?.duration || 0;

		const result: AudioResponse = {
			result: 'success',
			success: true,
			callId: session.callId,
			operation: 'play_audio',
			audioPath: session.audioPath,
			completed: response.data?.completed || false,
			duration: response.data?.duration || 0,
			terminationReason: response.data?.terminationReason || 'playing',
			message: `Audio streaming started for call ${session.callId}`,
			timestamp: new Date(),
			data: {
				...response.data,
				sessionId: session.sessionId,
				streamingEnabled: true,
				metadata: session.metadata,
			},
		};

		return result;
	}

	/**
	 * Play audio directly (traditional method)
	 */
	private async playAudioDirect(
		session: AudioPlaybackSession,
		audioPath: string,
		options: AudioStreamOptions
	): Promise<AudioResponse> {
		session.status = 'playing';

		const response = await this.apiClient.request<AudioResponse>(`/calls/${session.callId}/play`, {
			method: 'POST',
			body: {
				audio_path: audioPath,
				session_id: session.sessionId,
				...this.prepareAudioOptions(options),
			},
			timeout: (session.totalDuration + 30) * 1000, // Duration + 30s buffer
		});

		if (!response.success) {
			session.status = 'error';
			throw new Error(response.error?.message || 'Failed to play audio');
		}

		// Update session status
		session.status = response.data?.completed ? 'completed' : 'playing';
		session.currentPosition = response.data?.duration || session.totalDuration;

		const result: AudioResponse = {
			result: 'success',
			success: true,
			callId: session.callId,
			operation: 'play_audio',
			audioPath: session.audioPath,
			completed: response.data?.completed || false,
			duration: response.data?.duration || 0,
			terminationReason: response.data?.terminationReason || 'completed',
			message: `Audio played successfully on call ${session.callId}`,
			timestamp: new Date(),
			data: {
				...response.data,
				sessionId: session.sessionId,
				streamingEnabled: false,
				metadata: session.metadata,
			},
		};

		// Clean up completed session
		if (result.completed) {
			this.activePlaybackSessions.delete(session.sessionId);
		}

		return result;
	}

	/**
	 * Control audio playback (pause, resume, stop, seek)
	 */
	async controlAudioPlayback(
		sessionId: string,
		action: 'pause' | 'resume' | 'stop' | 'seek',
		position?: number
	): Promise<{ success: boolean; message: string; session?: AudioPlaybackSession }> {
		const session = this.activePlaybackSessions.get(sessionId);
		if (!session) {
			throw new Error(`Audio session ${sessionId} not found`);
		}

		const response = await this.apiClient.request(`/calls/${session.callId}/play/control`, {
			method: 'POST',
			body: {
				session_id: sessionId,
				action,
				position,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || `Failed to ${action} audio playback`);
		}

		// Update session status
		switch (action) {
			case 'pause':
				session.status = 'paused';
				break;
			case 'resume':
				session.status = 'playing';
				break;
			case 'stop':
				session.status = 'stopped';
				this.activePlaybackSessions.delete(sessionId);
				break;
			case 'seek':
				session.currentPosition = position || session.currentPosition;
				break;
		}

		return {
			success: true,
			message: `Audio playback ${action} successful`,
			session: action !== 'stop' ? session : undefined,
		};
	}

	/**
	 * Get audio metadata (duration, format, etc.)
	 */
	async getAudioMetadata(audioPath: string): Promise<AudioMetadata> {
		// For local files, we would use a library like node-ffprobe
		// For remote files, we make an API call to get metadata
		if (audioPath.startsWith('http')) {
			const response = await this.apiClient.request<AudioMetadata>('/audio/metadata', {
				method: 'POST',
				body: { audio_url: audioPath },
			});

			if (!response.success) {
				throw new Error('Failed to get audio metadata');
			}

			return response.data!;
		} else {
			// Simulate metadata extraction for local files
			// In a real implementation, you would use ffprobe or similar
			return {
				format: this.detectAudioFormat(audioPath),
				duration: 30, // Placeholder
				sampleRate: 44100,
				bitDepth: 16,
				channels: 2,
				bitrate: 128000,
				size: 1024 * 1024, // 1MB placeholder
				codec: 'pcm',
			};
		}
	}

	/**
	 * Convert audio format for telephony compatibility
	 */
	async convertAudioFormat(
		sourcePath: string,
		options: AudioConversionOptions
	): Promise<string> {
		const response = await this.apiClient.request<{ converted_path: string }>('/audio/convert', {
			method: 'POST',
			body: {
				source_path: sourcePath,
				source_format: options.sourceFormat,
				target_format: options.targetFormat,
				sample_rate: options.sampleRate || 8000,
				bit_depth: options.bitDepth || 16,
				channels: options.channels || 1,
				quality: options.quality || 80,
			},
			timeout: 120000, // 2 minutes for conversion
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Audio format conversion failed');
		}

		return response.data!.converted_path;
	}

	/**
	 * Create and manage audio libraries
	 */
	async createAudioLibrary(name: string, description: string): Promise<AudioLibrary> {
		const library: AudioLibrary = {
			libraryId: `lib-${Date.now()}`,
			name,
			description,
			audioFiles: [],
			tags: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		this.audioLibraries.set(library.libraryId, library);
		return library;
	}

	/**
	 * Add audio file to library
	 */
	async addAudioToLibrary(
		libraryId: string,
		filePath: string,
		name: string,
		category: string = 'general',
		tags: string[] = []
	): Promise<AudioFile> {
		const library = this.audioLibraries.get(libraryId);
		if (!library) {
			throw new Error(`Audio library ${libraryId} not found`);
		}

		const metadata = await this.getAudioMetadata(filePath);
		const audioFile: AudioFile = {
			fileId: `file-${Date.now()}`,
			name,
			filePath,
			format: metadata.format,
			metadata,
			tags,
			category,
			isActive: true,
			uploadedAt: new Date(),
		};

		library.audioFiles.push(audioFile);
		library.updatedAt = new Date();

		return audioFile;
	}

	/**
	 * Search audio files in libraries
	 */
	searchAudioFiles(query: {
		libraryId?: string;
		category?: string;
		tags?: string[];
		format?: string;
		minDuration?: number;
		maxDuration?: number;
	}): AudioFile[] {
		let allFiles: AudioFile[] = [];

		// Collect files from specified library or all libraries
		if (query.libraryId) {
			const library = this.audioLibraries.get(query.libraryId);
			if (library) {
				allFiles = library.audioFiles;
			}
		} else {
			for (const library of this.audioLibraries.values()) {
				allFiles.push(...library.audioFiles);
			}
		}

		// Apply filters
		return allFiles.filter(file => {
			if (!file.isActive) return false;
			if (query.category && file.category !== query.category) return false;
			if (query.format && file.format !== query.format) return false;
			if (query.minDuration && file.metadata.duration < query.minDuration) return false;
			if (query.maxDuration && file.metadata.duration > query.maxDuration) return false;
			if (query.tags && query.tags.length > 0) {
				const hasMatchingTag = query.tags.some(tag => file.tags.includes(tag));
				if (!hasMatchingTag) return false;
			}
			return true;
		});
	}

	/**
	 * Get active playback sessions
	 */
	getActivePlaybackSessions(): AudioPlaybackSession[] {
		return Array.from(this.activePlaybackSessions.values());
	}

	/**
	 * Get playback session by ID
	 */
	getPlaybackSession(sessionId: string): AudioPlaybackSession | undefined {
		return this.activePlaybackSessions.get(sessionId);
	}

	/**
	 * Stop all active playback sessions
	 */
	async stopAllPlayback(): Promise<void> {
		const sessions = Array.from(this.activePlaybackSessions.keys());
		await Promise.all(sessions.map(sessionId => 
			this.controlAudioPlayback(sessionId, 'stop').catch(() => {})
		));
	}

	/**
	 * Helper methods
	 */
	private needsFormatConversion(format: string): boolean {
		return !this.telephonyFormats.includes(format.toLowerCase());
	}

	private detectAudioFormat(filePath: string): string {
		const extension = filePath.split('.').pop()?.toLowerCase() || '';
		return this.supportedFormats.includes(extension) ? extension : 'unknown';
	}

	private prepareAudioOptions(options: AudioStreamOptions): any {
		return {
			loop: options.loop || false,
			volume: options.volume || 100,
			stop_current: options.stopCurrent !== false, // Default true
			format: options.format,
			enable_compression: options.enableCompression || false,
			compression_quality: options.compressionQuality || 0.8,
		};
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.stopAllPlayback();
		this.activePlaybackSessions.clear();
		this.audioLibraries.clear();
	}
}

/**
 * Factory function to create advanced audio manager
 */
export function createAdvancedAudioManager(apiClient: ThreeCXAPIClient): AdvancedAudioManager {
	return new AdvancedAudioManager(apiClient);
}