import {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	NodeOperationError,
} from 'n8n-workflow';

import { createAuthenticationManager } from '../../utils/auth';
import { createAPIClient } from '../../utils/apiClient';
import { createCallInfoManager } from '../../utils/callInfoManager';
import { 
	CallInfo, 
	CallEvent, 
	ConnectionConfig, 
	CallHistoryFilter,
	CallStatistics,
	ExtensionInfo 
} from '../../types';

export class ThreeCXCallMonitor implements INodeType {
	description: INodeTypeDescription = {
		displayName: '3CX Call Monitor',
		name: '3cxCallMonitor',
		icon: 'file:3cx-monitor.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["monitorScope"]}}',
		description: 'Monitor all 3CX system calls for analytics, reporting, and real-time insights',
		defaults: {
			name: '3CX Call Monitor',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: '3cxCallControlApi',
				required: true,
			},
		],
		polling: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'monitorCalls',
				options: [
					{
						name: 'Monitor All Calls',
						value: 'monitorCalls',
						description: 'Monitor all system calls in real-time',
					},
					{
						name: 'Generate Call Reports',
						value: 'generateReports',
						description: 'Generate call statistics and reports for a time period',
					},
					{
						name: 'Track Active Calls',
						value: 'trackActive',
						description: 'Monitor currently active calls across the system',
					},
					{
						name: 'Monitor Extensions',
						value: 'monitorExtensions',
						description: 'Monitor extension status and activities',
					},
				],
			},
			{
				displayName: 'Monitor Scope',
				name: 'monitorScope',
				type: 'options',
				default: 'all',
				displayOptions: {
					show: {
						operation: ['monitorCalls', 'trackActive'],
					},
				},
				options: [
					{
						name: 'All Calls',
						value: 'all',
						description: 'Monitor all calls in the system',
					},
					{
						name: 'Specific Extension',
						value: 'extension',
						description: 'Monitor calls for a specific extension',
					},
					{
						name: 'Extension Group',
						value: 'group',
						description: 'Monitor calls for a group of extensions',
					},
					{
						name: 'DID/Phone Number',
						value: 'did',
						description: 'Monitor calls to/from specific phone numbers',
					},
				],
			},
			{
				displayName: 'Extension',
				name: 'extension',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						monitorScope: ['extension'],
					},
				},
				description: 'Extension number to monitor',
				placeholder: '100',
			},
			{
				displayName: 'Extension Group',
				name: 'extensionGroup',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						monitorScope: ['group'],
					},
				},
				description: 'Comma-separated list of extensions to monitor',
				placeholder: '100,101,102',
			},
			{
				displayName: 'Phone Number/DID',
				name: 'phoneNumber',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						monitorScope: ['did'],
					},
				},
				description: 'Phone number or DID to monitor',
				placeholder: '+1234567890',
			},
			{
				displayName: 'Call Direction Filter',
				name: 'callDirection',
				type: 'options',
				default: 'all',
				displayOptions: {
					show: {
						operation: ['monitorCalls', 'trackActive'],
					},
				},
				options: [
					{
						name: 'All Directions',
						value: 'all',
						description: 'Monitor all call directions',
					},
					{
						name: 'Inbound Only',
						value: 'inbound',
						description: 'Monitor only incoming calls',
					},
					{
						name: 'Outbound Only',
						value: 'outbound',
						description: 'Monitor only outgoing calls',
					},
					{
						name: 'Internal Only',
						value: 'internal',
						description: 'Monitor only internal calls',
					},
				],
			},
			{
				displayName: 'Call Status Filter',
				name: 'callStatus',
				type: 'multiOptions',
				default: ['ringing', 'answered', 'ended'],
				displayOptions: {
					show: {
						operation: ['monitorCalls'],
					},
				},
				options: [
					{
						name: 'Ringing',
						value: 'ringing',
						description: 'Calls that are ringing',
					},
					{
						name: 'Answered',
						value: 'answered',
						description: 'Calls that have been answered',
					},
					{
						name: 'Missed',
						value: 'missed',
						description: 'Calls that were missed',
					},
					{
						name: 'Ended',
						value: 'ended',
						description: 'Calls that have ended',
					},
					{
						name: 'Parked',
						value: 'parked',
						description: 'Calls that are parked',
					},
					{
						name: 'Held',
						value: 'held',
						description: 'Calls that are on hold',
					},
					{
						name: 'Transferred',
						value: 'transferred',
						description: 'Calls that have been transferred',
					},
				],
			},
			{
				displayName: 'Report Period',
				name: 'reportPeriod',
				type: 'options',
				default: 'today',
				displayOptions: {
					show: {
						operation: ['generateReports'],
					},
				},
				options: [
					{
						name: 'Last Hour',
						value: 'lastHour',
						description: 'Generate report for the last hour',
					},
					{
						name: 'Today',
						value: 'today',
						description: 'Generate report for today',
					},
					{
						name: 'Yesterday',
						value: 'yesterday',
						description: 'Generate report for yesterday',
					},
					{
						name: 'Last 7 Days',
						value: 'last7Days',
						description: 'Generate report for the last 7 days',
					},
					{
						name: 'Last 30 Days',
						value: 'last30Days',
						description: 'Generate report for the last 30 days',
					},
					{
						name: 'Custom Range',
						value: 'custom',
						description: 'Specify custom date range',
					},
				],
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: {
						operation: ['generateReports'],
						reportPeriod: ['custom'],
					},
				},
				description: 'Start date for the report period',
			},
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: {
						operation: ['generateReports'],
						reportPeriod: ['custom'],
					},
				},
				description: 'End date for the report period',
			},
			{
				displayName: 'Group Report By',
				name: 'groupBy',
				type: 'options',
				default: 'none',
				displayOptions: {
					show: {
						operation: ['generateReports'],
					},
				},
				options: [
					{
						name: 'No Grouping',
						value: 'none',
						description: 'Generate overall statistics',
					},
					{
						name: 'By Hour',
						value: 'hour',
						description: 'Group statistics by hour',
					},
					{
						name: 'By Day',
						value: 'day',
						description: 'Group statistics by day',
					},
					{
						name: 'By Extension',
						value: 'extension',
						description: 'Group statistics by extension',
					},
				],
			},
			{
				displayName: 'Include Call Details',
				name: 'includeCallDetails',
				type: 'boolean',
				default: true,
				description: 'Whether to include detailed call information in the output',
			},
			{
				displayName: 'Include Recording URLs',
				name: 'includeRecordings',
				type: 'boolean',
				default: false,
				description: 'Whether to include call recording URLs when available',
			},
			{
				displayName: 'Include Statistics',
				name: 'includeStatistics',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['monitorCalls', 'trackActive'],
					},
				},
				description: 'Whether to include call statistics in the output',
			},
			{
				displayName: 'Polling Interval',
				name: 'pollingInterval',
				type: 'number',
				default: 10,
				description: 'How often to check for updates (in seconds)',
				typeOptions: {
					minValue: 5,
					maxValue: 300,
				},
			},
			{
				displayName: 'Max Items per Poll',
				name: 'maxItemsPerPoll',
				type: 'number',
				default: 50,
				description: 'Maximum number of items to process in each polling cycle',
				typeOptions: {
					minValue: 1,
					maxValue: 500,
				},
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('3cxCallControlApi');
		const operation = this.getNodeParameter('operation', 0) as string;
		const monitorScope = this.getNodeParameter('monitorScope', 0, 'all') as string;
		const extension = this.getNodeParameter('extension', 0, '') as string;
		const extensionGroup = this.getNodeParameter('extensionGroup', 0, '') as string;
		const phoneNumber = this.getNodeParameter('phoneNumber', 0, '') as string;
		const callDirection = this.getNodeParameter('callDirection', 0, 'all') as string;
		const callStatus = this.getNodeParameter('callStatus', 0, []) as string[];
		const includeCallDetails = this.getNodeParameter('includeCallDetails', 0, true) as boolean;
		const includeRecordings = this.getNodeParameter('includeRecordings', 0, false) as boolean;
		const includeStatistics = this.getNodeParameter('includeStatistics', 0, false) as boolean;
		const maxItemsPerPoll = this.getNodeParameter('maxItemsPerPoll', 0, 50) as number;

		try {
			// Create API client and managers
			const config: ConnectionConfig = {
				baseUrl: credentials.baseUrl as string,
				clientId: credentials.clientId as string,
				apiSecret: credentials.apiSecret as string,
				timeout: credentials.timeout as number,
				retryAttempts: credentials.retryAttempts as number,
				retryDelay: credentials.retryDelay as number,
			};

			const authManager = createAuthenticationManager(config);
			const apiClient = createAPIClient(config, authManager);
			const callInfoManager = createCallInfoManager(apiClient, {
				enableRealTimeMonitoring: false,
				enableLogging: false,
			});

			const items: INodeExecutionData[] = [];
			const now = new Date();
			const lastPoll = this.getWorkflowStaticData('node').lastPollTime as string;
			const lastPollTime = lastPoll ? new Date(lastPoll) : new Date(now.getTime() - 300000); // Default to 5 minutes ago

			try {
				switch (operation) {
					case 'monitorCalls':
						await this.handleMonitorCalls(
							callInfoManager,
							items,
							lastPollTime,
							now,
							{
								monitorScope,
								extension,
								extensionGroup,
								phoneNumber,
								callDirection,
								callStatus,
								includeCallDetails,
								includeRecordings,
								includeStatistics,
								maxItemsPerPoll,
							}
						);
						break;

					case 'generateReports':
						await this.handleGenerateReports(
							callInfoManager,
							items,
							this.getNodeParameter('reportPeriod', 0) as string,
							this.getNodeParameter('startDate', 0, '') as string,
							this.getNodeParameter('endDate', 0, '') as string,
							this.getNodeParameter('groupBy', 0, 'none') as string,
							{ extension, includeCallDetails }
						);
						break;

					case 'trackActive':
						await this.handleTrackActive(
							callInfoManager,
							items,
							{
								monitorScope,
								extension,
								extensionGroup,
								phoneNumber,
								callDirection,
								includeCallDetails,
								includeRecordings,
								includeStatistics,
							}
						);
						break;

					case 'monitorExtensions':
						await this.handleMonitorExtensions(
							callInfoManager,
							items,
							{ extension, extensionGroup, includeCallDetails }
						);
						break;
				}

			} finally {
				// Clean up resources
				callInfoManager.destroy();
				authManager.destroy();
			}

			// Update last poll time
			this.getWorkflowStaticData('node').lastPollTime = now.toISOString();

			return [items];

		} catch (error) {
			if (error instanceof Error) {
				throw new NodeOperationError(this.getNode(), error.message);
			}
			throw new NodeOperationError(this.getNode(), 'Unknown error occurred while monitoring calls');
		}
	}

	/**
	 * Handle monitor calls operation
	 */
	private async handleMonitorCalls(
		callInfoManager: any,
		items: INodeExecutionData[],
		lastPollTime: Date,
		now: Date,
		options: any
	): Promise<void> {
		const filter: CallHistoryFilter = {
			startDate: lastPollTime,
			endDate: now,
			limit: options.maxItemsPerPoll,
		};

		// Apply scope filters
		if (options.monitorScope === 'extension' && options.extension) {
			filter.extension = options.extension;
		} else if (options.monitorScope === 'did' && options.phoneNumber) {
			filter.phoneNumber = options.phoneNumber;
		}

		// Apply direction filter
		if (options.callDirection !== 'all') {
			filter.direction = options.callDirection;
		}

		// Get call history
		const callHistory = await callInfoManager.getCallHistory(filter);

		for (const call of callHistory.calls) {
			// Apply status filter
			if (options.callStatus.length > 0 && !options.callStatus.includes(call.status)) {
				continue;
			}

			// Apply extension group filter
			if (options.monitorScope === 'group' && options.extensionGroup) {
				const extensions = options.extensionGroup.split(',').map((ext: string) => ext.trim());
				if (!extensions.includes(call.extension)) {
					continue;
				}
			}

			const item = this.createCallMonitorItem(call, options.includeCallDetails, options.includeRecordings);
			items.push(item);
		}

		// Include statistics if requested
		if (options.includeStatistics && items.length > 0) {
			const stats = await callInfoManager.getCallStatistics(lastPollTime, now, filter.extension);
			const statsItem: INodeExecutionData = {
				json: {
					type: 'statistics',
					timestamp: now.toISOString(),
					statistics: stats,
					period: {
						start: lastPollTime.toISOString(),
						end: now.toISOString(),
					},
				},
			};
			items.push(statsItem);
		}
	}

	/**
	 * Handle generate reports operation
	 */
	private async handleGenerateReports(
		callInfoManager: any,
		items: INodeExecutionData[],
		reportPeriod: string,
		startDateStr: string,
		endDateStr: string,
		groupBy: string,
		options: any
	): Promise<void> {
		const { startDate, endDate } = this.getReportPeriod(reportPeriod, startDateStr, endDateStr);

		const reportOptions = {
			extension: options.extension || undefined,
			includeDetails: options.includeCallDetails,
			groupBy: groupBy === 'none' ? undefined : groupBy,
		};

		const report = await callInfoManager.generateCallReport(startDate, endDate, reportOptions);

		// Create main report item
		const reportItem: INodeExecutionData = {
			json: {
				type: 'call_report',
				reportPeriod: {
					start: startDate.toISOString(),
					end: endDate.toISOString(),
					period: reportPeriod,
				},
				summary: report.summary,
				generatedAt: new Date().toISOString(),
			},
		};

		// Include grouped data if available
		if (report.groupedData) {
			reportItem.json.groupedData = report.groupedData;
		}

		items.push(reportItem);

		// Include detailed call data if requested
		if (report.details && options.includeCallDetails) {
			for (const call of report.details.slice(0, 100)) { // Limit to avoid too much data
				const detailItem = this.createCallMonitorItem(call, true, false);
				detailItem.json.type = 'call_detail';
				detailItem.json.reportPeriod = reportPeriod;
				items.push(detailItem);
			}
		}
	}

	/**
	 * Handle track active calls operation
	 */
	private async handleTrackActive(
		callInfoManager: any,
		items: INodeExecutionData[],
		options: any
	): Promise<void> {
		let extensionFilter: string | undefined;

		if (options.monitorScope === 'extension' && options.extension) {
			extensionFilter = options.extension;
		}

		const activeCalls = await callInfoManager.getActiveCalls(extensionFilter);

		for (const call of activeCalls.calls) {
			// Apply direction filter
			if (options.callDirection !== 'all' && call.direction !== options.callDirection) {
				continue;
			}

			// Apply extension group filter
			if (options.monitorScope === 'group' && options.extensionGroup) {
				const extensions = options.extensionGroup.split(',').map((ext: string) => ext.trim());
				if (!extensions.includes(call.extension)) {
					continue;
				}
			}

			// Apply phone number filter
			if (options.monitorScope === 'did' && options.phoneNumber) {
				if (!call.fromNumber.includes(options.phoneNumber) && !call.toNumber.includes(options.phoneNumber)) {
					continue;
				}
			}

			const item = this.createCallMonitorItem(call, options.includeCallDetails, options.includeRecordings);
			item.json.type = 'active_call';
			item.json.isActive = true;
			items.push(item);
		}

		// Include active call statistics
		if (options.includeStatistics) {
			const statsItem: INodeExecutionData = {
				json: {
					type: 'active_call_statistics',
					timestamp: new Date().toISOString(),
					totalActiveCalls: activeCalls.totalCount,
					callsByDirection: this.groupCallsByDirection(activeCalls.calls),
					callsByExtension: this.groupCallsByExtension(activeCalls.calls),
				},
			};
			items.push(statsItem);
		}
	}

	/**
	 * Handle monitor extensions operation
	 */
	private async handleMonitorExtensions(
		callInfoManager: any,
		items: INodeExecutionData[],
		options: any
	): Promise<void> {
		if (options.extension) {
			// Monitor specific extension
			const extensionInfo = await callInfoManager.getExtensionInfo(options.extension);
			const item: INodeExecutionData = {
				json: {
					type: 'extension_status',
					timestamp: new Date().toISOString(),
					extension: extensionInfo,
				},
			};
			items.push(item);
		} else if (options.extensionGroup) {
			// Monitor extension group
			const extensions = options.extensionGroup.split(',').map((ext: string) => ext.trim());
			for (const ext of extensions) {
				try {
					const extensionInfo = await callInfoManager.getExtensionInfo(ext);
					const item: INodeExecutionData = {
						json: {
							type: 'extension_status',
							timestamp: new Date().toISOString(),
							extension: extensionInfo,
						},
					};
					items.push(item);
				} catch (error) {
					// Skip extensions that don't exist
					continue;
				}
			}
		} else {
			// Monitor all extensions
			const allExtensions = await callInfoManager.getAllExtensions(false);
			for (const extensionInfo of allExtensions) {
				const item: INodeExecutionData = {
					json: {
						type: 'extension_status',
						timestamp: new Date().toISOString(),
						extension: extensionInfo,
					},
				};
				items.push(item);
			}
		}
	}

	/**
	 * Create monitor item from call information
	 */
	private createCallMonitorItem(call: CallInfo, includeDetails: boolean, includeRecordings: boolean): INodeExecutionData {
		const baseData = {
			type: 'call_monitor',
			callId: call.callId,
			fromNumber: call.fromNumber,
			toNumber: call.toNumber,
			extension: call.extension,
			direction: call.direction,
			status: call.status,
			startTime: call.startTime.toISOString(),
			endTime: call.endTime?.toISOString(),
			duration: call.duration,
			timestamp: new Date().toISOString(),
		};

		const item: INodeExecutionData = {
			json: includeDetails ? {
				...baseData,
				did: call.did,
				callType: call.type,
				metadata: call.metadata,
				queueInfo: call.queueInfo,
				transferInfo: call.transferInfo,
				conferenceInfo: call.conferenceInfo,
			} : baseData,
		};

		if (includeRecordings && call.recordingUrl) {
			item.json.recordingUrl = call.recordingUrl;
		}

		return item;
	}

	/**
	 * Get report period dates
	 */
	private getReportPeriod(period: string, startDateStr: string, endDateStr: string): { startDate: Date; endDate: Date } {
		const now = new Date();
		let startDate: Date;
		let endDate: Date = now;

		switch (period) {
			case 'lastHour':
				startDate = new Date(now.getTime() - 60 * 60 * 1000);
				break;
			case 'today':
				startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
				break;
			case 'yesterday':
				startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
				endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
				break;
			case 'last7Days':
				startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				break;
			case 'last30Days':
				startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
				break;
			case 'custom':
				startDate = startDateStr ? new Date(startDateStr) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
				endDate = endDateStr ? new Date(endDateStr) : now;
				break;
			default:
				startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		}

		return { startDate, endDate };
	}

	/**
	 * Group calls by direction for statistics
	 */
	private groupCallsByDirection(calls: CallInfo[]): Record<string, number> {
		const groups: Record<string, number> = { inbound: 0, outbound: 0, internal: 0 };
		for (const call of calls) {
			groups[call.direction] = (groups[call.direction] || 0) + 1;
		}
		return groups;
	}

	/**
	 * Group calls by extension for statistics
	 */
	private groupCallsByExtension(calls: CallInfo[]): Record<string, number> {
		const groups: Record<string, number> = {};
		for (const call of calls) {
			groups[call.extension] = (groups[call.extension] || 0) + 1;
		}
		return groups;
	}
}