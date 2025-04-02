import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

export interface LoggerOptions {
    level?: LogLevel;
    name?: string;
    outputChannel?: vscode.OutputChannel;
}

export class Logger {
    private static instances: Map<string, Logger> = new Map();
    private level: LogLevel;
    private name: string;
    private outputChannel?: vscode.OutputChannel;
    private static globalLevel: LogLevel = LogLevel.INFO;

    private constructor(options: LoggerOptions = {}) {
        this.level = options.level ?? Logger.globalLevel;
        this.name = options.name ?? 'CommandHub';
        this.outputChannel = options.outputChannel;
    }

    public static getLogger(name: string, options: Omit<LoggerOptions, 'name'> = {}): Logger {
        let instance = Logger.instances.get(name);
        if (!instance) {
            instance = new Logger({
                ...options,
                name
            });
            Logger.instances.set(name, instance);
        }
        return instance;
    }

    public static setGlobalLogLevel(level: LogLevel): void {
        Logger.globalLevel = level;
    }

    public setLevel(level: LogLevel): void {
        this.level = level;
    }

    public setOutputChannel(channel: vscode.OutputChannel): void {
        this.outputChannel = channel;
    }

    public debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    public info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    public warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    public error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, message, ...args);
    }

    public log(level: LogLevel, message: string, ...args: any[]): void {
        if (level < this.level) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelStr = LogLevel[level].padEnd(5);
        let formattedMessage = `[${timestamp}] [${levelStr}] [${this.name}] ${message}`;

        if (args.length > 0) {
            formattedMessage += ' ' + args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');
        }

        if (this.outputChannel) {
            this.outputChannel.appendLine(formattedMessage);
        } else {
            switch (level) {
                case LogLevel.DEBUG:
                case LogLevel.INFO:
                    console.log(formattedMessage);
                    break;
                case LogLevel.WARN:
                    console.warn(formattedMessage);
                    break;
                case LogLevel.ERROR:
                    console.error(formattedMessage);
                    break;
            }
        }
    }

    public createChildLogger(name: string): Logger {
        const childName = `${this.name}:${name}`;
        return Logger.getLogger(childName, {
            level: this.level,
            outputChannel: this.outputChannel
        });
    }

    public static createOutputChannel(channelName: string = 'CommandHub'): vscode.OutputChannel {
        return vscode.window.createOutputChannel(channelName);
    }

    public static getAllLoggers(): Logger[] {
        return Array.from(Logger.instances.values());
    }

    public static configureAllLoggers(options: LoggerOptions): void {
        Logger.instances.forEach(logger => {
            if (options.level !== undefined) {
                logger.setLevel(options.level);
            }
            if (options.outputChannel) {
                logger.setOutputChannel(options.outputChannel);
            }
        });
    }
}

export function formatError(error: any): string {
    if (error instanceof Error) {
        let result = `${error.name}: ${error.message}`;
        if (error.stack) {
            result += `\nStack: ${error.stack}`;
        }
        return result;
    }
    
    try {
        return JSON.stringify(error, null, 2);
    } catch {
        return String(error);
    }
}

export function createLoggerForExtension(context: vscode.ExtensionContext): Logger {
    const channel = vscode.window.createOutputChannel('CommandHub');
    context.subscriptions.push(channel);
    
    const logger = Logger.getLogger('extension');
    logger.setOutputChannel(channel);
    
    return logger;
}

export const rootLogger = Logger.getLogger('root'); 