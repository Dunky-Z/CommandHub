import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as os from 'os';
import { configManager } from './configuration';

export interface AnalyticsEvent {
    eventName: string;
    properties?: Record<string, any>;
    measurements?: Record<string, number>;
    timestamp?: Date;
}

export type EventProcessor = (event: AnalyticsEvent) => Promise<void>;

export class AnalyticsService {
    private static instance: AnalyticsService;
    private anonymousId: string;
    private sessionId: string;
    private eventProcessors: EventProcessor[] = [];
    private telemetryEnabled: boolean = false;
    private extensionVersion: string = '';
    private extensionId: string = 'CommandHub';
    private queue: AnalyticsEvent[] = [];
    private isProcessingQueue: boolean = false;
    private context?: vscode.ExtensionContext;
    private startTime: Date;

    private constructor() {
        this.anonymousId = this.generateAnonymousId();
        this.sessionId = this.generateSessionId();
        this.startTime = new Date();
    }

    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }

    public initialize(context: vscode.ExtensionContext, version: string): void {
        this.context = context;
        this.extensionVersion = version;
        this.telemetryEnabled = configManager.get<boolean>('enableTelemetry', false);

        // Register configuration change handler
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('CommandHub.enableTelemetry')) {
                    this.telemetryEnabled = configManager.get<boolean>('enableTelemetry', false);
                }
            })
        );

        // Start session
        if (this.telemetryEnabled) {
            this.trackEvent('session_start');
        }
    }

    public async trackEvent(eventName: string, properties?: Record<string, any>, measurements?: Record<string, number>): Promise<void> {
        if (!this.telemetryEnabled) {
            return;
        }

        const event: AnalyticsEvent = {
            eventName,
            properties: {
                ...properties,
                extensionVersion: this.extensionVersion,
                platform: process.platform,
                platformVersion: os.release(),
                nodeVersion: process.version,
                sessionId: this.sessionId
            },
            measurements,
            timestamp: new Date()
        };

        this.queue.push(event);
        this.processQueue();
    }

    public trackCommandExecution(commandId: string, durationMs?: number): void {
        this.trackEvent('command_executed', {
            commandId
        }, durationMs ? { durationMs } : undefined);
    }

    public trackError(errorName: string, errorMessage: string, errorStack?: string): void {
        this.trackEvent('error', {
            errorName,
            errorMessage,
            errorStack
        });
    }

    public trackFeatureUsage(featureName: string): void {
        this.trackEvent('feature_used', {
            featureName
        });
    }

    public registerEventProcessor(processor: EventProcessor): void {
        this.eventProcessors.push(processor);
    }

    public async endSession(): Promise<void> {
        if (!this.telemetryEnabled) {
            return;
        }

        const sessionDurationMs = new Date().getTime() - this.startTime.getTime();
        await this.trackEvent('session_end', undefined, { sessionDurationMs });
        
        // Make sure all events are processed
        await this.flushQueue();
    }

    public async flushQueue(): Promise<void> {
        if (this.queue.length === 0) {
            return;
        }

        // Process all events in the queue
        this.isProcessingQueue = true;
        const queue = [...this.queue];
        this.queue = [];

        for (const event of queue) {
            await this.processEvent(event);
        }

        this.isProcessingQueue = false;

        // If new events were added during processing, process them too
        if (this.queue.length > 0) {
            await this.flushQueue();
        }
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.queue.length > 0) {
            const event = this.queue.shift();
            if (event) {
                await this.processEvent(event);
            }
        }

        this.isProcessingQueue = false;
    }

    private async processEvent(event: AnalyticsEvent): Promise<void> {
        for (const processor of this.eventProcessors) {
            try {
                await processor(event);
            } catch (error) {
                // Ignore processor errors
                console.error('Error processing analytics event:', error);
            }
        }
    }

    private generateAnonymousId(): string {
        const hostname = os.hostname();
        const username = os.userInfo().username;
        const machineId = crypto.createHash('sha256')
            .update(hostname + username + this.extensionId)
            .digest('hex');
        return machineId;
    }

    private generateSessionId(): string {
        return crypto.randomBytes(16).toString('hex');
    }
}

export const analyticsService = AnalyticsService.getInstance();

export class ConsoleEventProcessor implements EventProcessor {
    async process(event: AnalyticsEvent): Promise<void> {
        console.log(`[Analytics] ${event.eventName}`, event.properties, event.measurements);
    }
}

export class FileEventProcessor implements EventProcessor {
    private filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    async process(event: AnalyticsEvent): Promise<void> {
        const fs = await import('fs');
        const eventString = JSON.stringify({
            ...event,
            timestamp: event.timestamp?.toISOString()
        }) + '\n';

        try {
            fs.appendFileSync(this.filePath, eventString);
        } catch (error) {
            console.error('Failed to write analytics event to file:', error);
        }
    }
}

export class HttpEventProcessor implements EventProcessor {
    private endpoint: string;
    private apiKey: string;

    constructor(endpoint: string, apiKey: string) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
    }

    async process(event: AnalyticsEvent): Promise<void> {
        try {
            const https = await import('https');
            const url = new URL(this.endpoint);
            
            const data = JSON.stringify({
                ...event,
                timestamp: event.timestamp?.toISOString()
            });

            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'Authorization': `Bearer ${this.apiKey}`
                }
            };

            return new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    res.on('data', () => {});
                    res.on('end', () => {
                        resolve();
                    });
                });

                req.on('error', (error) => {
                    console.error('Error sending analytics event:', error);
                    resolve(); // Resolve anyway to continue processing
                });

                req.write(data);
                req.end();
            });
        } catch (error) {
            console.error('Failed to send analytics event:', error);
        }
    }
}

export function initializeAnalytics(context: vscode.ExtensionContext, version: string): void {
    const service = analyticsService;
    service.initialize(context, version);

    // Add processors based on configuration
    if (configManager.get<boolean>('enableTelemetryLogging', false)) {
        service.registerEventProcessor(async (event) => {
            const processor = new ConsoleEventProcessor();
            await processor.process(event);
        });
    }

    // Cleanup on deactivation
    context.subscriptions.push({
        dispose: () => {
            service.endSession();
        }
    });
} 