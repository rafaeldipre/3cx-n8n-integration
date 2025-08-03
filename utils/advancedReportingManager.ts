/**
 * Advanced Reporting Manager for 3CX
 * Comprehensive reporting system with advanced filtering, custom reports, and export capabilities
 */

import { ThreeCXAPIClient } from './apiClient';
import { CallInfo, CallStatistics, CallHistoryFilter } from '../types';

export interface ReportDefinition {
	reportId: string;
	name: string;
	description: string;
	type: 'call_summary' | 'agent_performance' | 'queue_statistics' | 'custom_sql' | 'real_time_dashboard';
	category: 'operational' | 'analytical' | 'compliance' | 'executive';
	parameters: ReportParameter[];
	filters: AdvancedReportFilter[];
	groupBy: string[];
	sortBy: ReportSortCriteria[];
	visualization: ReportVisualization;
	schedule?: ReportSchedule;
	permissions: ReportPermissions;
	createdBy: string;
	createdAt: Date;
	lastModified: Date;
	isActive: boolean;
	metadata: Record<string, any>;
}

export interface ReportParameter {
	name: string;
	type: 'string' | 'number' | 'date' | 'boolean' | 'list' | 'range';
	label: string;
	description: string;
	required: boolean;
	defaultValue?: any;
	options?: { value: any; label: string }[];
	validation?: {
		min?: number;
		max?: number;
		pattern?: string;
		customValidator?: string;
	};
}

export interface AdvancedReportFilter {
	field: string;
	operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 
			  'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null' |
			  'regex' | 'distance' | 'custom_function';
	value: any;
	condition: 'AND' | 'OR';
	group?: string;
	caseSensitive?: boolean;
	description?: string;
}

export interface ReportSortCriteria {
	field: string;
	direction: 'asc' | 'desc';
	priority: number;
	nullsPosition?: 'first' | 'last';
}

export interface ReportVisualization {
	type: 'table' | 'chart' | 'dashboard' | 'pivot' | 'map' | 'timeline';
	chartType?: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge' | 'treemap';
	layout: {
		columns: ReportColumn[];
		pagination?: {
			enabled: boolean;
			pageSize: number;
			allowSizeChange: boolean;
		};
		grouping?: {
			enabled: boolean;
			expandable: boolean;
			defaultExpanded: boolean;
		};
		totals?: {
			enabled: boolean;
			position: 'top' | 'bottom' | 'both';
			fields: string[];
		};
	};
	formatting: {
		numberFormat?: string;
		dateFormat?: string;
		currencyFormat?: string;
		conditionalFormatting?: ConditionalFormat[];
	};
	interactive: {
		filtering: boolean;
		sorting: boolean;
		export: boolean;
		drillDown: boolean;
		refresh: boolean;
	};
}

export interface ReportColumn {
	field: string;
	header: string;
	type: 'string' | 'number' | 'date' | 'boolean' | 'currency' | 'duration' | 'percentage';
	width?: number;
	alignment?: 'left' | 'center' | 'right';
	sortable?: boolean;
	filterable?: boolean;
	visible?: boolean;
	aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'none';
	format?: string;
	customRenderer?: string;
}

export interface ConditionalFormat {
	condition: string;
	style: {
		backgroundColor?: string;
		textColor?: string;
		fontWeight?: string;
		icon?: string;
	};
	priority: number;
}

export interface ReportSchedule {
	enabled: boolean;
	frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
	interval: number;
	daysOfWeek?: number[];
	dayOfMonth?: number;
	time: string; // HH:MM format
	timezone: string;
	recipients: ReportRecipient[];
	delivery: {
		method: 'email' | 'webhook' | 'ftp' | 'api';
		format: 'pdf' | 'excel' | 'csv' | 'json' | 'xml';
		compression?: 'none' | 'zip' | 'gzip';
		attachments?: boolean;
		embedInBody?: boolean;
	};
	lastRun?: Date;
	nextRun?: Date;
	runCount: number;
	enabled_during?: {
		startDate?: Date;
		endDate?: Date;
		businessHoursOnly?: boolean;
	};
}

export interface ReportRecipient {
	type: 'user' | 'group' | 'email' | 'webhook';
	identifier: string;
	name: string;
	preferences?: {
		format?: string;
		includeData?: boolean;
		includeCharts?: boolean;
		language?: string;
	};
}

