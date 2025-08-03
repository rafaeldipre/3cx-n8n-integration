/**
 * Advanced Call Queue Manager for 3CX
 * Comprehensive queue management with real-time monitoring, skill-based routing, and advanced analytics
 */

import { ThreeCXAPIClient } from './apiClient';
import { CallInfo } from '../types';

export interface CallQueue {
	queueId: string;
	name: string;
	description: string;
	extension: string;
	status: 'active' | 'paused' | 'disabled' | 'maintenance';
	priority: number;
	maxWaitTime: number; // seconds
	maxQueueSize: number;
	currentQueueSize: number;
	averageWaitTime: number;
	settings: QueueSettings;
	agents: QueueAgent[];
	waitingCalls: QueuedCall[];
	statistics: QueueStatistics;
	skillRequirements: string[];
	businessHours: BusinessHours[];
	overflow: OverflowSettings;
	announcements: QueueAnnouncements;
	metadata: Record<string, any>;
	createdAt: Date;
	lastModified: Date;
}

export interface QueueSettings {
	/** Call distribution strategy */
	distributionStrategy: 'round_robin' | 'longest_idle' | 'skill_based' | 'priority_based' | 'load_balanced';
	/** Maximum time to ring agent before trying next */
	agentTimeout: number;
	/** Enable call recording for queue calls */
	recordCalls: boolean;
	/** Wrap-up time after each call */
	wrapUpTime: number;
	/** Allow call back option */
	enableCallback: boolean;
	/** Position announcements */
	announcePosition: boolean;
	/** Wait time announcements */
	announceWaitTime: boolean;
	/** Music on hold during wait */
	musicOnHold: boolean;
	/** Music file path */
	musicFilePath?: string;
	/** Service level target (seconds) */
	serviceLevelTarget: number;
	/** Service level percentage goal */
	serviceLevelGoal: number;
	/** Abandon call threshold (seconds) */
	abandonThreshold: number;
	/** Priority escalation rules */
	priorityEscalation: PriorityEscalationRule[];
	/** Queue closed message */
	closedMessage?: string;
}

export interface QueueAgent {
	agentId: string;
	extension: string;
	name: string;
	status: 'available' | 'busy' | 'on_call' | 'wrap_up' | 'break' | 'offline' | 'not_ready';
	skills: AgentSkill[];
	priority: number;
	maxConcurrentCalls: number;
	currentCalls: number;
	lastCallTime?: Date;
	idleTime: number; // seconds
	totalCalls: number;
	totalTalkTime: number;
	totalWrapTime: number;
	averageCallDuration: number;
	loginTime?: Date;
	performance: AgentPerformance;
	schedule: AgentSchedule[];
	metadata: Record<string, any>;
}

export interface AgentSkill {
	skillName: string;
	level: number; // 1-10
	certified: boolean;
	lastTrained?: Date;
}

export interface AgentPerformance {
	callsHandled: number;
	averageHandleTime: number;
	customerSatisfactionScore: number;
	firstCallResolutionRate: number;
	escalationRate: number;
	adherenceToSchedule: number;
	qualityScore: number;
}

export interface AgentSchedule {
	dayOfWeek: number; // 0-6 (Sunday-Saturday)
	startTime: string; // HH:MM
	endTime: string; // HH:MM
	breaks: {
		startTime: string;
		endTime: string;
		type: 'break' | 'lunch' | 'training';
	}[];
}

export interface QueuedCall {
	callId: string;
	fromNumber: string;
	toNumber: string;
	queueEntryTime: Date;
	estimatedWaitTime: number;
	currentPosition: number;
	priority: 'low' | 'normal' | 'high' | 'urgent';
	requiredSkills: string[];
	customerData?: CustomerData;
	callbackRequested: boolean;
	callbackNumber?: string;
	previousAttempts: number;
	languagePreference?: string;
	metadata: Record<string, any>;
}

export interface CustomerData {
	customerId?: string;
	name?: string;
	vipStatus: boolean;
	customerTier: 'bronze' | 'silver' | 'gold' | 'platinum';
	preferredAgent?: string;
	lastInteraction?: Date;
	averageCallDuration?: number;
	totalCalls?: number;
	issueHistory?: string[];
}

export interface QueueStatistics {
	date: Date;
	totalCalls: number;
	answeredCalls: number;
	abandonedCalls: number;
	averageWaitTime: number;
	maxWaitTime: number;
	averageHandleTime: number;
	serviceLevelAchieved: number;
	abandonRate: number;
	firstCallResolution: number;
	totalTalkTime: number;
	totalWrapTime: number;
	hourlyStats: HourlyQueueStats[];
	agentUtilization: number;
	customerSatisfaction: number;
	costPerCall: number;
	revenuePerCall: number;
}

