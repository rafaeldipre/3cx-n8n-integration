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
import { CallInfo, CallEvent, ConnectionConfig } from '../../types';

export class ThreeCXCallReceiver implements INodeType {
	description: INodeTypeDescription = {
		displayName: '3CX Call Receiver',
		name: '3cxCallReceiver',
		icon: 'file:3cx.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["extension"]}}',
		description: 'Receives calls directed to a specific 3CX extension for direct call control',
		defaults: {
			name: '3CX Call Receiver',
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
				default: 'receiveInbound',
				options: [
					{
						name: 'Receive Inbound Calls',
						value: 'receiveInbound',
						description: 'Trigger on incoming calls to the specified extension',
					},
					{
						name: 'Monitor Extension Calls',
						value: 'monitorExtension',
						description: 'Monitor all calls (inbound/outbound) for the specified extension',
					},
				],
			},
			{
				displayName: 'Extension',
				name: 'extension',
				type: 'string',
				default: '999',
				required: true,
				description: 'The extension to monitor for incoming calls (e.g., 999 for dedicated call control)',
				placeholder: '999',
			},
			{
				displayName: 'Call Events to Monitor',
				name: 'eventTypes',
				type: 'multiOptions',
				default: ['call_started', 'call_answered', 'call_ended'],
				displayOptions: {
					show: {
						operation: ['monitorExtension'],
					},
				},
				options: [
					{
						name: 'Call Started',
						value: 'call_started',
						description: 'When a call begins ringing',
					},
					{
						name: 'Call Answered',
						value: 'call_answered',
						description: 'When a call is answered',
					},
					{
						name: 'Call Ended',
						value: 'call_ended',
						description: 'When a call ends or is terminated',
					},
					{
						name: 'Call Transferred',
						value: 'call_transferred',
						description: 'When a call is transferred',
					},
					{
						name: 'Call Parked',
						value: 'call_parked',
						description: 'When a call is parked',
					},
					{
						name: 'Call Held',
						value: 'call_held',
						description: 'When a call is put on hold',
					},
					{
						name: 'Call Resumed',
						value: 'call_resumed',
						description: 'When a call is resumed from hold',
					},
					{
						name: 'DTMF Received',
						value: 'dtmf_received',
						description: 'When DTMF digits are received',
					},
				],
			},
			{
				displayName: 'Call Direction Filter',
				name: 'callDirection',
				type: 'options',
				default: 'inbound',
				displayOptions: {
					show: {
						operation: ['monitorExtension'],
					},
				},
				options: [
					{
						name: 'All Directions',
						value: 'all',
						description: 'Monitor both inbound and outbound calls',
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
				displayName: 'Include Call Details',
				name: 'includeCallDetails',
				type: 'boolean',
				default: true,
				description: 'Whether to include detailed call information in the output',
			},
			{
				displayName: 'Include Recording URL',
				name: 'includeRecording',
				type: 'boolean',
				default: false,
				description: 'Whether to include call recording URL if available',
			},
			{
				displayName: 'Polling Interval',
				name: 'pollingInterval',
				type: 'number',
				default: 5,
				description: 'How often to check for new calls (in seconds)',
				typeOptions: {
					minValue: 1,
					maxValue: 300,
				},
			},
			{
				displayName: 'Max Calls per Poll',
				name: 'maxCallsPerPoll',
				type: 'number',
				default: 10,
				description: 'Maximum number of calls to process in each polling cycle',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('3cxCallControlApi');
		const operation = this.getNodeParameter('operation', 0) as string;
		const extension = this.getNodeParameter('extension', 0) as string;
		const eventTypes = this.getNodeParameter('eventTypes', 0, ['call_started']) as string[];
		const callDirection = this.getNodeParameter('callDirection', 0, 'inbound') as string;
		const includeCallDetails = this.getNodeParameter('includeCallDetails', 0, true) as boolean;
		const includeRecording = this.getNodeParameter('includeRecording', 0, false) as boolean;
		const maxCallsPerPoll = this.getNodeParameter('maxCallsPerPoll', 0, 10) as number;

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
				enableRealTimeMonitoring: false, // We'll poll manually
				enableLogging: false,
			});

			const items: INodeExecutionData[] = [];
			const now = new Date();
			const lastPoll = this.getWorkflowStaticData('node').lastPollTime as string;
			const lastPollTime = lastPoll ? new Date(lastPoll) : new Date(now.getTime() - 60000); // Default to 1 minute ago

			try {
				if (operation === 'receiveInbound') {
					// Get calls to the specific extension since last poll
					const callHistory = await callInfoManager.getCallHistory({
						startDate: lastPollTime,
						endDate: now,
						extension,
						direction: 'inbound',
						limit: maxCallsPerPoll,
					});

					for (const call of callHistory.calls) {
						// Only include calls that started after the last poll
						if (call.startTime > lastPollTime) {
							const item = this.createCallItem(call, includeCallDetails, includeRecording);
							items.push(item);
						}
					}

					// Also check for currently active calls to the extension
					const activeCalls = await callInfoManager.getActiveCalls(extension);
					for (const call of activeCalls.calls) {
						// Only include inbound calls that started after last poll
						if (call.direction === 'inbound' && call.startTime > lastPollTime) {
							const item = this.createCallItem(call, includeCallDetails, includeRecording);
							item.json.isActive = true;
							items.push(item);
						}
					}

				} else if (operation === 'monitorExtension') {
					// Monitor all call events for the extension
					// Note: In a real implementation, this would use webhooks or event streaming
					// For polling, we simulate by checking recent call history and active calls

					const callHistory = await callInfoManager.getCallHistory({
						startDate: lastPollTime,
						endDate: now,
						extension,
						direction: callDirection === 'all' ? undefined : (callDirection as any),
						limit: maxCallsPerPoll,
					});

					for (const call of callHistory.calls) {
						if (call.startTime > lastPollTime) {
							// Create events based on call state
							const events = this.generateEventsFromCall(call, eventTypes);
							for (const event of events) {
								const item = this.createEventItem(event, call, includeCallDetails);
								items.push(item);
							}
						}
					}

					// Check active calls for real-time events
					const activeCalls = await callInfoManager.getActiveCalls(extension);
					for (const call of activeCalls.calls) {
						if (callDirection !== 'all' && call.direction !== callDirection) continue;
						
						// Generate current state event if call started after last poll
						if (call.startTime > lastPollTime) {
							const currentEvent: CallEvent = {
								eventType: call.status === 'answered' ? 'call_answered' : 'call_started',
								callId: call.callId,
								timestamp: call.startTime,
								extension: call.extension,
								data: {
									fromNumber: call.fromNumber,
									toNumber: call.toNumber,
									direction: call.direction,
									did: call.did,
								} as any,
							};

							if (eventTypes.includes(currentEvent.eventType)) {
								const item = this.createEventItem(currentEvent, call, includeCallDetails);
								item.json.isActive = true;
								items.push(item);
							}
						}
					}
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
			throw new NodeOperationError(this.getNode(), 'Unknown error occurred while polling for calls');
		}
	}

	/**
	 * Create n8n item from call information
	 */
	private createCallItem(call: CallInfo, includeDetails: boolean, includeRecording: boolean): INodeExecutionData {
		const baseData = {
			callId: call.callId,
			fromNumber: call.fromNumber,
			toNumber: call.toNumber,
			extension: call.extension,
			direction: call.direction,
			status: call.status,
			startTime: call.startTime.toISOString(),
			endTime: call.endTime?.toISOString(),
			duration: call.duration,
		};

		const item: INodeExecutionData = {
			json: includeDetails ? {
				...baseData,
				did: call.did,
				type: call.type,
				metadata: call.metadata,
				queueInfo: call.queueInfo,
				transferInfo: call.transferInfo,
				conferenceInfo: call.conferenceInfo,
			} : baseData,
		};

		if (includeRecording && call.recordingUrl) {
			item.json.recordingUrl = call.recordingUrl;
		}

		return item;
	}

	/**
	 * Create n8n item from call event
	 */
	private createEventItem(event: CallEvent, call: CallInfo, includeDetails: boolean): INodeExecutionData {
		const item: INodeExecutionData = {
			json: {
				eventType: event.eventType,
				callId: event.callId,
				extension: event.extension,
				timestamp: event.timestamp.toISOString(),
				eventData: event.data,
				callInfo: includeDetails ? call : {
					callId: call.callId,
					fromNumber: call.fromNumber,
					toNumber: call.toNumber,
					status: call.status,
					direction: call.direction,
				},
			},
		};

		return item;
	}

	/**
	 * Generate events from call state (for monitoring mode)
	 */
	private generateEventsFromCall(call: CallInfo, eventTypes: string[]): CallEvent[] {
		const events: CallEvent[] = [];

		// Generate call_started event
		if (eventTypes.includes('call_started')) {
			events.push({
				eventType: 'call_started',
				callId: call.callId,
				timestamp: call.startTime,
				extension: call.extension,
				data: {
					fromNumber: call.fromNumber,
					toNumber: call.toNumber,
					direction: call.direction,
					did: call.did,
				} as any,
			});
		}

		// Generate call_answered event if call was answered
		if (eventTypes.includes('call_answered') && call.status === 'answered') {
			events.push({
				eventType: 'call_answered',
				callId: call.callId,
				timestamp: call.startTime, // Would ideally be answer time
				extension: call.extension,
				data: {
					answerTime: call.startTime,
					extension: call.extension,
				} as any,
			});
		}

		// Generate call_ended event if call has ended
		if (eventTypes.includes('call_ended') && call.endTime) {
			events.push({
				eventType: 'call_ended',
				callId: call.callId,
				timestamp: call.endTime,
				extension: call.extension,
				data: {
					endTime: call.endTime,
					duration: call.duration || 0,
					reason: 'normal', // Would need to determine actual reason
				} as any,
			});
		}

		// Generate transfer event if call was transferred
		if (eventTypes.includes('call_transferred') && call.transferInfo) {
			events.push({
				eventType: 'call_transferred',
				callId: call.callId,
				timestamp: call.transferInfo.transferTime,
				extension: call.extension,
				data: {
					target: call.transferInfo.target,
					type: call.transferInfo.type,
					transferTime: call.transferInfo.transferTime,
				} as any,
			});
		}

		return events;
	}
}