export interface ReportPermissions {
	view: string[]; // User IDs or group names
	edit: string[];
	execute: string[];
	schedule: string[];
	export: string[];
	share: string[];
	isPublic: boolean;
	allowAnonymous: boolean;
}

export interface ReportExecution {
	executionId: string;
	reportId: string;
	parameters: Record<string, any>;
	startTime: Date;
	endTime?: Date;
	status: 'running' | 'completed' | 'failed' | 'cancelled';
	duration?: number;
	rowCount?: number;
	fileSize?: number;
	filePath?: string;
	errorMessage?: string;
	executedBy: string;
	cacheKey?: string;
	metadata: Record<string, any>;
}

export interface ReportData {
	executionId: string;
	reportId: string;
	data: any[];
	metadata: {
		totalRows: number;
		pageSize: number;
		currentPage: number;
		totalPages: number;
		executionTime: number;
		dataTimestamp: Date;
		filters: any[];
		groupBy: string[];
		sortBy: any[];
	};
	summary?: {
		totals: Record<string, number>;
		aggregations: Record<string, any>;
		insights: string[];
	};
	charts?: {
		chartId: string;
		type: string;
		data: any;
		config: any;
	}[];
}

export interface ReportTemplate {
	templateId: string;
	name: string;
	description: string;
	category: string;
	reportDefinition: Partial<ReportDefinition>;
	previewData?: any[];
	tags: string[];
	difficulty: 'basic' | 'intermediate' | 'advanced';
	estimatedExecutionTime: number;
	requiredPermissions: string[];
	isBuiltIn: boolean;
	createdAt: Date;
}

export interface ReportDashboard {
	dashboardId: string;
	name: string;
	description: string;
	layout: DashboardLayout;
	widgets: DashboardWidget[];
	filters: DashboardFilter[];
	refreshInterval?: number;
	permissions: ReportPermissions;
	createdBy: string;
	createdAt: Date;
	lastModified: Date;
}

export interface DashboardLayout {
	type: 'grid' | 'flex' | 'custom';
	columns: number;
	rows: number;
	gap: number;
	responsive: boolean;
}

export interface DashboardWidget {
	widgetId: string;
	reportId: string;
	title: string;
	position: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	visualization: ReportVisualization;
	parameters?: Record<string, any>;
	refreshInterval?: number;
	autoRefresh: boolean;
}

export interface DashboardFilter {
	filterId: string;
	name: string;
	type: 'date_range' | 'dropdown' | 'multiselect' | 'text' | 'number_range';
	affectedWidgets: string[];
	defaultValue?: any;
	required: boolean;
}

export interface ExportOptions {
	format: 'pdf' | 'excel' | 'csv' | 'json' | 'xml' | 'html';
	compression?: 'none' | 'zip' | 'gzip';
	encryption?: {
		enabled: boolean;
		password?: string;
		algorithm?: string;
	};
	layout?: {
		orientation: 'portrait' | 'landscape';
		paperSize: 'A4' | 'A3' | 'Letter' | 'Legal';
		margins: {
			top: number;
			bottom: number;
			left: number;
			right: number;
		};
	};
	branding?: {
		logo?: string;
		companyName?: string;
		footer?: string;
		watermark?: string;
	};
	content?: {
		includeCharts: boolean;
		includeData: boolean;
		includeSummary: boolean;
		includeMetadata: boolean;
		maxRows?: number;
	};
}

export class AdvancedReportingManager {
	private apiClient: ThreeCXAPIClient;
	private reportDefinitions = new Map<string, ReportDefinition>();
	private reportTemplates = new Map<string, ReportTemplate>();
	private reportExecutions = new Map<string, ReportExecution>();
	private dashboards = new Map<string, ReportDashboard>();
	private reportCache = new Map<string, { data: ReportData; timestamp: Date; ttl: number }>();
	private scheduleTimers = new Map<string, NodeJS.Timeout>();
	private executionCounter = 0;

	constructor(apiClient: ThreeCXAPIClient) {
		this.apiClient = apiClient;
		this.initializeBuiltInTemplates();
		this.startScheduleProcessor();
	}