export interface HourlyQueueStats {
	hour: number;
	callsReceived: number;
	callsAnswered: number;
	callsAbandoned: number;
	averageWaitTime: number;
	averageHandleTime: number;
	serviceLevelAchieved: number;
	agentsAvailable: number;
	agentsOnCall: number;
}

export interface BusinessHours {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	timezone: string;
	holidays: Date[];
}

export interface OverflowSettings {
	enabled: boolean;
	thresholds: {
		maxWaitTime: number;
		maxQueueSize: number;
		serviceLevelThreshold: number;
	};
	actions: OverflowAction[];
}

export interface OverflowAction {
	type: 'transfer_to_queue' | 'voicemail' | 'callback' | 'external_number' | 'announcement';
	destination: string;
	priority: number;
	conditions: string[];
}

export interface QueueAnnouncements {
	welcomeMessage: string;
	positionAnnouncement: string;
	waitTimeAnnouncement: string;
	holdMessage: string;
	callbackOffer: string;
	queueClosedMessage: string;
	transferMessage: string;
	customAnnouncements: { [key: string]: string };
}

export interface PriorityEscalationRule {
	fromPriority: string;
	toPriority: string;
	condition: 'wait_time' | 'queue_position' | 'customer_tier' | 'retry_count';
	threshold: number;
	escalateAfter: number; // seconds
}

export interface QueueMetrics {
	queueId: string;
	timestamp: Date;
	realTimeMetrics: {
		currentWaitingCalls: number;
		longestWaitTime: number;
		averageWaitTime: number;
		availableAgents: number;
		busyAgents: number;
		totalAgents: number;
		serviceLevelCurrent: number;
		abandonRateCurrent: number;
		callsInLastHour: number;
		estimatedWaitTime: number;
	};
	performanceMetrics: {
		serviceLevelToday: number;
		abandonRateToday: number;
		averageHandleTimeToday: number;
		firstCallResolutionToday: number;
		customerSatisfactionToday: number;
		agentUtilizationToday: number;
		costEfficiencyToday: number;
	};
	predictiveMetrics: {
		expectedCallVolume: number;
		recommendedStaffing: number;
		serviceLevelForecast: number;
		waitTimeForecast: number;
		abandonRateForecast: number;
	};
}

export interface CallbackRequest {
	requestId: string;
	queueId: string;
	originalCallId: string;
	customerNumber: string;
	requestedTime?: Date;
	priority: string;
	estimatedCallback: Date;
	status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
	attempts: number;
	notes?: string;
	requiredSkills: string[];
	preferredAgent?: string;
	createdAt: Date;
}

export interface QueueReport {
	reportId: string;
	queueId: string;
	reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
	period: {
		startDate: Date;
		endDate: Date;
	};
	summary: QueueReportSummary;
	agentPerformance: AgentPerformanceReport[];
	callDistribution: CallDistributionReport;
	serviceLevel: ServiceLevelReport;
	trends: TrendAnalysis;
	recommendations: string[];
	generatedAt: Date;
}

export interface QueueReportSummary {
	totalCalls: number;
	answeredCalls: number;
	abandonedCalls: number;
	averageWaitTime: number;
	averageHandleTime: number;
	serviceLevelAchieved: number;
	customerSatisfaction: number;
	costPerCall: number;
	revenueImpact: number;
}

export interface AgentPerformanceReport {
	agentId: string;
	name: string;
	callsHandled: number;
	averageHandleTime: number;
	utilization: number;
	qualityScore: number;
	customerSatisfaction: number;
	adherenceToSchedule: number;
	ranking: number;
}

export interface CallDistributionReport {
	hourlyDistribution: { hour: number; calls: number }[];
	dailyDistribution: { day: string; calls: number }[];
	skillDistribution: { skill: string; calls: number }[];
	priorityDistribution: { priority: string; calls: number }[];
}

export interface ServiceLevelReport {
	targetServiceLevel: number;
	achievedServiceLevel: number;
	variance: number;
	hourlyServiceLevels: { hour: number; serviceLevel: number }[];
	recommendations: string[];
}

export interface TrendAnalysis {
	callVolumeTrend: string; // 'increasing' | 'decreasing' | 'stable'
	waitTimeTrend: string;
	abandonRateTrend: string;
	serviceLevelTrend: string;
	seasonalPatterns: string[];
	anomalies: string[];
}

