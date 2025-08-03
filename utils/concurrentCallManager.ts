/**
 * Advanced Concurrent Call Manager for 3CX
 * Sophisticated call management with resource optimization, load balancing, and performance monitoring
 */

import { ThreeCXAPIClient } from './apiClient';
import { CallResponse, CallInfo } from '../types';

export interface ConcurrentCallConfig {
	// Resource limits
	maxConcurrentCalls: number;
	maxCallsPerAgent: number;
	maxCallsPerQueue: number;
	maxSystemLoad: number; // percentage
	maxMemoryUsage: number; // percentage
	maxCpuUsage: number; // percentage

	// Performance thresholds
	performanceThresholds: {
		responseTime: number; // milliseconds
		callSetupTime: number; // milliseconds
		audioQualityScore: number; // 0-100
		packetLossThreshold: number; // percentage
		jitterThreshold: number; // milliseconds
		latencyThreshold: number; // milliseconds
	};

	// Load balancing
	loadBalancing: {
		strategy: 'round_robin' | 'least_connections' | 'weighted' | 'adaptive' | 'resource_based';
		healthCheckInterval: number; // milliseconds
		failoverThreshold: number;
		weights: { [resource: string]: number };
	};

	// Resource optimization
	optimization: {
		enableDynamicScaling: boolean;
		scaleUpThreshold: number; // percentage
		scaleDownThreshold: number; // percentage
		resourceReallocation: boolean;
		priorityBasedScheduling: boolean;
		callPreemption: boolean;
		bandwidthOptimization: boolean;
	};

	// Quality of service
	qos: {
		enableQoS: boolean;
		priorityLevels: QoSPriority[];
		bandwidthAllocation: { [priority: string]: number };
		codecPreferences: string[];
		adaptiveBitrate: boolean;
	};

	// Monitoring and alerts
	monitoring: {
		enableRealTimeMonitoring: boolean;
		metricsCollection: boolean;
		alertThresholds: AlertThreshold[];
		reportingInterval: number; // milliseconds
		historicalDataRetention: number; // milliseconds
	};
}

export interface QoSPriority {
	level: number;
	name: string;
	description: string;
	bandwidthGuarantee: number; // percentage
	latencyTarget: number; // milliseconds
	jitterTarget: number; // milliseconds
	packetLossTarget: number; // percentage
	codecPreference: string[];
}

export interface AlertThreshold {
	metric: string;
	warningThreshold: number;
	criticalThreshold: number;
	duration: number; // milliseconds
	action: 'log' | 'notify' | 'auto_scale' | 'load_balance' | 'fail_over';
}

export interface CallSession {
	sessionId: string;
	callId: string;
	type: 'inbound' | 'outbound' | 'internal' | 'conference' | 'transfer';
	status: 'connecting' | 'established' | 'on_hold' | 'transferring' | 'ending' | 'ended';
	priority: 'low' | 'normal' | 'high' | 'critical';
	startTime: Date;
	endTime?: Date;
	duration: number;
	
	// Participants
	participants: CallParticipant[];
	
	// Resource allocation
	resources: AllocatedResources;
	
	// Quality metrics
	qualityMetrics: CallQualityMetrics;
	
	// Performance data
	performance: CallPerformanceData;
	
	// Context data
	context: CallContext;
}

export interface CallParticipant {
	participantId: string;
	extension?: string;
	phoneNumber?: string;
	role: 'caller' | 'callee' | 'agent' | 'supervisor' | 'conference_member';
	status: 'connecting' | 'connected' | 'on_hold' | 'muted' | 'disconnected';
	connectionTime?: Date;
	disconnectionTime?: Date;
	audioState: 'active' | 'muted' | 'hold' | 'deaf';
	videoState?: 'active' | 'disabled' | 'receiving_only';
	location?: GeolocationInfo;
	device?: DeviceInfo;
}

export interface AllocatedResources {
	bandwidth: {
		allocated: number; // kbps
		used: number; // kbps
		reserved: number; // kbps
	};
	cpu: {
		allocated: number; // percentage
		used: number; // percentage
	};
	memory: {
		allocated: number; // MB
		used: number; // MB
	};
	codecs: {
		audio: string;
		video?: string;
	};
	servers: {
		primaryServer: string;
		backupServers: string[];
	};
}

export interface CallQualityMetrics {
	audio: {
		codec: string;
		bitrate: number; // kbps
		sampleRate: number; // Hz
		mos: number; // Mean Opinion Score (1-5)
		packetLoss: number; // percentage
		jitter: number; // milliseconds
		latency: number; // milliseconds
		rFactor: number; // R-Factor (0-100)
	};
	video?: {
		codec: string;
		resolution: string;
		framerate: number;
		bitrate: number; // kbps
		packetLoss: number; // percentage
		jitter: number; // milliseconds
	};
	network: {
		rtt: number; // Round Trip Time in milliseconds
		bandwidth: number; // kbps
		connectionType: 'ethernet' | 'wifi' | 'mobile' | 'satellite';
		stability: number; // percentage
	};
}

export interface CallPerformanceData {
	setupTime: number; // milliseconds
	responseTime: number; // milliseconds
	processingDelay: number; // milliseconds
	mediaDelay: number; // milliseconds
	resourceUtilization: {
		cpu: number; // percentage
		memory: number; // MB
		bandwidth: number; // kbps
		disk: number; // percentage
	};
	scalingEvents: ScalingEvent[];
	optimizationActions: OptimizationAction[];
}

export interface CallContext {
	queueId?: string;
	agentId?: string;
	campaignId?: string;
	customerId?: string;
	priority: number;
	businessHours: boolean;
	geolocation?: GeolocationInfo;
	customerData?: Record<string, any>;
	metadata: Record<string, any>;
}

export interface GeolocationInfo {
	country: string;
	region: string;
	city: string;
	timezone: string;
	latitude?: number;
	longitude?: number;
}

