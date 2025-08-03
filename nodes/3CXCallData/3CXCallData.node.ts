import {
	IExecuteFunctions,
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
	ConnectionConfig,
	CallHistoryFilter,
	CallInfo,
	CallStatistics,
	ExtensionInfo,
} from '../../types';

export class ThreeCXCallData implements INodeType {
	description: INodeTypeDescription = {
		displayName: '3CX Call Data',
		name: '3cxCallData',
		icon: 'file:3cx-data.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Retrieve 3CX call data, statistics, and generate reports',
		defaults: {
			name: '3CX Call Data',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: '3cxCallControlApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'getCallInfo',
				options: [
					{
						name: 'Get Call Information',
						value: 'getCallInfo',
						description: 'Retrieve detailed information about a specific call',
						action: 'Get call information',
					},
					{
						name: 'Get Call History',
						value: 'getCallHistory',
						description: 'Retrieve historical call data with filtering options',
						action: 'Get call history',
					},
					{
						name: 'Get Active Calls',
						value: 'getActiveCalls',
						description: 'List all currently active calls',
						action: 'Get active calls',
					},
					{
						name: 'Get Call Statistics',
						value: 'getStatistics',
						description: 'Generate call statistics for a time period',
						action: 'Get call statistics',
					},
					{
						name: 'Get Extension Information',
						value: 'getExtensionInfo',
						description: 'Retrieve information about a specific extension',
						action: 'Get extension information',
					},
					{
						name: 'Get All Extensions',
						value: 'getAllExtensions',
						description: 'List all extensions in the system',
						action: 'Get all extensions',
					},
					{
						name: 'Generate Call Report',
						value: 'generateReport',
						description: 'Generate comprehensive call reports with analysis',
						action: 'Generate call report',
					},
				],
			},
			// Get Call Information parameters
			{
				displayName: 'Call ID',
				name: 'callId',
				type: 'string',
				default: '={{$json["callId"]}}',
				required: true,
				displayOptions: {
					show: {
						operation: ['getCallInfo'],
					},
				},
				description: 'The ID of the call to retrieve information for',
				placeholder: 'abc123-def456-ghi789',
			},
			// Get Call History parameters
			{
				displayName: 'Time Range',
				name: 'timeRange',
				type: 'options',
				default: 'today',
				displayOptions: {
					show: {
						operation: ['getCallHistory', 'getStatistics', 'generateReport'],
					},
				},
				options: [
					{
						name: 'Last Hour',
						value: 'lastHour',
					},
					{
						name: 'Today',
						value: 'today',
					},
					{
						name: 'Yesterday',
						value: 'yesterday',
					},
					{
						name: 'Last 7 Days',
						value: 'last7Days',
					},
					{
						name: 'Last 30 Days',
						value: 'last30Days',
					},
					{
						name: 'Custom Range',
						value: 'custom',
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
						operation: ['getCallHistory', 'getStatistics', 'generateReport'],
						timeRange: ['custom'],
					},
				},
				description: 'Start date for the query',
			},
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: {
						operation: ['getCallHistory', 'getStatistics', 'generateReport'],
						timeRange: ['custom'],
					},
				},
				description: 'End date for the query',
			},
			// Filtering options
			{
				displayName: 'Extension Filter',
				name: 'extensionFilter',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['getCallHistory', 'getActiveCalls', 'getStatistics', 'generateReport'],
					},
				},
				description: 'Filter by specific extension (leave empty for all)',
				placeholder: '100',
			},
			{
				displayName: 'Call Direction',
				name: 'callDirection',
				type: 'options',
				default: 'all',
				displayOptions: {
					show: {
						operation: ['getCallHistory', 'getActiveCalls'],
					},
				},
				options: [
					{
						name: 'All Directions',
						value: 'all',
					},
					{
						name: 'Inbound Only',
						value: 'inbound',
					},
					{
						name: 'Outbound Only',
						value: 'outbound',
					},
					{
						name: 'Internal Only',
						value: 'internal',
					},
				],
			},
			{
				displayName: 'Call Status Filter',
				name: 'statusFilter',
				type: 'multiOptions',
				default: [],
				displayOptions: {
					show: {
						operation: ['getCallHistory'],
					},
				},
				options: [
					{
						name: 'Ringing',
						value: 'ringing',
					},
					{
						name: 'Answered',
						value: 'answered',
					},
					{
						name: 'Missed',
						value: 'missed',
					},
					{
						name: 'Ended',
						value: 'ended',
					},
					{
						name: 'Parked',
						value: 'parked',
					},
					{
						name: 'Held',
						value: 'held',
					},
				],
			},
			{
				displayName: 'Phone Number Filter',
				name: 'phoneNumberFilter',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['getCallHistory'],
					},
				},
				description: 'Filter by phone number (from or to)',
				placeholder: '+1234567890',
			},
			{
				displayName: 'DID Filter',
				name: 'didFilter',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['getCallHistory'],
					},
				},
				description: 'Filter by DID (Direct Inward Dialing) number',
				placeholder: '+1234567890',
			},
			{
				displayName: 'Duration Filter',
				name: 'durationFilter',
				type: 'collection',
				placeholder: 'Add Duration Filter',
				default: {},
				displayOptions: {
					show: {
						operation: ['getCallHistory'],
					},
				},
				options: [
					{
						displayName: 'Minimum Duration (seconds)',
						name: 'minDuration',
						type: 'number',
						default: 0,
						description: 'Minimum call duration in seconds',
						typeOptions: {
							minValue: 0,
						},
					},
					{
						displayName: 'Maximum Duration (seconds)',
						name: 'maxDuration',
						type: 'number',
						default: 0,
						description: 'Maximum call duration in seconds (0 = no limit)',
						typeOptions: {
							minValue: 0,
						},
					},
				],
			},
			// Extension Information parameters
			{
				displayName: 'Extension',
				name: 'extension',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['getExtensionInfo'],
					},
				},
				description: 'Extension number to retrieve information for',
				placeholder: '100',
			},
			{
				displayName: 'Include Offline Extensions',
				name: 'includeOffline',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['getAllExtensions'],
					},
				},
				description: 'Whether to include offline extensions in the results',
			},
			// Report Generation parameters
			{
				displayName: 'Group Report By',
				name: 'groupBy',
				type: 'options',
				default: 'none',
				displayOptions: {
					show: {
						operation: ['generateReport'],
					},
				},
				options: [
					{
						name: 'No Grouping',
						value: 'none',
					},
					{
						name: 'By Hour',
						value: 'hour',
					},
					{
						name: 'By Day',
						value: 'day',
					},
					{
						name: 'By Extension',
						value: 'extension',
					},
				],
			},
			{
				displayName: 'Include Call Details',
				name: 'includeCallDetails',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['generateReport'],
					},
				},
				description: 'Whether to include individual call details in the report',
			},
			// General options
			{
				displayName: 'Include Recording URLs',
				name: 'includeRecordings',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['getCallInfo', 'getCallHistory', 'getActiveCalls'],
					},
				},
				description: 'Whether to include call recording URLs when available',
			},
			{
				displayName: 'Has Recording Filter',
				name: 'hasRecordingFilter',
				type: 'options',
				default: 'all',
				displayOptions: {
					show: {
						operation: ['getCallHistory'],
					},
				},
				options: [
					{
						name: 'All Calls',
						value: 'all',
					},
					{
						name: 'Only Calls with Recordings',
						value: 'true',
					},
					{
						name: 'Only Calls without Recordings',
						value: 'false',
					},
				],
			},
			// Pagination
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				displayOptions: {
					show: {
						operation: ['getCallHistory', 'getActiveCalls'],
					},
				},
				description: 'Maximum number of results to return',
				typeOptions: {
					minValue: 1,
					maxValue: 1000,
				},
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						operation: ['getCallHistory'],
					},
				},
				description: 'Number of results to skip (for pagination)',
				typeOptions: {
					minValue: 0,
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('3cxCallControlApi');
		const operation = this.getNodeParameter('operation', 0) as string;

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

		const returnData: INodeExecutionData[] = [];

		try {
			for (let i = 0; i < items.length; i++) {
				try {
					let result: any;

					switch (operation) {
						case 'getCallInfo':
							result = await this.executeGetCallInfo(callInfoManager, i);
							break;
						case 'getCallHistory':
							result = await this.executeGetCallHistory(callInfoManager, i);
							break;
						case 'getActiveCalls':
							result = await this.executeGetActiveCalls(callInfoManager, i);
							break;
						case 'getStatistics':
							result = await this.executeGetStatistics(callInfoManager, i);
							break;
						case 'getExtensionInfo':
							result = await this.executeGetExtensionInfo(callInfoManager, i);
							break;
						case 'getAllExtensions':
							result = await this.executeGetAllExtensions(callInfoManager, i);
							break;
						case 'generateReport':
							result = await this.executeGenerateReport(callInfoManager, i);
							break;
						default:
							throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: i });
					}

					// Handle different result types
					if (Array.isArray(result)) {
						// Multiple items (e.g., call history, extensions list)
						result.forEach((item: any, index: number) => {
							returnData.push({
								json: {
									...items[i].json,
									...item,
									operation,
									itemIndex: index,
									timestamp: new Date().toISOString(),
								},
							});
						});
					} else {
						// Single item (e.g., call info, statistics)
						returnData.push({
							json: {
								...items[i].json,
								...result,
								operation,
								timestamp: new Date().toISOString(),
							},
						});
					}

				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								...items[i].json,
								error: error instanceof Error ? error.message : 'Unknown error',
								operation,
								success: false,
								timestamp: new Date().toISOString(),
							},
						});
					} else {
						throw new NodeOperationError(this.getNode(), error instanceof Error ? error.message : 'Unknown error', { itemIndex: i });
					}
				}
			}

		} finally {
			// Clean up resources
			callInfoManager.destroy();
			authManager.destroy();
		}

		return [returnData];
	}

	private async executeGetCallInfo(callInfoManager: any, itemIndex: number): Promise<any> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const includeRecordings = this.getNodeParameter('includeRecordings', itemIndex, false) as boolean;

		const callInfo = await callInfoManager.getCallInfo(callId);

		const result: any = {
			type: 'call_info',
			callInfo,
		};

		if (!includeRecordings && callInfo.recordingUrl) {
			delete callInfo.recordingUrl;
		}

		return result;
	}

	private async executeGetCallHistory(callInfoManager: any, itemIndex: number): Promise<any> {
		const timeRange = this.getNodeParameter('timeRange', itemIndex) as string;
		const extensionFilter = this.getNodeParameter('extensionFilter', itemIndex, '') as string;
		const callDirection = this.getNodeParameter('callDirection', itemIndex, 'all') as string;
		const statusFilter = this.getNodeParameter('statusFilter', itemIndex, []) as string[];
		const phoneNumberFilter = this.getNodeParameter('phoneNumberFilter', itemIndex, '') as string;
		const didFilter = this.getNodeParameter('didFilter', itemIndex, '') as string;
		const durationFilter = this.getNodeParameter('durationFilter', itemIndex, {}) as any;
		const hasRecordingFilter = this.getNodeParameter('hasRecordingFilter', itemIndex, 'all') as string;
		const includeRecordings = this.getNodeParameter('includeRecordings', itemIndex, false) as boolean;
		const limit = this.getNodeParameter('limit', itemIndex, 100) as number;
		const offset = this.getNodeParameter('offset', itemIndex, 0) as number;

		const { startDate, endDate } = this.getTimeRange(timeRange, itemIndex);

		const filter: CallHistoryFilter = {
			startDate,
			endDate,
			limit,
			offset,
		};

		// Apply filters
		if (extensionFilter) filter.extension = extensionFilter;
		if (callDirection !== 'all') filter.direction = callDirection as any;
		if (phoneNumberFilter) filter.phoneNumber = phoneNumberFilter;
		if (didFilter) filter.did = didFilter;
		if (durationFilter.minDuration) filter.minDuration = durationFilter.minDuration;
		if (durationFilter.maxDuration) filter.maxDuration = durationFilter.maxDuration;
		if (hasRecordingFilter !== 'all') filter.hasRecording = hasRecordingFilter === 'true';

		const callHistory = await callInfoManager.getCallHistory(filter);

		// Filter by status if specified
		let filteredCalls = callHistory.calls;
		if (statusFilter.length > 0) {
			filteredCalls = callHistory.calls.filter((call: CallInfo) => statusFilter.includes(call.status));
		}

		// Remove recording URLs if not requested
		if (!includeRecordings) {
			filteredCalls = filteredCalls.map((call: CallInfo) => {
				const { recordingUrl, ...callWithoutRecording } = call;
				return callWithoutRecording;
			});
		}

		return filteredCalls.map((call: CallInfo) => ({
			type: 'call_history_item',
			...call,
		}));
	}

	private async executeGetActiveCalls(callInfoManager: any, itemIndex: number): Promise<any> {
		const extensionFilter = this.getNodeParameter('extensionFilter', itemIndex, '') as string;
		const callDirection = this.getNodeParameter('callDirection', itemIndex, 'all') as string;
		const includeRecordings = this.getNodeParameter('includeRecordings', itemIndex, false) as boolean;

		const activeCalls = await callInfoManager.getActiveCalls(extensionFilter || undefined);

		// Filter by direction if specified
		let filteredCalls = activeCalls.calls;
		if (callDirection !== 'all') {
			filteredCalls = activeCalls.calls.filter((call: CallInfo) => call.direction === callDirection);
		}

		// Remove recording URLs if not requested
		if (!includeRecordings) {
			filteredCalls = filteredCalls.map((call: CallInfo) => {
				const { recordingUrl, ...callWithoutRecording } = call;
				return callWithoutRecording;
			});
		}

		return filteredCalls.map((call: CallInfo) => ({
			type: 'active_call',
			isActive: true,
			...call,
		}));
	}

	private async executeGetStatistics(callInfoManager: any, itemIndex: number): Promise<any> {
		const timeRange = this.getNodeParameter('timeRange', itemIndex) as string;
		const extensionFilter = this.getNodeParameter('extensionFilter', itemIndex, '') as string;

		const { startDate, endDate } = this.getTimeRange(timeRange, itemIndex);

		const statistics = await callInfoManager.getCallStatistics(
			startDate,
			endDate,
			extensionFilter || undefined
		);

		return {
			type: 'call_statistics',
			statistics,
			period: {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
				timeRange,
			},
		};
	}

	private async executeGetExtensionInfo(callInfoManager: any, itemIndex: number): Promise<any> {
		const extension = this.getNodeParameter('extension', itemIndex) as string;

		const extensionInfo = await callInfoManager.getExtensionInfo(extension);

		return {
			type: 'extension_info',
			extensionInfo,
		};
	}

	private async executeGetAllExtensions(callInfoManager: any, itemIndex: number): Promise<any> {
		const includeOffline = this.getNodeParameter('includeOffline', itemIndex, false) as boolean;

		const extensions = await callInfoManager.getAllExtensions(includeOffline);

		return extensions.map((extension: ExtensionInfo) => ({
			type: 'extension_info',
			extensionInfo: extension,
		}));
	}

	private async executeGenerateReport(callInfoManager: any, itemIndex: number): Promise<any> {
		const timeRange = this.getNodeParameter('timeRange', itemIndex) as string;
		const extensionFilter = this.getNodeParameter('extensionFilter', itemIndex, '') as string;
		const groupBy = this.getNodeParameter('groupBy', itemIndex, 'none') as string;
		const includeCallDetails = this.getNodeParameter('includeCallDetails', itemIndex, false) as boolean;

		const { startDate, endDate } = this.getTimeRange(timeRange, itemIndex);

		const reportOptions = {
			extension: extensionFilter || undefined,
			includeDetails: includeCallDetails,
			groupBy: groupBy === 'none' ? undefined : groupBy,
		};

		const report = await callInfoManager.generateCallReport(startDate, endDate, reportOptions);

		const result: any = {
			type: 'call_report',
			reportPeriod: {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
				timeRange,
			},
			summary: report.summary,
		};

		if (report.groupedData) {
			result.groupedData = report.groupedData;
		}

		if (report.details && includeCallDetails) {
			result.callDetails = report.details;
			result.totalCallDetails = report.details.length;
		}

		return result;
	}

	/**
	 * Get time range dates based on the selected option
	 */
	private getTimeRange(timeRange: string, itemIndex: number): { startDate: Date; endDate: Date } {
		const now = new Date();
		let startDate: Date;
		let endDate: Date = now;

		switch (timeRange) {
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
				const startDateStr = this.getNodeParameter('startDate', itemIndex, '') as string;
				const endDateStr = this.getNodeParameter('endDate', itemIndex, '') as string;
				startDate = startDateStr ? new Date(startDateStr) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
				endDate = endDateStr ? new Date(endDateStr) : now;
				break;
			default:
				startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		}

		return { startDate, endDate };
	}
}