	/**
	 * Create custom report definition
	 */
	async createReport(
		name: string,
		type: ReportDefinition['type'],
		category: string,
		createdBy: string,
		options: Partial<ReportDefinition> = {}
	): Promise<ReportDefinition> {
		const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		const reportDefinition: ReportDefinition = {
			reportId,
			name,
			description: options.description || '',
			type,
			category: category as any,
			parameters: options.parameters || [],
			filters: options.filters || [],
			groupBy: options.groupBy || [],
			sortBy: options.sortBy || [],
			visualization: options.visualization || this.getDefaultVisualization(type),
			schedule: options.schedule,
			permissions: options.permissions || this.getDefaultPermissions(createdBy),
			createdBy,
			createdAt: new Date(),
			lastModified: new Date(),
			isActive: true,
			metadata: options.metadata || {},
		};

		this.reportDefinitions.set(reportId, reportDefinition);

		// Set up schedule if enabled
		if (reportDefinition.schedule?.enabled) {
			this.scheduleReport(reportDefinition);
		}

		return reportDefinition;
	}

	/**
	 * Execute report with parameters
	 */
	async executeReport(
		reportId: string,
		parameters: Record<string, any> = {},
		executedBy: string,
		options: {
			useCache?: boolean;
			cacheTTL?: number; // seconds
			async?: boolean;
		} = {}
	): Promise<ReportData | ReportExecution> {
		const reportDefinition = this.reportDefinitions.get(reportId);
		if (!reportDefinition) {
			throw new Error(`Report ${reportId} not found`);
		}

		if (!reportDefinition.isActive) {
			throw new Error(`Report ${reportId} is not active`);
		}

		// Check permissions
		if (!this.hasPermission(reportDefinition.permissions, 'execute', executedBy)) {
			throw new Error('Insufficient permissions to execute report');
		}

		// Validate parameters
		this.validateParameters(reportDefinition.parameters, parameters);

		// Check cache if enabled
		if (options.useCache) {
			const cacheKey = this.generateCacheKey(reportId, parameters);
			const cached = this.reportCache.get(cacheKey);
			if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl * 1000) {
				return cached.data;
			}
		}

		const executionId = `exec-${++this.executionCounter}-${Date.now()}`;
		const execution: ReportExecution = {
			executionId,
			reportId,
			parameters,
			startTime: new Date(),
			status: 'running',
			executedBy,
			metadata: {},
		};

		this.reportExecutions.set(executionId, execution);