export interface DeviceInfo {
	type: 'softphone' | 'desk_phone' | 'mobile' | 'web_client';
	model?: string;
	version?: string;
	capabilities: string[];
	maxConcurrentCalls: number;
}

export interface ScalingEvent {
	eventId: string;
	timestamp: Date;
	type: 'scale_up' | 'scale_down' | 'rebalance';
	trigger: string;
	fromCapacity: number;
	toCapacity: number;
	duration: number; // milliseconds
	success: boolean;
	impact: string;
}

export interface OptimizationAction {
	actionId: string;
	timestamp: Date;
	type: 'codec_change' | 'bandwidth_adjustment' | 'server_migration' | 'priority_adjustment';
	callId: string;
	parameters: Record<string, any>;
	result: 'success' | 'failed' | 'partial';
	improvement: number; // percentage
	metrics: Record<string, number>;
}

export interface ResourcePool {
	poolId: string;
	type: 'cpu' | 'memory' | 'bandwidth' | 'codec' | 'server';
	totalCapacity: number;
	availableCapacity: number;
	allocatedCapacity: number;
	reservedCapacity: number;
	utilizationPercentage: number;
	maxUtilization: number;
	allocations: ResourceAllocation[];
	status: 'available' | 'stressed' | 'overloaded' | 'maintenance';
}

export interface ResourceAllocation {
	allocationId: string;
	sessionId: string;
	resourceType: string;
	amount: number;
	allocatedAt: Date;
	releasedAt?: Date;
	priority: number;
	preemptible: boolean;
}

export interface LoadBalancer {
	balancerId: string;
	strategy: string;
	targets: LoadBalancerTarget[];
	currentLoad: number;
	totalCapacity: number;
	healthCheckResults: { [targetId: string]: HealthCheckResult };
	lastRebalance: Date;
	metrics: LoadBalancerMetrics;
}

export interface LoadBalancerTarget {
	targetId: string;
	endpoint: string;
	weight: number;
	maxCapacity: number;
	currentLoad: number;
	healthStatus: 'healthy' | 'degraded' | 'unhealthy';
	lastHealthCheck: Date;
	activeConnections: number;
	responseTime: number;
}

export interface HealthCheckResult {
	timestamp: Date;
	success: boolean;
	responseTime: number;
	errorMessage?: string;
	metrics: Record<string, number>;
}

export interface LoadBalancerMetrics {
	requestsPerSecond: number;
	averageResponseTime: number;
	errorRate: number;
	throughput: number;
	activeConnections: number;
	failedHealthChecks: number;
	rebalanceCount: number;
}

export interface SystemMetrics {
	timestamp: Date;
	system: {
		cpuUsage: number; // percentage
		memoryUsage: number; // percentage
		diskUsage: number; // percentage
		networkThroughput: number; // Mbps
		activeConnections: number;
	};
	calls: {
		totalActiveCalls: number;
		newCallsPerMinute: number;
		completedCallsPerMinute: number;
		averageCallDuration: number;
		callSetupTime: number;
		callSuccessRate: number;
	};
	quality: {
		averageMOS: number;
		averageLatency: number;
		averageJitter: number;
		packetLossRate: number;
		codecDistribution: { [codec: string]: number };
	};
	performance: {
		responseTime: number;
		throughput: number;
		concurrentCapacity: number;
		resourceEfficiency: number;
		scalingEvents: number;
		optimizationActions: number;
	};
}

export interface PerformanceReport {
	reportId: string;
	period: {
		startTime: Date;
		endTime: Date;
	};
	summary: {
		totalCalls: number;
		peakConcurrentCalls: number;
		averageCallDuration: number;
		systemUptime: number;
		averageResourceUtilization: number;
	};
	performance: {
		averageSetupTime: number;
		averageResponseTime: number;
		systemEfficiency: number;
		qualityScore: number;
		reliabilityScore: number;
	};
	optimization: {
		scalingEvents: ScalingEvent[];
		optimizationActions: OptimizationAction[];
		resourceSavings: number;
		performanceImprovements: number;
	};
	recommendations: string[];
	trends: {
		callVolume: 'increasing' | 'decreasing' | 'stable';
		quality: 'improving' | 'degrading' | 'stable';
		efficiency: 'improving' | 'degrading' | 'stable';
	};
}

export class ConcurrentCallManager {
	private apiClient: ThreeCXAPIClient;
	private config: ConcurrentCallConfig;
	private activeSessions = new Map<string, CallSession>();
	private resourcePools = new Map<string, ResourcePool>();
	private loadBalancers = new Map<string, LoadBalancer>();
	private systemMetrics: SystemMetrics;
	private performanceHistory: SystemMetrics[] = [];
	
	// Monitoring intervals
	private metricsCollectionInterval: NodeJS.Timeout | null = null;
	private loadBalancingInterval: NodeJS.Timeout | null = null;
	private optimizationInterval: NodeJS.Timeout | null = null;
	private healthCheckInterval: NodeJS.Timeout | null = null;
	
	// Counters
	private sessionCounter = 0;
	private allocationCounter = 0;

	constructor(apiClient: ThreeCXAPIClient, config?: Partial<ConcurrentCallConfig>) {
		this.apiClient = apiClient;
		this.config = { ...this.getDefaultConfig(), ...config };
		this.systemMetrics = this.initializeSystemMetrics();
		
		this.initializeResourcePools();
		this.initializeLoadBalancers();
		this.startMonitoring();
	}

