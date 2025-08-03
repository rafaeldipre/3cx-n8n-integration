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
import { createCallManager } from '../../utils/callManager';
import { 
	ConnectionConfig,
	CallControlResponse,
	TransferType,
	DTMFOptions,
	AudioOptions,
	BatchCallRequest,
} from '../../types';

export class ThreeCXCallControl implements INodeType {
	description: INodeTypeDescription = {
		displayName: '3CX Call Control',
		name: '3cxCallControl',
		icon: 'file:3cx-control.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Control 3CX calls with operations like answer, hangup, transfer, and more',
		defaults: {
			name: '3CX Call Control',
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
				default: 'answer',
				options: [
					{
						name: 'Answer Call',
						value: 'answer',
						description: 'Answer an incoming call',
						action: 'Answer a call',
					},
					{
						name: 'Hangup Call',
						value: 'hangup',
						description: 'Terminate an active call',
						action: 'Hangup a call',
					},
					{
						name: 'Transfer Call',
						value: 'transfer',
						description: 'Transfer a call to another extension or external number',
						action: 'Transfer a call',
					},
					{
						name: 'Park Call',
						value: 'park',
						description: 'Park a call for later retrieval',
						action: 'Park a call',
					},
					{
						name: 'Hold Call',
						value: 'hold',
						description: 'Put a call on hold',
						action: 'Hold a call',
					},
					{
						name: 'Resume Call',
						value: 'resume',
						description: 'Resume a call from hold',
						action: 'Resume a call',
					},
					{
						name: 'Conference Call',
						value: 'conference',
						description: 'Add a call to a conference',
						action: 'Add call to conference',
					},
					{
						name: 'Play Audio',
						value: 'playAudio',
						description: 'Play an audio file to the caller',
						action: 'Play audio to caller',
					},
					{
						name: 'Collect DTMF',
						value: 'collectDTMF',
						description: 'Collect DTMF digits from the caller',
						action: 'Collect DTMF input',
					},
					{
						name: 'Batch Operations',
						value: 'batch',
						description: 'Execute multiple call operations',
						action: 'Execute batch operations',
					},
				],
			},
			// Call ID parameter (used by all operations)
			{
				displayName: 'Call ID',
				name: 'callId',
				type: 'string',
				default: '={{$json["callId"]}}',
				required: true,
				displayOptions: {
					hide: {
						operation: ['batch'],
					},
				},
				description: 'The ID of the call to control',
				placeholder: 'abc123-def456-ghi789',
			},
			// Answer Call parameters
			{
				displayName: 'Extension',
				name: 'extension',
				type: 'string',
				default: '999',
				displayOptions: {
					show: {
						operation: ['answer'],
					},
				},
				description: 'Extension to answer the call with',
				placeholder: '999',
			},
			// Hangup Call parameters
			{
				displayName: 'Hangup Reason',
				name: 'hangupReason',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['hangup'],
					},
				},
				description: 'Optional reason for hanging up the call',
				placeholder: 'Call completed',
			},
			// Transfer Call parameters
			{
				displayName: 'Transfer Target',
				name: 'transferTarget',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['transfer'],
					},
				},
				description: 'Extension or external number to transfer the call to',
				placeholder: '101 or +1234567890',
			},
			{
				displayName: 'Transfer Type',
				name: 'transferType',
				type: 'options',
				default: 'blind',
				displayOptions: {
					show: {
						operation: ['transfer'],
					},
				},
				options: [
					{
						name: 'Blind Transfer',
						value: 'blind',
						description: 'Transfer call without announcing',
					},
					{
						name: 'Attended Transfer',
						value: 'attended',
						description: 'Announce the call before transferring',
					},
					{
						name: 'Warm Transfer',
						value: 'warm',
						description: 'Conference before transferring',
					},
				],
			},
			{
				displayName: 'Transfer Announcement',
				name: 'transferAnnouncement',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['transfer'],
						transferType: ['attended', 'warm'],
					},
				},
				description: 'Optional announcement to play before transfer',
				placeholder: 'Transfer announcement message',
			},
			// Park Call parameters
			{
				displayName: 'Park Slot',
				name: 'parkSlot',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['park'],
					},
				},
				description: 'Specific park slot (leave empty for auto-assignment)',
				placeholder: '701',
			},
			{
				displayName: 'Park Timeout (seconds)',
				name: 'parkTimeout',
				type: 'number',
				default: 300,
				displayOptions: {
					show: {
						operation: ['park'],
					},
				},
				description: 'How long to keep the call parked before returning',
				typeOptions: {
					minValue: 30,
					maxValue: 3600,
				},
			},
			// Hold Call parameters
			{
				displayName: 'Music on Hold',
				name: 'musicOnHold',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['hold'],
					},
				},
				description: 'Whether to play music while the call is on hold',
			},
			// Conference Call parameters
			{
				displayName: 'Conference Target',
				name: 'conferenceTarget',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['conference'],
					},
				},
				description: 'Conference room number or extension',
				placeholder: '8000',
			},
			{
				displayName: 'Conference Action',
				name: 'conferenceAction',
				type: 'options',
				default: 'join',
				displayOptions: {
					show: {
						operation: ['conference'],
					},
				},
				options: [
					{
						name: 'Join Existing',
						value: 'join',
						description: 'Join an existing conference',
					},
					{
						name: 'Create New',
						value: 'create',
						description: 'Create a new conference',
					},
				],
			},
			{
				displayName: 'Conference PIN',
				name: 'conferencePin',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['conference'],
					},
				},
				description: 'PIN code for the conference (if required)',
				placeholder: '1234',
			},
			// Play Audio parameters
			{
				displayName: 'Audio File Path',
				name: 'audioPath',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['playAudio'],
					},
				},
				description: 'Path or URL to the audio file to play',
				placeholder: '/path/to/audio.wav or https://example.com/audio.mp3',
			},
			{
				displayName: 'Audio Options',
				name: 'audioOptions',
				type: 'collection',
				placeholder: 'Add Audio Option',
				default: {},
				displayOptions: {
					show: {
						operation: ['playAudio'],
					},
				},
				options: [
					{
						displayName: 'Loop Audio',
						name: 'loop',
						type: 'boolean',
						default: false,
						description: 'Whether to loop the audio playback',
					},
					{
						displayName: 'Volume Level',
						name: 'volume',
						type: 'number',
						default: 100,
						description: 'Volume level (0-100)',
						typeOptions: {
							minValue: 0,
							maxValue: 100,
						},
					},
					{
						displayName: 'Stop Current Audio',
						name: 'stopCurrent',
						type: 'boolean',
						default: true,
						description: 'Stop any currently playing audio before starting new',
					},
					{
						displayName: 'Audio Format',
						name: 'format',
						type: 'options',
						default: 'wav',
						options: [
							{ name: 'WAV', value: 'wav' },
							{ name: 'MP3', value: 'mp3' },
							{ name: 'OGG', value: 'ogg' },
						],
						description: 'Audio format (auto-detected if not specified)',
					},
				],
			},
			// Collect DTMF parameters
			{
				displayName: 'DTMF Options',
				name: 'dtmfOptions',
				type: 'collection',
				placeholder: 'Add DTMF Option',
				default: {},
				required: true,
				displayOptions: {
					show: {
						operation: ['collectDTMF'],
					},
				},
				options: [
					{
						displayName: 'Max Digits',
						name: 'maxDigits',
						type: 'number',
						default: 10,
						description: 'Maximum number of digits to collect',
						typeOptions: {
							minValue: 1,
							maxValue: 50,
						},
					},
					{
						displayName: 'Timeout (seconds)',
						name: 'timeout',
						type: 'number',
						default: 30,
						description: 'Timeout for digit collection',
						typeOptions: {
							minValue: 1,
							maxValue: 300,
						},
					},
					{
						displayName: 'Terminator Character',
						name: 'terminator',
						type: 'string',
						default: '#',
						description: 'Character that terminates input (e.g., #)',
						placeholder: '#',
					},
					{
						displayName: 'Play Prompt',
						name: 'playPrompt',
						type: 'string',
						default: '',
						description: 'Audio prompt to play before collecting digits',
						placeholder: 'Please enter your account number',
					},
					{
						displayName: 'Min Digits',
						name: 'minDigits',
						type: 'number',
						default: 1,
						description: 'Minimum number of digits required',
						typeOptions: {
							minValue: 1,
							maxValue: 50,
						},
					},
					{
						displayName: 'Inter-digit Timeout (seconds)',
						name: 'interDigitTimeout',
						type: 'number',
						default: 5,
						description: 'Timeout between digits',
						typeOptions: {
							minValue: 1,
							maxValue: 30,
						},
					},
					{
						displayName: 'First Digit Timeout (seconds)',
						name: 'firstDigitTimeout',
						type: 'number',
						default: 10,
						description: 'Timeout for the first digit',
						typeOptions: {
							minValue: 1,
							maxValue: 60,
						},
					},
				],
			},
			// Batch Operations parameters
			{
				displayName: 'Execution Mode',
				name: 'executionMode',
				type: 'options',
				default: 'parallel',
				displayOptions: {
					show: {
						operation: ['batch'],
					},
				},
				options: [
					{
						name: 'Parallel',
						value: 'parallel',
						description: 'Execute all operations simultaneously',
					},
					{
						name: 'Sequential',
						value: 'sequence',
						description: 'Execute operations one after another',
					},
				],
			},
			{
				displayName: 'Stop on Error',
				name: 'stopOnError',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['batch'],
						executionMode: ['sequence'],
					},
				},
				description: 'Stop execution if an operation fails (sequential mode only)',
			},
			{
				displayName: 'Batch Operations',
				name: 'batchOperations',
				type: 'fixedCollection',
				default: { operations: [] },
				displayOptions: {
					show: {
						operation: ['batch'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						name: 'operations',
						displayName: 'Operation',
						values: [
							{
								displayName: 'Operation Type',
								name: 'operationType',
								type: 'options',
								default: 'answer',
								options: [
									{ name: 'Answer', value: 'answer' },
									{ name: 'Hangup', value: 'hangup' },
									{ name: 'Transfer', value: 'transfer' },
									{ name: 'Park', value: 'park' },
									{ name: 'Hold', value: 'hold' },
									{ name: 'Resume', value: 'resume' },
								],
							},
							{
								displayName: 'Call ID',
								name: 'callId',
								type: 'string',
								default: '',
								description: 'Call ID for this operation',
							},
							{
								displayName: 'Parameters',
								name: 'parameters',
								type: 'json',
								default: '{}',
								description: 'JSON object with operation-specific parameters',
							},
						],
					},
				],
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
		const callManager = createCallManager(apiClient, {
			defaultExtension: '999', // Default extension for operations
			enableLogging: false,
		});

		const returnData: INodeExecutionData[] = [];

		try {
			for (let i = 0; i < items.length; i++) {
				try {
					let result: any;

					switch (operation) {
						case 'answer':
							result = await this.executeAnswerCall(callManager, i);
							break;
						case 'hangup':
							result = await this.executeHangupCall(callManager, i);
							break;
						case 'transfer':
							result = await this.executeTransferCall(callManager, i);
							break;
						case 'park':
							result = await this.executeParkCall(callManager, i);
							break;
						case 'hold':
							result = await this.executeHoldCall(callManager, i);
							break;
						case 'resume':
							result = await this.executeResumeCall(callManager, i);
							break;
						case 'conference':
							result = await this.executeConferenceCall(callManager, i);
							break;
						case 'playAudio':
							result = await this.executePlayAudio(callManager, i);
							break;
						case 'collectDTMF':
							result = await this.executeCollectDTMF(callManager, i);
							break;
						case 'batch':
							result = await this.executeBatchOperations(callManager, i);
							break;
						default:
							throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: i });
					}

					returnData.push({
						json: {
							...items[i].json,
							result,
							operation,
							timestamp: new Date().toISOString(),
						},
					});

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
			callManager.cancelAllOperations();
			authManager.destroy();
		}

		return [returnData];
	}

	private async executeAnswerCall(callManager: any, itemIndex: number): Promise<CallControlResponse> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const extension = this.getNodeParameter('extension', itemIndex, '999') as string;
		
		return await callManager.answerCall(callId, extension);
	}

	private async executeHangupCall(callManager: any, itemIndex: number): Promise<CallControlResponse> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const reason = this.getNodeParameter('hangupReason', itemIndex, '') as string;
		
		return await callManager.hangupCall(callId, reason || undefined);
	}

	private async executeTransferCall(callManager: any, itemIndex: number): Promise<CallControlResponse> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const target = this.getNodeParameter('transferTarget', itemIndex) as string;
		const transferType = this.getNodeParameter('transferType', itemIndex, 'blind') as TransferType;
		const announcement = this.getNodeParameter('transferAnnouncement', itemIndex, '') as string;
		
		return await callManager.transferCall(callId, target, transferType, announcement || undefined);
	}

	private async executeParkCall(callManager: any, itemIndex: number): Promise<CallControlResponse> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const parkSlot = this.getNodeParameter('parkSlot', itemIndex, '') as string;
		const timeout = this.getNodeParameter('parkTimeout', itemIndex, 300) as number;
		
		return await callManager.parkCall(callId, parkSlot || undefined, timeout);
	}

	private async executeHoldCall(callManager: any, itemIndex: number): Promise<CallControlResponse> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const musicOnHold = this.getNodeParameter('musicOnHold', itemIndex, true) as boolean;
		
		return await callManager.holdCall(callId, musicOnHold);
	}

	private async executeResumeCall(callManager: any, itemIndex: number): Promise<CallControlResponse> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		
		return await callManager.resumeCall(callId);
	}

	private async executeConferenceCall(callManager: any, itemIndex: number): Promise<CallControlResponse> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const target = this.getNodeParameter('conferenceTarget', itemIndex) as string;
		const action = this.getNodeParameter('conferenceAction', itemIndex, 'join') as 'join' | 'create';
		const pin = this.getNodeParameter('conferencePin', itemIndex, '') as string;
		
		return await callManager.conferenceCall(callId, target, action, pin || undefined);
	}

	private async executePlayAudio(callManager: any, itemIndex: number): Promise<CallControlResponse> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const audioPath = this.getNodeParameter('audioPath', itemIndex) as string;
		const audioOptions = this.getNodeParameter('audioOptions', itemIndex, {}) as AudioOptions;
		
		return await callManager.playAudio(callId, audioPath, audioOptions);
	}

	private async executeCollectDTMF(callManager: any, itemIndex: number): Promise<CallControlResponse> {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const dtmfOptions = this.getNodeParameter('dtmfOptions', itemIndex) as DTMFOptions;
		
		// Ensure required fields are present
		if (!dtmfOptions.maxDigits) dtmfOptions.maxDigits = 10;
		if (!dtmfOptions.timeout) dtmfOptions.timeout = 30;
		
		return await callManager.collectDTMF(callId, dtmfOptions);
	}

	private async executeBatchOperations(callManager: any, itemIndex: number): Promise<any> {
		const executionMode = this.getNodeParameter('executionMode', itemIndex, 'parallel') as 'parallel' | 'sequence';
		const stopOnError = this.getNodeParameter('stopOnError', itemIndex, true) as boolean;
		const batchOps = this.getNodeParameter('batchOperations', itemIndex, { operations: [] }) as any;
		
		// Convert batch operations to the expected format
		const operations = batchOps.operations.map((op: any) => {
			const baseOp = {
				callId: op.callId,
				operation: op.operationType,
				timestamp: new Date(),
			};
			
			// Parse parameters JSON
			let params = {};
			try {
				params = JSON.parse(op.parameters || '{}');
			} catch (error) {
				// Use empty object if JSON parsing fails
			}
			
			return { ...baseOp, ...params };
		});
		
		const batchRequest: BatchCallRequest = {
			operations,
			executionMode,
			stopOnError,
		};
		
		return await callManager.batchOperations(batchRequest);
	}
}