export class CallQueueManager {
	private apiClient: ThreeCXAPIClient;
	private queues = new Map<string, CallQueue>();
	private queueMetrics = new Map<string, QueueMetrics>();
	private callbackRequests = new Map<string, CallbackRequest>();
	private queueReports = new Map<string, QueueReport>();
	private queueCounter = 0;
	private metricsUpdateInterval: NodeJS.Timeout | null = null;

	constructor(apiClient: ThreeCXAPIClient) {
		this.apiClient = apiClient;
		this.startMetricsCollection();
	}

	/**
	 * Create new call queue
	 */
	async createQueue(
		name: string,
		extension: string,
		options: Partial<CallQueue> = {}
	): Promise<CallQueue> {
		const queueId = `queue-${++this.queueCounter}-${Date.now()}`;

		const queue: CallQueue = {
			queueId,
			name,
			description: options.description || '',
			extension,
			status: 'active',
			priority: options.priority || 1,
			maxWaitTime: options.maxWaitTime || 300, // 5 minutes
			maxQueueSize: options.maxQueueSize || 100,
			currentQueueSize: 0,
			averageWaitTime: 0,
			settings: options.settings || this.getDefaultQueueSettings(),
			agents: options.agents || [],
			waitingCalls: [],
			statistics: this.initializeQueueStatistics(),
			skillRequirements: options.skillRequirements || [],
			businessHours: options.businessHours || this.getDefaultBusinessHours(),
			overflow: options.overflow || this.getDefaultOverflowSettings(),
			announcements: options.announcements || this.getDefaultAnnouncements(),
			metadata: options.metadata || {},
			createdAt: new Date(),
			lastModified: new Date(),
		};

		const response = await this.apiClient.request('/queues/create', {
			method: 'POST',
			body: {
				queue_id: queueId,
				name,
				extension,
				settings: queue.settings,
				business_hours: queue.businessHours,
				overflow: queue.overflow,
				announcements: queue.announcements,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to create call queue');
		}

		this.queues.set(queueId, queue);

		return queue;
	}

	/**
	 * Add agent to queue
	 */
	async addAgentToQueue(
		queueId: string,
		agentExtension: string,
		options: {
			priority?: number;
			skills?: AgentSkill[];
			maxConcurrentCalls?: number;
		} = {}
	): Promise<{ success: boolean; agent: QueueAgent }> {
		const queue = this.queues.get(queueId);
		if (!queue) {
			throw new Error(`Queue ${queueId} not found`);
		}

		// Check if agent already exists
		const existingAgent = queue.agents.find(a => a.extension === agentExtension);
		if (existingAgent) {
			throw new Error(`Agent ${agentExtension} already exists in queue ${queueId}`);
		}

		const agent: QueueAgent = {
			agentId: `agent-${agentExtension}-${Date.now()}`,
			extension: agentExtension,
			name: `Agent ${agentExtension}`,
			status: 'offline',
			skills: options.skills || [],
			priority: options.priority || 1,
			maxConcurrentCalls: options.maxConcurrentCalls || 1,
			currentCalls: 0,
			idleTime: 0,
			totalCalls: 0,
			totalTalkTime: 0,
			totalWrapTime: 0,
			averageCallDuration: 0,
			performance: {
				callsHandled: 0,
				averageHandleTime: 0,
				customerSatisfactionScore: 0,
				firstCallResolutionRate: 0,
				escalationRate: 0,
				adherenceToSchedule: 0,
				qualityScore: 0,
			},
			schedule: [],
			metadata: {},
		};

		const response = await this.apiClient.request(`/queues/${queueId}/agents/add`, {
			method: 'POST',
			body: {
				agent_extension: agentExtension,
				priority: agent.priority,
				skills: agent.skills,
				max_concurrent_calls: agent.maxConcurrentCalls,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to add agent to queue');
		}

		queue.agents.push(agent);
		queue.lastModified = new Date();

		return { success: true, agent };
	}

	/**
	 * Update agent status
	 */
	async updateAgentStatus(
		queueId: string,
		agentExtension: string,
		status: QueueAgent['status'],
		reason?: string
	): Promise<{ success: boolean }> {
		const queue = this.queues.get(queueId);
		if (!queue) {
			throw new Error(`Queue ${queueId} not found`);
		}

		const agent = queue.agents.find(a => a.extension === agentExtension);
		if (!agent) {
			throw new Error(`Agent ${agentExtension} not found in queue ${queueId}`);
		}

		const response = await this.apiClient.request(`/queues/${queueId}/agents/${agentExtension}/status`, {
			method: 'POST',
			body: { status, reason },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to update agent status');
		}

		agent.status = status;
		queue.lastModified = new Date();

		return { success: true };
	}

	/**
	 * Route call to best available agent
	 */
	async routeCallToAgent(queueId: string, callId: string): Promise<{
		success: boolean;
		assignedAgent?: string;
		waitTime: number;
	}> {
		const queue = this.queues.get(queueId);
		if (!queue) {
			throw new Error(`Queue ${queueId} not found`);
		}

		// Find best available agent based on distribution strategy
		const availableAgent = this.findBestAvailableAgent(queue, callId);

		if (!availableAgent) {
			// No agents available, add to queue
			return await this.addCallToQueue(queueId, callId);
		}

		const response = await this.apiClient.request(`/calls/${callId}/transfer`, {
			method: 'POST',
			body: {
				target_extension: availableAgent.extension,
				queue_id: queueId,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to route call to agent');
		}

		// Update agent status
		availableAgent.status = 'on_call';
		availableAgent.currentCalls++;
		availableAgent.totalCalls++;
		availableAgent.lastCallTime = new Date();

		return {
			success: true,
			assignedAgent: availableAgent.extension,
			waitTime: 0,
		};
	}

	/**
	 * Add call to queue
	 */
	async addCallToQueue(queueId: string, callId: string): Promise<{
		success: boolean;
		position: number;
		estimatedWaitTime: number;
	}> {
		const queue = this.queues.get(queueId);
		if (!queue) {
			throw new Error(`Queue ${queueId} not found`);
		}

		// Check queue capacity
		if (queue.currentQueueSize >= queue.maxQueueSize) {
			// Handle overflow
			return await this.handleQueueOverflow(queue, callId);
		}

		const queuedCall: QueuedCall = {
			callId,
			fromNumber: '',
			toNumber: queue.extension,
			queueEntryTime: new Date(),
			estimatedWaitTime: this.calculateEstimatedWaitTime(queue),
			currentPosition: queue.waitingCalls.length + 1,
			priority: 'normal',
			requiredSkills: [],
			callbackRequested: false,
			previousAttempts: 0,
			metadata: {},
		};

		const response = await this.apiClient.request(`/queues/${queueId}/calls/add`, {
			method: 'POST',
			body: {
				call_id: callId,
				priority: queuedCall.priority,
				required_skills: queuedCall.requiredSkills,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to add call to queue');
		}

		queue.waitingCalls.push(queuedCall);
		queue.currentQueueSize++;
		queue.lastModified = new Date();

		// Play welcome message and position announcement
		await this.playQueueAnnouncement(callId, queue, 'welcome');

		return {
			success: true,
			position: queuedCall.currentPosition,
			estimatedWaitTime: queuedCall.estimatedWaitTime,
		};
	}

	/**
	 * Remove call from queue
	 */
	async removeCallFromQueue(queueId: string, callId: string, reason: 'answered' | 'abandoned' | 'transferred'): Promise<boolean> {
		const queue = this.queues.get(queueId);
		if (!queue) return false;

		const callIndex = queue.waitingCalls.findIndex(c => c.callId === callId);
		if (callIndex === -1) return false;

		const queuedCall = queue.waitingCalls[callIndex];
		const waitTime = Math.floor((new Date().getTime() - queuedCall.queueEntryTime.getTime()) / 1000);

		// Remove call from queue
		queue.waitingCalls.splice(callIndex, 1);
		queue.currentQueueSize--;

		// Update queue statistics
		queue.statistics.totalCalls++;
		if (reason === 'answered') {
			queue.statistics.answeredCalls++;
			queue.statistics.totalTalkTime += waitTime;
		} else if (reason === 'abandoned') {
			queue.statistics.abandonedCalls++;
		}

		// Update positions for remaining calls
		queue.waitingCalls.forEach((call, index) => {
			call.currentPosition = index + 1;
		});

		queue.lastModified = new Date();

		// Notify 3CX
		await this.apiClient.request(`/queues/${queueId}/calls/remove`, {
			method: 'POST',
			body: { call_id: callId, reason, wait_time: waitTime },
		});

		return true;
	}

	/**
	 * Request callback for queued call
	 */
	async requestCallback(
		queueId: string,
		callId: string,
		callbackNumber: string,
		requestedTime?: Date
	): Promise<{ success: boolean; requestId: string; estimatedCallback: Date }> {
		const queue = this.queues.get(queueId);
		if (!queue) {
			throw new Error(`Queue ${queueId} not found`);
		}

		const queuedCall = queue.waitingCalls.find(c => c.callId === callId);
		if (!queuedCall) {
			throw new Error(`Call ${callId} not found in queue ${queueId}`);
		}

		const requestId = `callback-${Date.now()}-${callId}`;
		const estimatedCallback = requestedTime || new Date(Date.now() + this.calculateEstimatedWaitTime(queue) * 1000);

		const callbackRequest: CallbackRequest = {
			requestId,
			queueId,
			originalCallId: callId,
			customerNumber: callbackNumber,
			requestedTime,
			priority: queuedCall.priority,
			estimatedCallback,
			status: 'pending',
			attempts: 0,
			requiredSkills: queuedCall.requiredSkills,
			preferredAgent: queuedCall.customerData?.preferredAgent,
			createdAt: new Date(),
		};

		const response = await this.apiClient.request(`/queues/${queueId}/callbacks/request`, {
			method: 'POST',
			body: {
				request_id: requestId,
				call_id: callId,
				callback_number: callbackNumber,
				requested_time: requestedTime?.toISOString(),
				priority: queuedCall.priority,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to request callback');
		}

		this.callbackRequests.set(requestId, callbackRequest);

		// Remove original call from queue
		await this.removeCallFromQueue(queueId, callId, 'transferred');

		return {
			success: true,
			requestId,
			estimatedCallback,
		};
	}

	/**
	 * Get real-time queue metrics
	 */
	async getQueueMetrics(queueId: string): Promise<QueueMetrics> {
		const queue = this.queues.get(queueId);
		if (!queue) {
			throw new Error(`Queue ${queueId} not found`);
		}

		const metrics: QueueMetrics = {
			queueId,
			timestamp: new Date(),
			realTimeMetrics: {
				currentWaitingCalls: queue.currentQueueSize,
				longestWaitTime: this.getLongestWaitTime(queue),
				averageWaitTime: this.calculateAverageWaitTime(queue),
				availableAgents: queue.agents.filter(a => a.status === 'available').length,
				busyAgents: queue.agents.filter(a => a.status === 'on_call').length,
				totalAgents: queue.agents.length,
				serviceLevelCurrent: this.calculateCurrentServiceLevel(queue),
				abandonRateCurrent: this.calculateCurrentAbandonRate(queue),
				callsInLastHour: this.getCallsInLastHour(queue),
				estimatedWaitTime: this.calculateEstimatedWaitTime(queue),
			},
			performanceMetrics: {
				serviceLevelToday: queue.statistics.serviceLevelAchieved,
				abandonRateToday: queue.statistics.abandonRate,
				averageHandleTimeToday: queue.statistics.averageHandleTime,
				firstCallResolutionToday: queue.statistics.firstCallResolution,
				customerSatisfactionToday: queue.statistics.customerSatisfaction,
				agentUtilizationToday: queue.statistics.agentUtilization,
				costEfficiencyToday: queue.statistics.costPerCall,
			},
			predictiveMetrics: {
				expectedCallVolume: this.predictCallVolume(queue),
				recommendedStaffing: this.calculateRecommendedStaffing(queue),
				serviceLevelForecast: this.forecastServiceLevel(queue),
				waitTimeForecast: this.forecastWaitTime(queue),
				abandonRateForecast: this.forecastAbandonRate(queue),
			},
		};

		this.queueMetrics.set(queueId, metrics);
		return metrics;
	}

	/**
	 * Generate queue performance report
	 */
	async generateQueueReport(
		queueId: string,
		reportType: 'daily' | 'weekly' | 'monthly' | 'custom',
		startDate?: Date,
		endDate?: Date
	): Promise<QueueReport> {
		const queue = this.queues.get(queueId);
		if (!queue) {
			throw new Error(`Queue ${queueId} not found`);
		}

		const reportId = `report-${queueId}-${Date.now()}`;
		const now = new Date();
		
		let period = { startDate: now, endDate: now };
		
		switch (reportType) {
			case 'daily':
				period.startDate = new Date(now.setHours(0, 0, 0, 0));
				period.endDate = new Date(now.setHours(23, 59, 59, 999));
				break;
			case 'weekly':
				const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
				period.startDate = new Date(weekStart.setHours(0, 0, 0, 0));
				period.endDate = new Date();
				break;
			case 'monthly':
				period.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
				period.endDate = new Date();
				break;
			case 'custom':
				if (startDate && endDate) {
					period = { startDate, endDate };
				}
				break;
		}

		const response = await this.apiClient.request(`/queues/${queueId}/reports/generate`, {
			method: 'POST',
			body: {
				report_id: reportId,
				report_type: reportType,
				start_date: period.startDate.toISOString(),
				end_date: period.endDate.toISOString(),
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to generate queue report');
		}

		const report: QueueReport = {
			reportId,
			queueId,
			reportType,
			period,
			summary: response.data?.summary || this.generateReportSummary(queue, period),
			agentPerformance: response.data?.agent_performance || [],
			callDistribution: response.data?.call_distribution || this.generateCallDistribution(queue),
			serviceLevel: response.data?.service_level || this.generateServiceLevelReport(queue),
			trends: response.data?.trends || this.generateTrendAnalysis(queue),
			recommendations: response.data?.recommendations || this.generateRecommendations(queue),
			generatedAt: new Date(),
		};

		this.queueReports.set(reportId, report);
		return report;
	}

	/**
	 * Helper methods
	 */
	private findBestAvailableAgent(queue: CallQueue, callId: string): QueueAgent | null {
		const availableAgents = queue.agents.filter(a => 
			a.status === 'available' && a.currentCalls < a.maxConcurrentCalls
		);

		if (availableAgents.length === 0) return null;

		switch (queue.settings.distributionStrategy) {
			case 'round_robin':
				return this.findRoundRobinAgent(availableAgents);
			case 'longest_idle':
				return this.findLongestIdleAgent(availableAgents);
			case 'skill_based':
				return this.findSkillBasedAgent(availableAgents, callId);
			case 'priority_based':
				return this.findPriorityBasedAgent(availableAgents);
			case 'load_balanced':
				return this.findLoadBalancedAgent(availableAgents);
			default:
				return availableAgents[0];
		}
	}

	private findRoundRobinAgent(agents: QueueAgent[]): QueueAgent {
		return agents.sort((a, b) => (a.lastCallTime?.getTime() || 0) - (b.lastCallTime?.getTime() || 0))[0];
	}

	private findLongestIdleAgent(agents: QueueAgent[]): QueueAgent {
		return agents.sort((a, b) => b.idleTime - a.idleTime)[0];
	}

	private findSkillBasedAgent(agents: QueueAgent[], callId: string): QueueAgent {
		// Simplified skill-based routing
		return agents.sort((a, b) => b.skills.length - a.skills.length)[0];
	}

	private findPriorityBasedAgent(agents: QueueAgent[]): QueueAgent {
		return agents.sort((a, b) => b.priority - a.priority)[0];
	}

	private findLoadBalancedAgent(agents: QueueAgent[]): QueueAgent {
		return agents.sort((a, b) => a.currentCalls - b.currentCalls)[0];
	}

	private calculateEstimatedWaitTime(queue: CallQueue): number {
		if (queue.waitingCalls.length === 0) return 0;
		
		const availableAgents = queue.agents.filter(a => a.status === 'available').length;
		if (availableAgents === 0) return queue.maxWaitTime;

		const avgHandleTime = queue.statistics.averageHandleTime || 180; // 3 minutes default
		return Math.min((queue.waitingCalls.length / availableAgents) * avgHandleTime, queue.maxWaitTime);
	}

	private async handleQueueOverflow(queue: CallQueue, callId: string): Promise<any> {
		if (!queue.overflow.enabled) {
			throw new Error('Queue is full and overflow is disabled');
		}

		// Execute overflow actions in priority order
		const sortedActions = queue.overflow.actions.sort((a, b) => a.priority - b.priority);
		
		for (const action of sortedActions) {
			try {
				switch (action.type) {
					case 'transfer_to_queue':
						return await this.addCallToQueue(action.destination, callId);
					case 'voicemail':
						return await this.transferToVoicemail(callId, action.destination);
					case 'callback':
						return await this.offerCallback(callId);
					case 'external_number':
						return await this.transferToExternal(callId, action.destination);
					case 'announcement':
						return await this.playAnnouncementAndHangup(callId, action.destination);
				}
			} catch (error) {
				// Continue to next action if current fails
				continue;
			}
		}

		throw new Error('All overflow actions failed');
	}

	private async playQueueAnnouncement(callId: string, queue: CallQueue, type: string): Promise<void> {
		let message = '';
		
		switch (type) {
			case 'welcome':
				message = queue.announcements.welcomeMessage;
				break;
			case 'position':
				if (queue.settings.announcePosition) {
					const call = queue.waitingCalls.find(c => c.callId === callId);
					message = queue.announcements.positionAnnouncement.replace('{position}', call?.currentPosition.toString() || '');
				}
				break;
			case 'wait_time':
				if (queue.settings.announceWaitTime) {
					const estimatedWait = this.calculateEstimatedWaitTime(queue);
					message = queue.announcements.waitTimeAnnouncement.replace('{wait_time}', Math.ceil(estimatedWait / 60).toString());
				}
				break;
		}

		if (message) {
			await this.apiClient.request(`/calls/${callId}/play`, {
				method: 'POST',
				body: { audio_path: message },
			});
		}
	}

	private getLongestWaitTime(queue: CallQueue): number {
		if (queue.waitingCalls.length === 0) return 0;
		
		const now = new Date().getTime();
		return Math.max(...queue.waitingCalls.map(call => 
			Math.floor((now - call.queueEntryTime.getTime()) / 1000)
		));
	}

	private calculateAverageWaitTime(queue: CallQueue): number {
		if (queue.waitingCalls.length === 0) return 0;
		
		const now = new Date().getTime();
		const totalWaitTime = queue.waitingCalls.reduce((total, call) => 
			total + (now - call.queueEntryTime.getTime()), 0
		);
		
		return Math.floor(totalWaitTime / queue.waitingCalls.length / 1000);
	}

	private calculateCurrentServiceLevel(queue: CallQueue): number {
		// Simplified calculation
		const target = queue.settings.serviceLevelTarget;
		const answeredInTime = queue.statistics.answeredCalls; // Would need more detailed tracking
		const totalCalls = queue.statistics.totalCalls;
		
		return totalCalls > 0 ? (answeredInTime / totalCalls) * 100 : 100;
	}

	private calculateCurrentAbandonRate(queue: CallQueue): number {
		const totalCalls = queue.statistics.totalCalls;
		const abandonedCalls = queue.statistics.abandonedCalls;
		
		return totalCalls > 0 ? (abandonedCalls / totalCalls) * 100 : 0;
	}

	private getCallsInLastHour(queue: CallQueue): number {
		// This would need historical data tracking
		return Math.floor(queue.statistics.totalCalls / 24); // Simplified
	}

	private predictCallVolume(queue: CallQueue): number {
		// Simplified prediction based on historical data
		return Math.floor(queue.statistics.totalCalls * 1.1);
	}

	private calculateRecommendedStaffing(queue: CallQueue): number {
		const expectedCalls = this.predictCallVolume(queue);
		const avgHandleTime = queue.statistics.averageHandleTime / 3600; // Convert to hours
		const targetUtilization = 0.85; // 85% utilization target
		
		return Math.ceil((expectedCalls * avgHandleTime) / (8 * targetUtilization)); // 8-hour workday
	}

	private forecastServiceLevel(queue: CallQueue): number {
		// Simplified forecasting
		return Math.max(queue.statistics.serviceLevelAchieved - 5, 80);
	}

	private forecastWaitTime(queue: CallQueue): number {
		return Math.max(queue.averageWaitTime * 1.1, 30);
	}

	private forecastAbandonRate(queue: CallQueue): number {
		return Math.min(queue.statistics.abandonRate * 1.05, 15);
	}

	private generateReportSummary(queue: CallQueue, period: { startDate: Date; endDate: Date }): QueueReportSummary {
		return {
			totalCalls: queue.statistics.totalCalls,
			answeredCalls: queue.statistics.answeredCalls,
			abandonedCalls: queue.statistics.abandonedCalls,
			averageWaitTime: queue.statistics.averageWaitTime,
			averageHandleTime: queue.statistics.averageHandleTime,
			serviceLevelAchieved: queue.statistics.serviceLevelAchieved,
			customerSatisfaction: queue.statistics.customerSatisfaction,
			costPerCall: queue.statistics.costPerCall,
			revenueImpact: queue.statistics.revenuePerCall * queue.statistics.answeredCalls,
		};
	}

	private generateCallDistribution(queue: CallQueue): CallDistributionReport {
		return {
			hourlyDistribution: [], // Would need historical data
			dailyDistribution: [],
			skillDistribution: [],
			priorityDistribution: [],
		};
	}

	private generateServiceLevelReport(queue: CallQueue): ServiceLevelReport {
		return {
			targetServiceLevel: queue.settings.serviceLevelGoal,
			achievedServiceLevel: queue.statistics.serviceLevelAchieved,
			variance: queue.statistics.serviceLevelAchieved - queue.settings.serviceLevelGoal,
			hourlyServiceLevels: [],
			recommendations: [],
		};
	}

	private generateTrendAnalysis(queue: CallQueue): TrendAnalysis {
		return {
			callVolumeTrend: 'stable',
			waitTimeTrend: 'stable',
			abandonRateTrend: 'stable',
			serviceLevelTrend: 'stable',
			seasonalPatterns: [],
			anomalies: [],
		};
	}

	private generateRecommendations(queue: CallQueue): string[] {
		const recommendations: string[] = [];
		
		if (queue.statistics.serviceLevelAchieved < queue.settings.serviceLevelGoal) {
			recommendations.push('Consider adding more agents during peak hours');
		}
		
		if (queue.statistics.abandonRate > 10) {
			recommendations.push('Reduce wait times by optimizing agent scheduling');
		}
		
		if (queue.statistics.agentUtilization < 80) {
			recommendations.push('Agent utilization is low, consider redistributing workload');
		}
		
		return recommendations;
	}

	private async transferToVoicemail(callId: string, voicemailBox: string): Promise<any> {
		return { success: true, action: 'voicemail' };
	}

	private async offerCallback(callId: string): Promise<any> {
		return { success: true, action: 'callback_offered' };
	}

	private async transferToExternal(callId: string, phoneNumber: string): Promise<any> {
		return { success: true, action: 'external_transfer' };
	}

	private async playAnnouncementAndHangup(callId: string, message: string): Promise<any> {
		return { success: true, action: 'announcement_played' };
	}

	private getDefaultQueueSettings(): QueueSettings {
		return {
			distributionStrategy: 'longest_idle',
			agentTimeout: 30,
			recordCalls: false,
			wrapUpTime: 30,
			enableCallback: true,
			announcePosition: true,
			announceWaitTime: true,
			musicOnHold: true,
			serviceLevelTarget: 20,
			serviceLevelGoal: 80,
			abandonThreshold: 300,
			priorityEscalation: [],
		};
	}

	private getDefaultBusinessHours(): BusinessHours[] {
		return [
			{
				dayOfWeek: 1, // Monday
				startTime: '09:00',
				endTime: '17:00',
				timezone: 'UTC',
				holidays: [],
			},
			// Add other weekdays
		];
	}

	private getDefaultOverflowSettings(): OverflowSettings {
		return {
			enabled: true,
			thresholds: {
				maxWaitTime: 300,
				maxQueueSize: 100,
				serviceLevelThreshold: 60,
			},
			actions: [
				{
					type: 'callback',
					destination: '',
					priority: 1,
					conditions: [],
				},
			],
		};
	}

	private getDefaultAnnouncements(): QueueAnnouncements {
		return {
			welcomeMessage: 'Thank you for calling. You have been placed in queue.',
			positionAnnouncement: 'You are number {position} in queue.',
			waitTimeAnnouncement: 'Your estimated wait time is {wait_time} minutes.',
			holdMessage: 'Please hold while we connect you to the next available agent.',
			callbackOffer: 'Press 1 to request a callback instead of waiting.',
			queueClosedMessage: 'We are currently closed. Please call back during business hours.',
			transferMessage: 'Please hold while we transfer your call.',
			customAnnouncements: {},
		};
	}

	private initializeQueueStatistics(): QueueStatistics {
		return {
			date: new Date(),
			totalCalls: 0,
			answeredCalls: 0,
			abandonedCalls: 0,
			averageWaitTime: 0,
			maxWaitTime: 0,
			averageHandleTime: 0,
			serviceLevelAchieved: 0,
			abandonRate: 0,
			firstCallResolution: 0,
			totalTalkTime: 0,
			totalWrapTime: 0,
			hourlyStats: [],
			agentUtilization: 0,
			customerSatisfaction: 0,
			costPerCall: 0,
			revenuePerCall: 0,
		};
	}

	private startMetricsCollection(): void {
		// Update metrics every 30 seconds
		this.metricsUpdateInterval = setInterval(() => {
			for (const [queueId] of this.queues) {
				this.getQueueMetrics(queueId).catch(console.error);
			}
		}, 30000);
	}

	/**
	 * Get queue by ID
	 */
	getQueue(queueId: string): CallQueue | undefined {
		return this.queues.get(queueId);
	}

	/**
	 * List all queues
	 */
	getQueues(): CallQueue[] {
		return Array.from(this.queues.values());
	}

	/**
	 * Get queue metrics
	 */
	getQueueMetricsSync(queueId: string): QueueMetrics | undefined {
		return this.queueMetrics.get(queueId);
	}

	/**
	 * Get callback requests
	 */
	getCallbackRequests(queueId?: string): CallbackRequest[] {
		const requests = Array.from(this.callbackRequests.values());
		return queueId ? requests.filter(r => r.queueId === queueId) : requests;
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		if (this.metricsUpdateInterval) {
			clearInterval(this.metricsUpdateInterval);
			this.metricsUpdateInterval = null;
		}

		this.queues.clear();
		this.queueMetrics.clear();
		this.callbackRequests.clear();
		this.queueReports.clear();
	}
}

/**
 * Factory function to create call queue manager
 */
export function createCallQueueManager(apiClient: ThreeCXAPIClient): CallQueueManager {
	return new CallQueueManager(apiClient);
}