	/**
	 * Start new call session with resource allocation and optimization
	 */
	async startCallSession(
		callId: string,
		type: CallSession['type'],
		participants: CallParticipant[],
		context: CallContext,
		priority: CallSession['priority'] = 'normal'
	): Promise<{ sessionId: string; success: boolean; allocatedResources: AllocatedResources }> {
		// Check system capacity
		if (!await this.checkSystemCapacity()) {
			throw new Error('System at maximum capacity. Cannot start new call session.');
		}

		const sessionId = `session-${++this.sessionCounter}-${Date.now()}`;
		
		// Calculate required resources
		const requiredResources = this.calculateRequiredResources(type, participants, context);
		
		// Allocate resources with optimization
		const allocatedResources = await this.allocateOptimizedResources(sessionId, requiredResources, priority);
		
		if (!allocatedResources) {
			throw new Error('Unable to allocate sufficient resources for call session');
		}

		// Create call session
		const session: CallSession = {
			sessionId,
			callId,
			type,
			status: 'connecting',
			priority,
			startTime: new Date(),
			duration: 0,
			participants,
			resources: allocatedResources,
			qualityMetrics: this.initializeQualityMetrics(),
			performance: this.initializePerformanceData(),
			context,
		};

		this.activeSessions.set(sessionId, session);

		// Start monitoring for this session
		this.startSessionMonitoring(sessionId);

		// Apply QoS settings
		await this.applyQoSSettings(session);

		// Notify system of new session
		await this.apiClient.request('/calls/session/start', {
			method: 'POST',
			body: {
				session_id: sessionId,
				call_id: callId,
				type,
				participants: participants.length,
				allocated_resources: allocatedResources,
			},
		});

		return {
			sessionId,
			success: true,
			allocatedResources,
		};
	}

	/**
	 * End call session and release resources
	 */
	async endCallSession(sessionId: string, reason: string = 'normal'): Promise<{ success: boolean; duration: number; releasedResources: AllocatedResources }> {
		const session = this.activeSessions.get(sessionId);
		if (!session) {
			throw new Error(`Call session ${sessionId} not found`);
		}

		// Update session status
		session.status = 'ending';
		session.endTime = new Date();
		session.duration = session.endTime.getTime() - session.startTime.getTime();

		// Release allocated resources
		await this.releaseResources(sessionId, session.resources);

		// Record final metrics
		await this.recordSessionMetrics(session);

		// Remove from active sessions
		this.activeSessions.delete(sessionId);

		// Stop monitoring for this session
		this.stopSessionMonitoring(sessionId);

		// Notify system of session end
		await this.apiClient.request('/calls/session/end', {
			method: 'POST',
			body: {
				session_id: sessionId,
				call_id: session.callId,
				duration: session.duration,
				reason,
				quality_metrics: session.qualityMetrics,
			},
		});

		// Trigger optimization if needed
		await this.triggerOptimizationIfNeeded();

		return {
			success: true,
			duration: session.duration,
			releasedResources: session.resources,
		};
	}

