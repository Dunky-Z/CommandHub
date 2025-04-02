import * as vscode from 'vscode';

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: Map<string, PerformanceMetric> = new Map();
    private enabled: boolean = false;

    private constructor() {}

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    public enable(): void {
        this.enabled = true;
    }

    public disable(): void {
        this.enabled = false;
    }

    public startMeasure(id: string): void {
        if (!this.enabled) {
            return;
        }
        const metric = this.getOrCreateMetric(id);
        metric.startTime = process.hrtime();
        metric.running = true;
    }

    public endMeasure(id: string): number {
        if (!this.enabled) {
            return 0;
        }
        
        const metric = this.metrics.get(id);
        if (!metric || !metric.running || !metric.startTime) {
            return 0;
        }

        const elapsed = process.hrtime(metric.startTime);
        const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
        
        metric.running = false;
        metric.lastDuration = elapsedMs;
        metric.totalDuration += elapsedMs;
        metric.callCount++;
        
        return elapsedMs;
    }

    public getMetricSummary(id: string): PerformanceMetricSummary | undefined {
        const metric = this.metrics.get(id);
        if (!metric) {
            return undefined;
        }

        return {
            id,
            callCount: metric.callCount,
            totalDuration: metric.totalDuration,
            lastDuration: metric.lastDuration,
            averageDuration: metric.callCount > 0 ? metric.totalDuration / metric.callCount : 0
        };
    }

    public getAllMetricsSummary(): PerformanceMetricSummary[] {
        const result: PerformanceMetricSummary[] = [];
        this.metrics.forEach((metric, id) => {
            result.push({
                id,
                callCount: metric.callCount,
                totalDuration: metric.totalDuration,
                lastDuration: metric.lastDuration,
                averageDuration: metric.callCount > 0 ? metric.totalDuration / metric.callCount : 0
            });
        });
        return result;
    }

    public clearMetrics(): void {
        this.metrics.clear();
    }

    public resetMetric(id: string): void {
        const metric = this.metrics.get(id);
        if (metric) {
            metric.callCount = 0;
            metric.totalDuration = 0;
            metric.lastDuration = 0;
            metric.running = false;
        }
    }

    public measureAsync<T>(id: string, asyncFn: () => Promise<T>): Promise<T> {
        if (!this.enabled) {
            return asyncFn();
        }

        this.startMeasure(id);
        return asyncFn().finally(() => {
            this.endMeasure(id);
        });
    }

    public measureFunction<T>(id: string, fn: () => T): T {
        if (!this.enabled) {
            return fn();
        }

        this.startMeasure(id);
        try {
            return fn();
        } finally {
            this.endMeasure(id);
        }
    }

    public logMetricToOutput(id: string, channel?: vscode.OutputChannel): void {
        if (!this.enabled) {
            return;
        }

        const summary = this.getMetricSummary(id);
        if (!summary) {
            return;
        }

        const message = `Performance [${id}]: ${summary.lastDuration.toFixed(2)}ms (Avg: ${summary.averageDuration.toFixed(2)}ms, Total: ${summary.totalDuration.toFixed(2)}ms, Calls: ${summary.callCount})`;
        
        if (channel) {
            channel.appendLine(message);
        } else {
            console.log(message);
        }
    }

    private getOrCreateMetric(id: string): PerformanceMetric {
        let metric = this.metrics.get(id);
        if (!metric) {
            metric = {
                callCount: 0,
                totalDuration: 0,
                lastDuration: 0,
                running: false
            };
            this.metrics.set(id, metric);
        }
        return metric;
    }
}

export interface PerformanceMetric {
    startTime?: [number, number];
    callCount: number;
    totalDuration: number;
    lastDuration: number;
    running: boolean;
}

export interface PerformanceMetricSummary {
    id: string;
    callCount: number;
    totalDuration: number;
    lastDuration: number;
    averageDuration: number;
}

export function measureExecutionTime<T>(fn: () => T, label?: string): T {
    const start = process.hrtime();
    const result = fn();
    const elapsed = process.hrtime(start);
    const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
    
    if (label) {
        console.log(`${label}: ${elapsedMs.toFixed(2)}ms`);
    }
    
    return result;
}

export function measureAsyncExecutionTime<T>(fn: () => Promise<T>, label?: string): Promise<T> {
    const start = process.hrtime();
    
    return fn().then(result => {
        const elapsed = process.hrtime(start);
        const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
        
        if (label) {
            console.log(`${label}: ${elapsedMs.toFixed(2)}ms`);
        }
        
        return result;
    });
}

export const performanceMonitor = PerformanceMonitor.getInstance(); 