		if (options.async) {
			// Start async execution
			this.executeReportAsync(execution, reportDefinition);
			return execution;
		} else {
			// Execute synchronously
			return await this.executeReportSync(execution, reportDefinition, options);
		}
	}

	/**
	 * Execute report synchronously
	 */
	private async executeReportSync(
		execution: ReportExecution,
		reportDefinition: ReportDefinition,
		options: any
	): Promise<ReportData> {
		try {
			const startTime = Date.now();

			// Build and execute query based on report type
			let data: any[] = [];
			let metadata: any = {};

			switch (reportDefinition.type) {
				case 'call_summary':
					data = await this.executeCallSummaryReport(reportDefinition, execution.parameters);
					break;
				case 'agent_performance':
					data = await this.executeAgentPerformanceReport(reportDefinition, execution.parameters);
					break;
				case 'queue_statistics':
					data = await this.executeQueueStatisticsReport(reportDefinition, execution.parameters);
					break;
				case 'custom_sql':
					data = await this.executeCustomSQLReport(reportDefinition, execution.parameters);
					break;
				case 'real_time_dashboard':
					data = await this.executeRealTimeDashboard(reportDefinition, execution.parameters);
					break;
			}

			// Apply filters
			data = this.applyFilters(data, reportDefinition.filters, execution.parameters);

			// Apply grouping
			if (reportDefinition.groupBy.length > 0) {
				data = this.applyGrouping(data, reportDefinition.groupBy);
			}

			// Apply sorting
			if (reportDefinition.sortBy.length > 0) {
				data = this.applySorting(data, reportDefinition.sortBy);
			}

			// Calculate summary
			const summary = this.calculateSummary(data, reportDefinition);

			// Generate charts if needed
			const charts = this.generateCharts(data, reportDefinition.visualization);

			const executionTime = Date.now() - startTime;

			// Update execution
			execution.endTime = new Date();
			execution.status = 'completed';
			execution.duration = executionTime;
			execution.rowCount = data.length;

			const reportData: ReportData = {
				executionId: execution.executionId,
				reportId: reportDefinition.reportId,
				data,
				metadata: {
					totalRows: data.length,
					pageSize: 1000, // Default page size
					currentPage: 1,
					totalPages: Math.ceil(data.length / 1000),
					executionTime,
					dataTimestamp: new Date(),
					filters: reportDefinition.filters,
					groupBy: reportDefinition.groupBy,
					sortBy: reportDefinition.sortBy,
				},
				summary,
				charts,
			};

			// Cache if enabled
			if (options.useCache) {
				const cacheKey = this.generateCacheKey(reportDefinition.reportId, execution.parameters);
				this.reportCache.set(cacheKey, {
					data: reportData,
					timestamp: new Date(),
					ttl: options.cacheTTL || 300, // 5 minutes default
				});
			}

			return reportData;

		} catch (error) {
			execution.endTime = new Date();
			execution.status = 'failed';
			execution.errorMessage = error instanceof Error ? error.message : 'Unknown error';
			execution.duration = Date.now() - execution.startTime.getTime();
			
			throw error;
		}
	}

	/**
	 * Execute call summary report
	 */
	private async executeCallSummaryReport(
		reportDefinition: ReportDefinition,
		parameters: Record<string, any>
	): Promise<any[]> {
		const filter: CallHistoryFilter = {
			startDate: parameters.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
			endDate: parameters.endDate || new Date(),
			extension: parameters.extension,
			direction: parameters.direction,
			limit: parameters.limit || 10000,
		};

		const response = await this.apiClient.request('/reports/call-summary', {
			method: 'POST',
			body: { filter, parameters },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to execute call summary report');
		}

		return response.data?.calls || [];
	}

	/**
	 * Execute agent performance report
	 */
	private async executeAgentPerformanceReport(
		reportDefinition: ReportDefinition,
		parameters: Record<string, any>
	): Promise<any[]> {
		const response = await this.apiClient.request('/reports/agent-performance', {
			method: 'POST',
			body: { parameters },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to execute agent performance report');
		}

		return response.data?.agents || [];
	}

	/**
	 * Execute queue statistics report
	 */
	private async executeQueueStatisticsReport(
		reportDefinition: ReportDefinition,
		parameters: Record<string, any>
	): Promise<any[]> {
		const response = await this.apiClient.request('/reports/queue-statistics', {
			method: 'POST',
			body: { parameters },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to execute queue statistics report');
		}

		return response.data?.queues || [];
	}

	/**
	 * Execute custom SQL report
	 */
	private async executeCustomSQLReport(
		reportDefinition: ReportDefinition,
		parameters: Record<string, any>
	): Promise<any[]> {
		// Security: Only allowed for users with special permissions
		if (!reportDefinition.metadata.allowCustomSQL) {
			throw new Error('Custom SQL reports are not enabled');
		}

		const response = await this.apiClient.request('/reports/custom-sql', {
			method: 'POST',
			body: {
				sql: reportDefinition.metadata.sqlQuery,
				parameters,
			},
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to execute custom SQL report');
		}

		return response.data?.rows || [];
	}

	/**
	 * Execute real-time dashboard report
	 */
	private async executeRealTimeDashboard(
		reportDefinition: ReportDefinition,
		parameters: Record<string, any>
	): Promise<any[]> {
		const response = await this.apiClient.request('/reports/real-time-dashboard', {
			method: 'POST',
			body: { parameters },
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to execute real-time dashboard');
		}

		return response.data?.widgets || [];
	}

	/**
	 * Export report to various formats
	 */
	async exportReport(
		reportData: ReportData,
		options: ExportOptions,
		exportedBy: string
	): Promise<{ filePath: string; fileSize: number; mimeType: string }> {
		const reportDefinition = this.reportDefinitions.get(reportData.reportId);
		if (!reportDefinition) {
			throw new Error(`Report ${reportData.reportId} not found`);
		}

		// Check permissions
		if (!this.hasPermission(reportDefinition.permissions, 'export', exportedBy)) {
			throw new Error('Insufficient permissions to export report');
		}

		const response = await this.apiClient.request('/reports/export', {
			method: 'POST',
			body: {
				execution_id: reportData.executionId,
				format: options.format,
				options,
			},
			timeout: 120000, // 2 minutes for export
		});

		if (!response.success) {
			throw new Error(response.error?.message || 'Failed to export report');
		}

		return {
			filePath: response.data?.file_path || '',
			fileSize: response.data?.file_size || 0,
			mimeType: response.data?.mime_type || '',
		};
	}

	/**
	 * Create dashboard
	 */
	async createDashboard(
		name: string,
		description: string,
		createdBy: string,
		options: Partial<ReportDashboard> = {}
	): Promise<ReportDashboard> {
		const dashboardId = `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		const dashboard: ReportDashboard = {
			dashboardId,
			name,
			description,
			layout: options.layout || { type: 'grid', columns: 12, rows: 8, gap: 16, responsive: true },
			widgets: options.widgets || [],
			filters: options.filters || [],
			refreshInterval: options.refreshInterval,
			permissions: options.permissions || this.getDefaultPermissions(createdBy),
			createdBy,
			createdAt: new Date(),
			lastModified: new Date(),
		};

		this.dashboards.set(dashboardId, dashboard);

		return dashboard;
	}

	/**
	 * Helper methods
	 */
	private validateParameters(parameterDefs: ReportParameter[], parameters: Record<string, any>): void {
		for (const paramDef of parameterDefs) {
			if (paramDef.required && !(paramDef.name in parameters)) {
				throw new Error(`Required parameter '${paramDef.name}' is missing`);
			}

			const value = parameters[paramDef.name];
			if (value !== undefined && paramDef.validation) {
				// Validate based on parameter type and constraints
				if (paramDef.type === 'number') {
					if (paramDef.validation.min !== undefined && value < paramDef.validation.min) {
						throw new Error(`Parameter '${paramDef.name}' must be at least ${paramDef.validation.min}`);
					}
					if (paramDef.validation.max !== undefined && value > paramDef.validation.max) {
						throw new Error(`Parameter '${paramDef.name}' must be at most ${paramDef.validation.max}`);
					}
				}
				if (paramDef.type === 'string' && paramDef.validation.pattern) {
					const regex = new RegExp(paramDef.validation.pattern);
					if (!regex.test(value)) {
						throw new Error(`Parameter '${paramDef.name}' does not match required pattern`);
					}
				}
			}
		}
	}

	private applyFilters(data: any[], filters: AdvancedReportFilter[], parameters: Record<string, any>): any[] {
		return data.filter(row => {
			for (const filter of filters) {
				const fieldValue = this.getFieldValue(row, filter.field);
				const filterValue = this.resolveFilterValue(filter.value, parameters);
				
				if (!this.evaluateFilterCondition(fieldValue, filter.operator, filterValue, filter)) {
					return false;
				}
			}
			return true;
		});
	}

	private applyGrouping(data: any[], groupBy: string[]): any[] {
		// Implement grouping logic
		const groups = new Map<string, any[]>();
		
		for (const row of data) {
			const groupKey = groupBy.map(field => this.getFieldValue(row, field)).join('|');
			if (!groups.has(groupKey)) {
				groups.set(groupKey, []);
			}
			groups.get(groupKey)!.push(row);
		}

		// Convert to grouped format
		const result: any[] = [];
		for (const [groupKey, groupRows] of groups) {
			const groupValues = groupKey.split('|');
			const groupData: any = {};
			
			groupBy.forEach((field, index) => {
				groupData[field] = groupValues[index];
			});
			
			groupData._group = true;
			groupData._children = groupRows;
			groupData._count = groupRows.length;
			
			result.push(groupData);
		}

		return result;
	}

	private applySorting(data: any[], sortBy: ReportSortCriteria[]): any[] {
		return data.sort((a, b) => {
			for (const sort of sortBy) {
				const aValue = this.getFieldValue(a, sort.field);
				const bValue = this.getFieldValue(b, sort.field);
				
				let comparison = 0;
				if (aValue < bValue) comparison = -1;
				if (aValue > bValue) comparison = 1;
				
				if (sort.direction === 'desc') comparison *= -1;
				
				if (comparison !== 0) return comparison;
			}
			return 0;
		});
	}

	private calculateSummary(data: any[], reportDefinition: ReportDefinition): any {
		const summary: any = {
			totals: {},
			aggregations: {},
			insights: [],
		};

		// Calculate totals for numeric fields
		if (reportDefinition.visualization.layout.totals?.enabled) {
			const fields = reportDefinition.visualization.layout.totals.fields;
			for (const field of fields) {
				const values = data.map(row => this.getFieldValue(row, field)).filter(v => typeof v === 'number');
				if (values.length > 0) {
					summary.totals[field] = {
						sum: values.reduce((a, b) => a + b, 0),
						avg: values.reduce((a, b) => a + b, 0) / values.length,
						min: Math.min(...values),
						max: Math.max(...values),
						count: values.length,
					};
				}
			}
		}

		return summary;
	}

	private generateCharts(data: any[], visualization: ReportVisualization): any[] {
		if (visualization.type !== 'chart' || !visualization.chartType) {
			return [];
		}

		// Generate chart data based on chart type
		const charts = [];
		
		// This is a simplified implementation
		const chartData = {
			chartId: `chart-${Date.now()}`,
			type: visualization.chartType,
			data: data.slice(0, 100), // Limit data for charts
			config: {
				responsive: true,
				maintainAspectRatio: false,
			},
		};

		charts.push(chartData);
		return charts;
	}

	private getFieldValue(object: any, fieldPath: string): any {
		const paths = fieldPath.split('.');
		let value = object;
		
		for (const path of paths) {
			if (value && typeof value === 'object' && path in value) {
				value = value[path];
			} else {
				return undefined;
			}
		}
		
		return value;
	}

	private resolveFilterValue(value: any, parameters: Record<string, any>): any {
		if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
			const paramName = value.slice(2, -1);
			return parameters[paramName];
		}
		return value;
	}

	private evaluateFilterCondition(fieldValue: any, operator: string, filterValue: any, filter: AdvancedReportFilter): boolean {
		switch (operator) {
			case 'equals':
				return fieldValue === filterValue;
			case 'not_equals':
				return fieldValue !== filterValue;
			case 'contains':
				return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
			case 'not_contains':
				return !String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
			case 'starts_with':
				return String(fieldValue).toLowerCase().startsWith(String(filterValue).toLowerCase());
			case 'ends_with':
				return String(fieldValue).toLowerCase().endsWith(String(filterValue).toLowerCase());
			case 'greater_than':
				return Number(fieldValue) > Number(filterValue);
			case 'less_than':
				return Number(fieldValue) < Number(filterValue);
			case 'between':
				const [min, max] = Array.isArray(filterValue) ? filterValue : [filterValue, filterValue];
				return Number(fieldValue) >= Number(min) && Number(fieldValue) <= Number(max);
			case 'in':
				return Array.isArray(filterValue) && filterValue.includes(fieldValue);
			case 'not_in':
				return Array.isArray(filterValue) && !filterValue.includes(fieldValue);
			case 'is_null':
				return fieldValue == null;
			case 'is_not_null':
				return fieldValue != null;
			case 'regex':
				const regex = new RegExp(filterValue, filter.caseSensitive ? '' : 'i');
				return regex.test(String(fieldValue));
			default:
				return true;
		}
	}

	private generateCacheKey(reportId: string, parameters: Record<string, any>): string {
		const sortedParams = Object.keys(parameters).sort().reduce((obj: any, key) => {
			obj[key] = parameters[key];
			return obj;
		}, {});
		return `${reportId}:${JSON.stringify(sortedParams)}`;
	}

	private hasPermission(permissions: ReportPermissions, action: string, userId: string): boolean {
		if (permissions.isPublic || permissions.allowAnonymous) return true;
		
		const actionPermissions = (permissions as any)[action] || [];
		return actionPermissions.includes(userId) || actionPermissions.includes('*');
	}

	private getDefaultVisualization(type: ReportDefinition['type']): ReportVisualization {
		return {
			type: 'table',
			layout: {
				columns: [],
				pagination: { enabled: true, pageSize: 50, allowSizeChange: true },
			},
			formatting: {
				numberFormat: '#,##0.00',
				dateFormat: 'YYYY-MM-DD HH:mm:ss',
			},
			interactive: {
				filtering: true,
				sorting: true,
				export: true,
				drillDown: false,
				refresh: true,
			},
		};
	}

	private getDefaultPermissions(createdBy: string): ReportPermissions {
		return {
			view: [createdBy, '*'],
			edit: [createdBy],
			execute: [createdBy, '*'],
			schedule: [createdBy],
			export: [createdBy, '*'],
			share: [createdBy],
			isPublic: false,
			allowAnonymous: false,
		};
	}

	private async executeReportAsync(execution: ReportExecution, reportDefinition: ReportDefinition): Promise<void> {
		// Implement async execution logic here
		// This would typically involve queuing the execution and processing it in the background
	}

	private scheduleReport(reportDefinition: ReportDefinition): void {
		if (!reportDefinition.schedule?.enabled) return;

		// Calculate next run time and set timer
		const nextRun = this.calculateNextRun(reportDefinition.schedule);
		const delay = nextRun.getTime() - Date.now();

		if (delay > 0) {
			const timer = setTimeout(async () => {
				try {
					await this.executeScheduledReport(reportDefinition);
				} catch (error) {
					console.error(`Scheduled report execution failed for ${reportDefinition.reportId}:`, error);
				}
				
				// Schedule next run
				this.scheduleReport(reportDefinition);
			}, delay);

			this.scheduleTimers.set(reportDefinition.reportId, timer);
		}
	}

	private calculateNextRun(schedule: ReportSchedule): Date {
		// Implement schedule calculation logic
		const now = new Date();
		const nextRun = new Date(now);
		
		switch (schedule.frequency) {
			case 'daily':
				nextRun.setDate(nextRun.getDate() + schedule.interval);
				break;
			case 'weekly':
				nextRun.setDate(nextRun.getDate() + (schedule.interval * 7));
				break;
			case 'monthly':
				nextRun.setMonth(nextRun.getMonth() + schedule.interval);
				break;
			// Add more frequency calculations
		}

		return nextRun;
	}

	private async executeScheduledReport(reportDefinition: ReportDefinition): Promise<void> {
		// Execute the report and send to recipients
		const reportData = await this.executeReport(reportDefinition.reportId, {}, 'system', { async: false }) as ReportData;
		
		// Send to recipients based on schedule delivery settings
		if (reportDefinition.schedule?.recipients) {
			for (const recipient of reportDefinition.schedule.recipients) {
				await this.deliverReportToRecipient(reportData, recipient, reportDefinition.schedule.delivery);
			}
		}
	}

	private async deliverReportToRecipient(reportData: ReportData, recipient: ReportRecipient, delivery: any): Promise<void> {
		// Implement delivery logic (email, webhook, etc.)
	}

	private startScheduleProcessor(): void {
		// Start background processor for scheduled reports
		setInterval(() => {
			// Process any pending scheduled reports
		}, 60000); // Check every minute
	}

	private initializeBuiltInTemplates(): void {
		const templates: ReportTemplate[] = [
			{
				templateId: 'call_summary_basic',
				name: 'Basic Call Summary',
				description: 'Simple call summary with basic metrics',
				category: 'operational',
				reportDefinition: {
					type: 'call_summary',
					parameters: [
						{
							name: 'startDate',
							type: 'date',
							label: 'Start Date',
							description: 'Report start date',
							required: true,
						},
						{
							name: 'endDate',
							type: 'date',
							label: 'End Date',
							description: 'Report end date',
							required: true,
						},
					],
					filters: [],
					groupBy: [],
					sortBy: [{ field: 'startTime', direction: 'desc', priority: 1 }],
				},
				tags: ['calls', 'summary', 'basic'],
				difficulty: 'basic',
				estimatedExecutionTime: 30,
				requiredPermissions: ['view_calls'],
				isBuiltIn: true,
				createdAt: new Date(),
			},
			// Add more built-in templates
		];

		templates.forEach(template => {
			this.reportTemplates.set(template.templateId, template);
		});
	}

	/**
	 * Get report definition
	 */
	getReportDefinition(reportId: string): ReportDefinition | undefined {
		return this.reportDefinitions.get(reportId);
	}

	/**
	 * List all reports
	 */
	getReports(): ReportDefinition[] {
		return Array.from(this.reportDefinitions.values());
	}

	/**
	 * Get report templates
	 */
	getReportTemplates(): ReportTemplate[] {
		return Array.from(this.reportTemplates.values());
	}

	/**
	 * Get dashboard
	 */
	getDashboard(dashboardId: string): ReportDashboard | undefined {
		return this.dashboards.get(dashboardId);
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		// Clear all timers
		for (const timer of this.scheduleTimers.values()) {
			clearTimeout(timer);
		}

		// Clear data
		this.reportDefinitions.clear();
		this.reportTemplates.clear();
		this.reportExecutions.clear();
		this.dashboards.clear();
		this.reportCache.clear();
		this.scheduleTimers.clear();
	}
}

/**
 * Factory function to create advanced reporting manager
 */
export function createAdvancedReportingManager(apiClient: ThreeCXAPIClient): AdvancedReportingManager {
	return new AdvancedReportingManager(apiClient);
}