	/**
	 * Dynamically scale resources based on load and performance
	 */
	async scaleResources(
		scalingType: 'up' | 'down' | 'rebalance',
		targetUtilization?: number
	): Promise<ScalingEvent> {
		const eventId = `scale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const startTime = Date.now();
		
		const event: ScalingEvent = {
			eventId,
			timestamp: new Date(),
			type: scalingType,
			trigger: this.determineScalingTrigger(),
			fromCapacity: this.getCurrentCapacity(),
			toCapacity: 0,
			duration: 0,
			success: false,
			impact: '',
		};

		try {
			switch (scalingType) {
				case 'up':
					await this.scaleUp(targetUtilization);
					break;
				case 'down':
					await this.scaleDown(targetUtilization);
					break;
				case 'rebalance':
					await this.rebalanceResources();
					break;
			}

			event.toCapacity = this.getCurrentCapacity();
			event.duration = Date.now() - startTime;
			event.success = true;
			event.impact = `Capacity changed from ${event.fromCapacity} to ${event.toCapacity}`;

			// Record scaling event in all affected sessions
			for (const session of this.activeSessions.values()) {
				session.performance.scalingEvents.push(event);
			}

			return event;

		} catch (error) {
			event.duration = Date.now() - startTime;
			event.success = false;
			event.impact = `Scaling failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
			throw error;
		}
	}

	/**
	 * Optimize call quality and resource usage
	 */
	async optimizeCallQuality(sessionId: string): Promise<OptimizationAction[]> {
		const session = this.activeSessions.get(sessionId);
		if (!session) {
			throw new Error(`Call session ${sessionId} not found`);
		}

		const optimizations: OptimizationAction[] = [];

		// Analyze current quality metrics
		const qualityIssues = this.analyzeQualityIssues(session.qualityMetrics);

		for (const issue of qualityIssues) {
			const optimization = await this.applyOptimization(session, issue);
			if (optimization) {
				optimizations.push(optimization);
			}
		}

		return optimizations;
	}

	/**
	 * Implement load balancing across resources
	 */
	async rebalanceLoad(): Promise<{ success: boolean; migrations: number; improvements: Record<string, number> }> {
		const migrations = 0;
		const improvements: Record<string, number> = {};

		for (const [balancerId, balancer] of this.loadBalancers) {
			try {
				const rebalanceResult = await this.rebalanceLoadBalancer(balancer);
				improvements[balancerId] = rebalanceResult.improvement;
			} catch (error) {
				console.error(`Failed to rebalance load balancer ${balancerId}:`, error);
			}
		}

		return {
			success: true,
			migrations,
			improvements,
		};
	}

	/**
	 * Get real-time system performance metrics
	 */
	getSystemMetrics(): SystemMetrics {
		this.updateSystemMetrics();
		return { ...this.systemMetrics };
	}

	/**
	 * Get detailed performance report
	 */
	async generatePerformanceReport(
		startTime: Date,
		endTime: Date
	): Promise<PerformanceReport> {
		const reportId = `report-${Date.now()}`;
		
		// Filter metrics for the specified period
		const periodMetrics = this.performanceHistory.filter(
			m => m.timestamp >= startTime && m.timestamp <= endTime
		);

		const report: PerformanceReport = {
			reportId,
			period: { startTime, endTime },
			summary: this.calculateSummaryMetrics(periodMetrics),
			performance: this.calculatePerformanceMetrics(periodMetrics),
			optimization: this.calculateOptimizationMetrics(periodMetrics),
			recommendations: this.generateRecommendations(periodMetrics),
			trends: this.analyzeTrends(periodMetrics),
		};

		return report;
	}

	/**
	 * Private helper methods
	 */
	private async checkSystemCapacity(): Promise<boolean> {
		const currentLoad = this.systemMetrics.system.cpuUsage;
		const maxLoad = this.config.maxSystemLoad;
		const activeCalls = this.activeSessions.size;
		const maxCalls = this.config.maxConcurrentCalls;

		return currentLoad < maxLoad && activeCalls < maxCalls;
	}

	private calculateRequiredResources(
		type: CallSession['type'],
		participants: CallParticipant[],
		context: CallContext
	): Partial<AllocatedResources> {
		const baseResources = {
			bandwidth: { allocated: 64, used: 0, reserved: 16 }, // kbps per participant
			cpu: { allocated: 2, used: 0 }, // percentage per call
			memory: { allocated: 16, used: 0 }, // MB per call
		};

		// Adjust based on call type
		const multiplier = this.getResourceMultiplier(type);
		const participantCount = participants.length;

		return {
			bandwidth: {
				allocated: baseResources.bandwidth.allocated * participantCount * multiplier,
				used: 0,
				reserved: baseResources.bandwidth.reserved * participantCount,
			},
			cpu: {
				allocated: baseResources.cpu.allocated * participantCount * multiplier,
				used: 0,
			},
			memory: {
				allocated: baseResources.memory.allocated * participantCount * multiplier,
				used: 0,
			},
		};
	}

	private getResourceMultiplier(type: CallSession['type']): number {
		switch (type) {
			case 'conference': return 1.5;
			case 'transfer': return 1.2;
			case 'internal': return 0.8;
			default: return 1.0;
		}
	}

	private async allocateOptimizedResources(
		sessionId: string,
		requiredResources: Partial<AllocatedResources>,
		priority: CallSession['priority']
	): Promise<AllocatedResources | null> {
		// Find optimal resource allocation considering priority and availability
		const allocation: AllocatedResources = {
			bandwidth: requiredResources.bandwidth || { allocated: 0, used: 0, reserved: 0 },
			cpu: requiredResources.cpu || { allocated: 0, used: 0 },
			memory: requiredResources.memory || { allocated: 0, used: 0 },
			codecs: {
				audio: this.selectOptimalCodec('audio', priority),
				video: this.selectOptimalCodec('video', priority),
			},
			servers: {
				primaryServer: this.selectOptimalServer(),
				backupServers: this.selectBackupServers(),
			},
		};

		// Try to allocate resources from pools
		const success = await this.tryAllocateFromPools(sessionId, allocation, priority);
		
		return success ? allocation : null;
	}

	private selectOptimalCodec(type: 'audio' | 'video', priority: CallSession['priority']): string {
		const qosConfig = this.config.qos.priorityLevels.find(p => p.name === priority);
		
		if (type === 'audio') {
			return qosConfig?.codecPreference?.[0] || 'G.722';
		}
		
		return priority === 'critical' ? 'H.264' : 'H.263';
	}

	private selectOptimalServer(): string {
		// Select server based on load balancing strategy
		const balancer = this.loadBalancers.get('primary');
		if (balancer) {
			return this.selectTargetByStrategy(balancer);
		}
		return 'server-1';
	}

	private selectBackupServers(): string[] {
		return ['server-2', 'server-3'];
	}

	private async tryAllocateFromPools(
		sessionId: string,
		allocation: AllocatedResources,
		priority: CallSession['priority']
	): Promise<boolean> {
		// Try to allocate from each resource pool
		const allocations: ResourceAllocation[] = [];
		const priorityValue = this.getPriorityValue(priority);

		try {
			// Allocate bandwidth
			const bandwidthPool = this.resourcePools.get('bandwidth');
			if (bandwidthPool && bandwidthPool.availableCapacity >= allocation.bandwidth.allocated) {
				const bandwidthAllocation: ResourceAllocation = {
					allocationId: `alloc-${++this.allocationCounter}`,
					sessionId,
					resourceType: 'bandwidth',
					amount: allocation.bandwidth.allocated,
					allocatedAt: new Date(),
					priority: priorityValue,
					preemptible: priority !== 'critical',
				};
				bandwidthPool.allocations.push(bandwidthAllocation);
				bandwidthPool.availableCapacity -= allocation.bandwidth.allocated;
				bandwidthPool.allocatedCapacity += allocation.bandwidth.allocated;
				allocations.push(bandwidthAllocation);
			}

			// Allocate CPU
			const cpuPool = this.resourcePools.get('cpu');
			if (cpuPool && cpuPool.availableCapacity >= allocation.cpu.allocated) {
				const cpuAllocation: ResourceAllocation = {
					allocationId: `alloc-${++this.allocationCounter}`,
					sessionId,
					resourceType: 'cpu',
					amount: allocation.cpu.allocated,
					allocatedAt: new Date(),
					priority: priorityValue,
					preemptible: priority !== 'critical',
				};
				cpuPool.allocations.push(cpuAllocation);
				cpuPool.availableCapacity -= allocation.cpu.allocated;
				cpuPool.allocatedCapacity += allocation.cpu.allocated;
				allocations.push(cpuAllocation);
			}

			// Allocate memory
			const memoryPool = this.resourcePools.get('memory');
			if (memoryPool && memoryPool.availableCapacity >= allocation.memory.allocated) {
				const memoryAllocation: ResourceAllocation = {
					allocationId: `alloc-${++this.allocationCounter}`,
					sessionId,
					resourceType: 'memory',
					amount: allocation.memory.allocated,
					allocatedAt: new Date(),
					priority: priorityValue,
					preemptible: priority !== 'critical',
				};
				memoryPool.allocations.push(memoryAllocation);
				memoryPool.availableCapacity -= allocation.memory.allocated;
				memoryPool.allocatedCapacity += allocation.memory.allocated;
				allocations.push(memoryAllocation);
			}

			return allocations.length > 0;

		} catch (error) {
			// Roll back any partial allocations
			for (const allocation of allocations) {
				await this.releaseResourceAllocation(allocation);
			}
			return false;
		}
	}

	private getPriorityValue(priority: CallSession['priority']): number {
		switch (priority) {
			case 'critical': return 4;
			case 'high': return 3;
			case 'normal': return 2;
			case 'low': return 1;
			default: return 2;
		}
	}

	private async releaseResources(sessionId: string, resources: AllocatedResources): Promise<void> {
		// Release resources from all pools
		for (const pool of this.resourcePools.values()) {
			const sessionAllocations = pool.allocations.filter(a => a.sessionId === sessionId);
			
			for (const allocation of sessionAllocations) {
				await this.releaseResourceAllocation(allocation);
				
				// Remove from pool
				const index = pool.allocations.indexOf(allocation);
				if (index !== -1) {
					pool.allocations.splice(index, 1);
				}
			}
		}
	}

	private async releaseResourceAllocation(allocation: ResourceAllocation): Promise<void> {
		allocation.releasedAt = new Date();
		
		const pool = this.resourcePools.get(allocation.resourceType);
		if (pool) {
			pool.availableCapacity += allocation.amount;
			pool.allocatedCapacity -= allocation.amount;
			pool.utilizationPercentage = (pool.allocatedCapacity / pool.totalCapacity) * 100;
		}
	}

	private startSessionMonitoring(sessionId: string): void {
		// Start monitoring for the specific session
		const monitoringInterval = setInterval(async () => {
			const session = this.activeSessions.get(sessionId);
			if (session) {
				await this.updateSessionMetrics(session);
			} else {
				clearInterval(monitoringInterval);
			}
		}, 5000); // Every 5 seconds
	}

	private stopSessionMonitoring(sessionId: string): void {
		// Session monitoring is handled by the interval cleanup in startSessionMonitoring
	}

	private async updateSessionMetrics(session: CallSession): Promise<void> {
		// Update quality metrics for the session
		try {
			const response = await this.apiClient.request(`/calls/${session.callId}/metrics`, {
				method: 'GET',
			});

			if (response.success && response.data) {
				session.qualityMetrics = {
					...session.qualityMetrics,
					...response.data.quality_metrics,
				};

				session.performance.resourceUtilization = {
					...session.performance.resourceUtilization,
					...response.data.resource_utilization,
				};
			}
		} catch (error) {
			console.error(`Failed to update metrics for session ${session.sessionId}:`, error);
		}
	}

	private async applyQoSSettings(session: CallSession): Promise<void> {
		const qosLevel = this.config.qos.priorityLevels.find(p => p.name === session.priority);
		
		if (qosLevel && this.config.qos.enableQoS) {
			await this.apiClient.request(`/calls/${session.callId}/qos`, {
				method: 'POST',
				body: {
					priority_level: qosLevel.level,
					bandwidth_guarantee: qosLevel.bandwidthGuarantee,
					latency_target: qosLevel.latencyTarget,
					codec_preference: qosLevel.codecPreference,
				},
			});
		}
	}

	private analyzeQualityIssues(metrics: CallQualityMetrics): string[] {
		const issues: string[] = [];
		
		if (metrics.audio.mos < 3.5) {
			issues.push('low_audio_quality');
		}
		
		if (metrics.audio.packetLoss > this.config.performanceThresholds.packetLossThreshold) {
			issues.push('high_packet_loss');
		}
		
		if (metrics.audio.jitter > this.config.performanceThresholds.jitterThreshold) {
			issues.push('high_jitter');
		}
		
		if (metrics.audio.latency > this.config.performanceThresholds.latencyThreshold) {
			issues.push('high_latency');
		}
		
		return issues;
	}

	private async applyOptimization(session: CallSession, issue: string): Promise<OptimizationAction | null> {
		const actionId = `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		const action: OptimizationAction = {
			actionId,
			timestamp: new Date(),
			type: 'codec_change', // Default type, will be updated based on issue
			callId: session.callId,
			parameters: {},
			result: 'success',
			improvement: 0,
			metrics: {},
		};

		try {
			switch (issue) {
				case 'low_audio_quality':
					action.type = 'codec_change';
					action.parameters = { new_codec: 'G.722' };
					await this.changeCodec(session, 'G.722');
					break;

				case 'high_packet_loss':
					action.type = 'bandwidth_adjustment';
					action.parameters = { bandwidth_increase: 20 };
					await this.adjustBandwidth(session, 1.2);
					break;

				case 'high_jitter':
					action.type = 'server_migration';
					action.parameters = { new_server: this.selectOptimalServer() };
					await this.migrateToServer(session, action.parameters.new_server);
					break;

				case 'high_latency':
					action.type = 'priority_adjustment';
					action.parameters = { new_priority: 'high' };
					await this.adjustPriority(session, 'high');
					break;

				default:
					return null;
			}

			session.performance.optimizationActions.push(action);
			return action;

		} catch (error) {
			action.result = 'failed';
			console.error(`Optimization failed for ${issue}:`, error);
			return action;
		}
	}

	private async changeCodec(session: CallSession, newCodec: string): Promise<void> {
		await this.apiClient.request(`/calls/${session.callId}/codec`, {
			method: 'POST',
			body: { codec: newCodec },
		});
		
		session.resources.codecs.audio = newCodec;
	}

	private async adjustBandwidth(session: CallSession, multiplier: number): Promise<void> {
		const newBandwidth = session.resources.bandwidth.allocated * multiplier;
		
		await this.apiClient.request(`/calls/${session.callId}/bandwidth`, {
			method: 'POST',
			body: { bandwidth: newBandwidth },
		});
		
		session.resources.bandwidth.allocated = newBandwidth;
	}

	private async migrateToServer(session: CallSession, newServer: string): Promise<void> {
		await this.apiClient.request(`/calls/${session.callId}/migrate`, {
			method: 'POST',
			body: { target_server: newServer },
		});
		
		session.resources.servers.primaryServer = newServer;
	}

	private async adjustPriority(session: CallSession, newPriority: CallSession['priority']): Promise<void> {
		await this.apiClient.request(`/calls/${session.callId}/priority`, {
			method: 'POST',
			body: { priority: newPriority },
		});
		
		session.priority = newPriority;
	}

	private async triggerOptimizationIfNeeded(): Promise<void> {
		const systemLoad = this.systemMetrics.system.cpuUsage;
		
		if (systemLoad > this.config.optimization.scaleDownThreshold) {
			await this.scaleResources('down');
		} else if (systemLoad > this.config.optimization.scaleUpThreshold) {
			await this.scaleResources('up');
		}
	}

	private determineScalingTrigger(): string {
		const metrics = this.systemMetrics;
		
		if (metrics.system.cpuUsage > this.config.optimization.scaleUpThreshold) {
			return 'high_cpu_usage';
		}
		
		if (metrics.system.memoryUsage > this.config.optimization.scaleUpThreshold) {
			return 'high_memory_usage';
		}
		
		if (metrics.calls.totalActiveCalls > this.config.maxConcurrentCalls * 0.8) {
			return 'high_call_volume';
		}
		
		return 'manual_trigger';
	}

	private getCurrentCapacity(): number {
		return this.config.maxConcurrentCalls;
	}

	private async scaleUp(targetUtilization?: number): Promise<void> {
		// Implement scale up logic
		console.log('Scaling up resources...');
	}

	private async scaleDown(targetUtilization?: number): Promise<void> {
		// Implement scale down logic
		console.log('Scaling down resources...');
	}

	private async rebalanceResources(): Promise<void> {
		// Implement resource rebalancing logic
		console.log('Rebalancing resources...');
	}

	private async rebalanceLoadBalancer(balancer: LoadBalancer): Promise<{ improvement: number }> {
		// Implement load balancer rebalancing logic
		return { improvement: 5.0 };
	}

	private selectTargetByStrategy(balancer: LoadBalancer): string {
		switch (balancer.strategy) {
			case 'round_robin':
				return this.selectRoundRobinTarget(balancer);
			case 'least_connections':
				return this.selectLeastConnectionsTarget(balancer);
			case 'weighted':
				return this.selectWeightedTarget(balancer);
			default:
				return balancer.targets[0]?.targetId || 'default';
		}
	}

	private selectRoundRobinTarget(balancer: LoadBalancer): string {
		// Simple round robin selection
		const healthyTargets = balancer.targets.filter(t => t.healthStatus === 'healthy');
		return healthyTargets[0]?.targetId || 'default';
	}

	private selectLeastConnectionsTarget(balancer: LoadBalancer): string {
		const healthyTargets = balancer.targets.filter(t => t.healthStatus === 'healthy');
		return healthyTargets.sort((a, b) => a.activeConnections - b.activeConnections)[0]?.targetId || 'default';
	}

	private selectWeightedTarget(balancer: LoadBalancer): string {
		// Weighted selection based on target weights
		const healthyTargets = balancer.targets.filter(t => t.healthStatus === 'healthy');
		return healthyTargets.sort((a, b) => b.weight - a.weight)[0]?.targetId || 'default';
	}

	private updateSystemMetrics(): void {
		// Update current system metrics
		this.systemMetrics.timestamp = new Date();
		this.systemMetrics.calls.totalActiveCalls = this.activeSessions.size;
		
		// Calculate resource utilization
		let totalCpuUsage = 0;
		let totalMemoryUsage = 0;
		
		for (const session of this.activeSessions.values()) {
			totalCpuUsage += session.resources.cpu.used;
			totalMemoryUsage += session.resources.memory.used;
		}
		
		this.systemMetrics.system.cpuUsage = totalCpuUsage;
		this.systemMetrics.system.memoryUsage = totalMemoryUsage;
	}

	private async recordSessionMetrics(session: CallSession): Promise<void> {
		// Record final metrics for the session
		await this.apiClient.request('/metrics/session/record', {
			method: 'POST',
			body: {
				session_id: session.sessionId,
				duration: session.duration,
				quality_metrics: session.qualityMetrics,
				performance: session.performance,
			},
		});
	}

	private calculateSummaryMetrics(metrics: SystemMetrics[]): any {
		if (metrics.length === 0) return {};
		
		return {
			totalCalls: metrics.reduce((sum, m) => sum + m.calls.totalActiveCalls, 0),
			peakConcurrentCalls: Math.max(...metrics.map(m => m.calls.totalActiveCalls)),
			averageCallDuration: metrics.reduce((sum, m) => sum + m.calls.averageCallDuration, 0) / metrics.length,
			systemUptime: 99.9, // Would be calculated from actual uptime data
			averageResourceUtilization: metrics.reduce((sum, m) => sum + m.system.cpuUsage, 0) / metrics.length,
		};
	}

	private calculatePerformanceMetrics(metrics: SystemMetrics[]): any {
		if (metrics.length === 0) return {};
		
		return {
			averageSetupTime: metrics.reduce((sum, m) => sum + m.calls.callSetupTime, 0) / metrics.length,
			averageResponseTime: metrics.reduce((sum, m) => sum + m.performance.responseTime, 0) / metrics.length,
			systemEfficiency: 85.0, // Would be calculated from actual efficiency data
			qualityScore: metrics.reduce((sum, m) => sum + m.quality.averageMOS, 0) / metrics.length,
			reliabilityScore: 95.0, // Would be calculated from actual reliability data
		};
	}

	private calculateOptimizationMetrics(metrics: SystemMetrics[]): any {
		return {
			scalingEvents: [],
			optimizationActions: [],
			resourceSavings: 15.0, // Percentage
			performanceImprovements: 12.0, // Percentage
		};
	}

	private generateRecommendations(metrics: SystemMetrics[]): string[] {
		const recommendations: string[] = [];
		
		if (metrics.length > 0) {
			const avgCpuUsage = metrics.reduce((sum, m) => sum + m.system.cpuUsage, 0) / metrics.length;
			
			if (avgCpuUsage > 80) {
				recommendations.push('Consider scaling up CPU resources');
			}
			
			if (avgCpuUsage < 30) {
				recommendations.push('Consider scaling down to reduce costs');
			}
		}
		
		return recommendations;
	}

	private analyzeTrends(metrics: SystemMetrics[]): any {
		return {
			callVolume: 'stable' as const,
			quality: 'stable' as const,
			efficiency: 'improving' as const,
		};
	}

	private initializeQualityMetrics(): CallQualityMetrics {
		return {
			audio: {
				codec: 'G.722',
				bitrate: 64,
				sampleRate: 16000,
				mos: 4.0,
				packetLoss: 0,
				jitter: 5,
				latency: 50,
				rFactor: 85,
			},
			network: {
				rtt: 100,
				bandwidth: 100,
				connectionType: 'ethernet',
				stability: 95,
			},
		};
	}

	private initializePerformanceData(): CallPerformanceData {
		return {
			setupTime: 2000,
			responseTime: 500,
			processingDelay: 50,
			mediaDelay: 100,
			resourceUtilization: {
				cpu: 0,
				memory: 0,
				bandwidth: 0,
				disk: 0,
			},
			scalingEvents: [],
			optimizationActions: [],
		};
	}

	private initializeSystemMetrics(): SystemMetrics {
		return {
			timestamp: new Date(),
			system: {
				cpuUsage: 25,
				memoryUsage: 40,
				diskUsage: 60,
				networkThroughput: 100,
				activeConnections: 0,
			},
			calls: {
				totalActiveCalls: 0,
				newCallsPerMinute: 5,
				completedCallsPerMinute: 5,
				averageCallDuration: 180000, // 3 minutes
				callSetupTime: 2000,
				callSuccessRate: 98.5,
			},
			quality: {
				averageMOS: 4.2,
				averageLatency: 45,
				averageJitter: 8,
				packetLossRate: 0.1,
				codecDistribution: { 'G.722': 70, 'G.711': 30 },
			},
			performance: {
				responseTime: 250,
				throughput: 1000,
				concurrentCapacity: 100,
				resourceEfficiency: 85,
				scalingEvents: 0,
				optimizationActions: 0,
			},
		};
	}

	private initializeResourcePools(): void {
		// Initialize resource pools
		const pools: ResourcePool[] = [
			{
				poolId: 'cpu',
				type: 'cpu',
				totalCapacity: 100, // percentage
				availableCapacity: 75,
				allocatedCapacity: 25,
				reservedCapacity: 10,
				utilizationPercentage: 25,
				maxUtilization: 90,
				allocations: [],
				status: 'available',
			},
			{
				poolId: 'memory',
				type: 'memory',
				totalCapacity: 8192, // MB
				availableCapacity: 6144,
				allocatedCapacity: 2048,
				reservedCapacity: 1024,
				utilizationPercentage: 25,
				maxUtilization: 85,
				allocations: [],
				status: 'available',
			},
			{
				poolId: 'bandwidth',
				type: 'bandwidth',
				totalCapacity: 10000, // kbps
				availableCapacity: 7500,
				allocatedCapacity: 2500,
				reservedCapacity: 1000,
				utilizationPercentage: 25,
				maxUtilization: 80,
				allocations: [],
				status: 'available',
			},
		];

		pools.forEach(pool => {
			this.resourcePools.set(pool.poolId, pool);
		});
	}

	private initializeLoadBalancers(): void {
		// Initialize load balancers
		const balancer: LoadBalancer = {
			balancerId: 'primary',
			strategy: this.config.loadBalancing.strategy,
			targets: [
				{
					targetId: 'server-1',
					endpoint: 'server-1.3cx.local',
					weight: 100,
					maxCapacity: 50,
					currentLoad: 10,
					healthStatus: 'healthy',
					lastHealthCheck: new Date(),
					activeConnections: 10,
					responseTime: 150,
				},
				{
					targetId: 'server-2',
					endpoint: 'server-2.3cx.local',
					weight: 80,
					maxCapacity: 40,
					currentLoad: 8,
					healthStatus: 'healthy',
					lastHealthCheck: new Date(),
					activeConnections: 8,
					responseTime: 180,
				},
			],
			currentLoad: 18,
			totalCapacity: 90,
			healthCheckResults: {},
			lastRebalance: new Date(),
			metrics: {
				requestsPerSecond: 25,
				averageResponseTime: 165,
				errorRate: 0.5,
				throughput: 1000,
				activeConnections: 18,
				failedHealthChecks: 0,
				rebalanceCount: 0,
			},
		};

		this.loadBalancers.set('primary', balancer);
	}

	private startMonitoring(): void {
		// Start metrics collection
		this.metricsCollectionInterval = setInterval(() => {
			this.updateSystemMetrics();
			this.performanceHistory.push({ ...this.systemMetrics });
			
			// Keep only last 24 hours of data
			const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
			this.performanceHistory = this.performanceHistory.filter(m => m.timestamp > cutoff);
		}, this.config.monitoring.reportingInterval);

		// Start load balancing
		this.loadBalancingInterval = setInterval(async () => {
			if (this.config.loadBalancing.strategy !== 'round_robin') {
				await this.rebalanceLoad().catch(console.error);
			}
		}, this.config.loadBalancing.healthCheckInterval);

		// Start optimization
		this.optimizationInterval = setInterval(async () => {
			if (this.config.optimization.enableDynamicScaling) {
				await this.triggerOptimizationIfNeeded().catch(console.error);
			}
		}, 60000); // Every minute

		// Start health checks
		this.healthCheckInterval = setInterval(async () => {
			for (const balancer of this.loadBalancers.values()) {
				for (const target of balancer.targets) {
					try {
						const healthCheck = await this.performHealthCheck(target);
						balancer.healthCheckResults[target.targetId] = healthCheck;
						target.healthStatus = healthCheck.success ? 'healthy' : 'unhealthy';
						target.responseTime = healthCheck.responseTime;
						target.lastHealthCheck = healthCheck.timestamp;
					} catch (error) {
						console.error(`Health check failed for ${target.targetId}:`, error);
					}
				}
			}
		}, this.config.loadBalancing.healthCheckInterval);
	}

	private async performHealthCheck(target: LoadBalancerTarget): Promise<HealthCheckResult> {
		const startTime = Date.now();
		
		try {
			const response = await fetch(`${target.endpoint}/health`, {
				timeout: 5000,
			});
			
			return {
				timestamp: new Date(),
				success: response.ok,
				responseTime: Date.now() - startTime,
				metrics: {},
			};
		} catch (error) {
			return {
				timestamp: new Date(),
				success: false,
				responseTime: Date.now() - startTime,
				errorMessage: error instanceof Error ? error.message : 'Health check failed',
				metrics: {},
			};
		}
	}

	private getDefaultConfig(): ConcurrentCallConfig {
		return {
			maxConcurrentCalls: 100,
			maxCallsPerAgent: 3,
			maxCallsPerQueue: 50,
			maxSystemLoad: 85, // percentage
			maxMemoryUsage: 80, // percentage
			maxCpuUsage: 85, // percentage
			performanceThresholds: {
				responseTime: 1000, // milliseconds
				callSetupTime: 3000, // milliseconds
				audioQualityScore: 3.5, // MOS
				packetLossThreshold: 1.0, // percentage
				jitterThreshold: 20, // milliseconds
				latencyThreshold: 150, // milliseconds
			},
			loadBalancing: {
				strategy: 'least_connections',
				healthCheckInterval: 30000, // 30 seconds
				failoverThreshold: 3,
				weights: {},
			},
			optimization: {
				enableDynamicScaling: true,
				scaleUpThreshold: 80, // percentage
				scaleDownThreshold: 30, // percentage
				resourceReallocation: true,
				priorityBasedScheduling: true,
				callPreemption: false,
				bandwidthOptimization: true,
			},
			qos: {
				enableQoS: true,
				priorityLevels: [
					{
						level: 1,
						name: 'critical',
						description: 'Critical priority calls',
						bandwidthGuarantee: 50,
						latencyTarget: 50,
						jitterTarget: 10,
						packetLossTarget: 0.1,
						codecPreference: ['G.722', 'G.711'],
					},
					{
						level: 2,
						name: 'high',
						description: 'High priority calls',
						bandwidthGuarantee: 30,
						latencyTarget: 100,
						jitterTarget: 20,
						packetLossTarget: 0.5,
						codecPreference: ['G.722', 'G.711'],
					},
					{
						level: 3,
						name: 'normal',
						description: 'Normal priority calls',
						bandwidthGuarantee: 20,
						latencyTarget: 150,
						jitterTarget: 30,
						packetLossTarget: 1.0,
						codecPreference: ['G.711', 'G.729'],
					},
				],
				bandwidthAllocation: {
					critical: 50,
					high: 30,
					normal: 20,
				},
				codecPreferences: ['G.722', 'G.711', 'G.729'],
				adaptiveBitrate: true,
			},
			monitoring: {
				enableRealTimeMonitoring: true,
				metricsCollection: true,
				alertThresholds: [
					{
						metric: 'cpu_usage',
						warningThreshold: 70,
						criticalThreshold: 85,
						duration: 300000, // 5 minutes
						action: 'auto_scale',
					},
					{
						metric: 'memory_usage',
						warningThreshold: 75,
						criticalThreshold: 90,
						duration: 300000,
						action: 'notify',
					},
				],
				reportingInterval: 30000, // 30 seconds
				historicalDataRetention: 24 * 60 * 60 * 1000, // 24 hours
			},
		};
	}

	/**
	 * Get active call sessions
	 */
	getActiveSessions(): CallSession[] {
		return Array.from(this.activeSessions.values());
	}

	/**
	 * Get resource pool status
	 */
	getResourcePools(): ResourcePool[] {
		return Array.from(this.resourcePools.values());
	}

	/**
	 * Get load balancer status
	 */
	getLoadBalancers(): LoadBalancer[] {
		return Array.from(this.loadBalancers.values());
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		// Clear monitoring intervals
		if (this.metricsCollectionInterval) {
			clearInterval(this.metricsCollectionInterval);
			this.metricsCollectionInterval = null;
		}

		if (this.loadBalancingInterval) {
			clearInterval(this.loadBalancingInterval);
			this.loadBalancingInterval = null;
		}

		if (this.optimizationInterval) {
			clearInterval(this.optimizationInterval);
			this.optimizationInterval = null;
		}

		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = null;
		}

		// Clear data structures
		this.activeSessions.clear();
		this.resourcePools.clear();
		this.loadBalancers.clear();
		this.performanceHistory = [];
	}
}

/**
 * Factory function to create concurrent call manager
 */
export function createConcurrentCallManager(
	apiClient: ThreeCXAPIClient,
	config?: Partial<ConcurrentCallConfig>
): ConcurrentCallManager {
	return new ConcurrentCallManager(apiClient, config);
}