import * as vscode from 'vscode';

export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private extensionName: string;

    private constructor(extensionName: string) {
        this.extensionName = extensionName;
    }

    public static getInstance(extensionName: string = 'CommandHub'): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager(extensionName);
        }
        return ConfigurationManager.instance;
    }

    public get<T>(section: string, defaultValue?: T): T {
        const config = vscode.workspace.getConfiguration(this.extensionName);
        return config.get<T>(section, defaultValue as T);
    }

    public async update<T>(section: string, value: T, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.extensionName);
        await config.update(section, value, target);
    }

    public inspect<T>(section: string): vscode.ConfigurationInspection<T> | undefined {
        const config = vscode.workspace.getConfiguration(this.extensionName);
        return config.inspect<T>(section);
    }

    public getAllSettings(): Record<string, any> {
        const config = vscode.workspace.getConfiguration(this.extensionName);
        const result: Record<string, any> = {};
        
        for (const key of Object.keys(config)) {
            if (typeof key === 'string' && key !== 'has' && key !== 'get' && key !== 'update' && key !== 'inspect') {
                result[key] = config.get(key);
            }
        }
        
        return result;
    }

    public reset(section: string, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        return this.update(section, undefined, target);
    }

    public addEventListener(listener: (e: vscode.ConfigurationChangeEvent) => any, thisArg?: any): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(listener, thisArg);
    }

    public registerChangeHandler(section: string, handler: () => any): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            const fullSection = `${this.extensionName}.${section}`;
            if (e.affectsConfiguration(fullSection)) {
                handler();
            }
        });
    }

    public getDefaultSettings(): Record<string, any> {
        return {
            'terminalType': 'integrated',
            'autoCloseTerminal': true,
            'defaultShell': 'bash',
            'showStatusBarTerminal': true,
            'maxCommandHistoryItems': 50,
            'logLevel': 'info',
            'preserveCommandHistory': true,
            'autoSaveDelay': 1000,
            'autoImportCommandsFromClipboard': false,
            'enablePerformanceMonitoring': false,
            'syncWithGitRepo': false,
            'gitRepoUrl': '',
            'gitRepoUsername': '',
            'gitRepoPassword': '',
            'exportFormat': 'json',
            'exportIncludeMetadata': true,
            'customTerminalOptions': {},
            'showWelcomeOnStartup': true,
            'theme': 'system',
            'iconSet': 'default',
            'customCommandTemplate': '',
            'enableCommandTypeSuggestions': true,
            'performanceMonitoringThreshold': 500,
            'enableDetailedLogs': false,
            'openCommandFileOnCreation': true,
            'commandSortOrder': 'alphabetical'
        };
    }

    public async restoreDefaults(target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const defaults = this.getDefaultSettings();
        for (const [key, value] of Object.entries(defaults)) {
            await this.update(key, value, target);
        }
    }

    public hasSetting(section: string): boolean {
        const config = vscode.workspace.getConfiguration(this.extensionName);
        return config.has(section);
    }

    public getSettingsDefinition(): Array<{section: string, type: string, default: any, description: string}> {
        return [
            { section: 'terminalType', type: 'string', default: 'integrated', description: 'Type of terminal to use: integrated or external' },
            { section: 'autoCloseTerminal', type: 'boolean', default: true, description: 'Automatically close terminal after command execution' },
            { section: 'defaultShell', type: 'string', default: 'bash', description: 'Default shell to use for command execution' },
            { section: 'showStatusBarTerminal', type: 'boolean', default: true, description: 'Show terminal button in status bar' },
            { section: 'maxCommandHistoryItems', type: 'number', default: 50, description: 'Maximum number of commands to keep in history' },
            { section: 'logLevel', type: 'string', default: 'info', description: 'Log level: debug, info, warn, error, none' },
            { section: 'preserveCommandHistory', type: 'boolean', default: true, description: 'Preserve command history between sessions' },
            { section: 'autoSaveDelay', type: 'number', default: 1000, description: 'Delay in milliseconds before auto-saving commands' },
            { section: 'autoImportCommandsFromClipboard', type: 'boolean', default: false, description: 'Auto-import commands from clipboard' },
            { section: 'enablePerformanceMonitoring', type: 'boolean', default: false, description: 'Enable performance monitoring' },
            { section: 'syncWithGitRepo', type: 'boolean', default: false, description: 'Sync commands with Git repository' },
            { section: 'gitRepoUrl', type: 'string', default: '', description: 'Git repository URL for command sync' },
            { section: 'gitRepoUsername', type: 'string', default: '', description: 'Git repository username' },
            { section: 'gitRepoPassword', type: 'string', default: '', description: 'Git repository password (or token)' },
            { section: 'exportFormat', type: 'string', default: 'json', description: 'Format for command export: json or yaml' },
            { section: 'exportIncludeMetadata', type: 'boolean', default: true, description: 'Include metadata in command export' },
            { section: 'customTerminalOptions', type: 'object', default: {}, description: 'Custom options for terminal creation' },
            { section: 'showWelcomeOnStartup', type: 'boolean', default: true, description: 'Show welcome message on startup' },
            { section: 'theme', type: 'string', default: 'system', description: 'UI theme: system, light, or dark' },
            { section: 'iconSet', type: 'string', default: 'default', description: 'Icon set to use: default, minimal, or colorful' },
            { section: 'customCommandTemplate', type: 'string', default: '', description: 'Custom template for new commands' },
            { section: 'enableCommandTypeSuggestions', type: 'boolean', default: true, description: 'Enable command type suggestions' },
            { section: 'performanceMonitoringThreshold', type: 'number', default: 500, description: 'Threshold in ms for performance warnings' },
            { section: 'enableDetailedLogs', type: 'boolean', default: false, description: 'Enable detailed logs' },
            { section: 'openCommandFileOnCreation', type: 'boolean', default: true, description: 'Open command file when created' },
            { section: 'commandSortOrder', type: 'string', default: 'alphabetical', description: 'Command sort order: alphabetical, created, modified, or type' }
        ];
    }
}

export const configManager = ConfigurationManager.getInstance();

export interface IConfigSection {
    title: string;
    settings: Array<{
        id: string;
        title: string;
        description: string;
        type: 'string' | 'boolean' | 'number' | 'select' | 'object';
        default: any;
        options?: Array<{ value: any; label: string; }>;
    }>;
}

export function getConfigurationSections(): IConfigSection[] {
    return [
        {
            title: 'General',
            settings: [
                { id: 'theme', title: 'Theme', description: 'UI theme for the extension', type: 'select', default: 'system', 
                  options: [
                      { value: 'system', label: 'System Default' },
                      { value: 'light', label: 'Light Theme' },
                      { value: 'dark', label: 'Dark Theme' }
                  ]
                },
                { id: 'iconSet', title: 'Icon Set', description: 'Icon set to use for the extension', type: 'select', default: 'default',
                  options: [
                      { value: 'default', label: 'Default Icons' },
                      { value: 'minimal', label: 'Minimal Icons' },
                      { value: 'colorful', label: 'Colorful Icons' }
                  ]
                },
                { id: 'showWelcomeOnStartup', title: 'Show Welcome', description: 'Show welcome message on startup', type: 'boolean', default: true }
            ]
        },
        {
            title: 'Terminal',
            settings: [
                { id: 'terminalType', title: 'Terminal Type', description: 'Type of terminal to use for command execution', type: 'select', default: 'integrated',
                  options: [
                      { value: 'integrated', label: 'Integrated Terminal' },
                      { value: 'external', label: 'External Terminal' }
                  ]
                },
                { id: 'defaultShell', title: 'Default Shell', description: 'Default shell to use for command execution', type: 'string', default: 'bash' },
                { id: 'autoCloseTerminal', title: 'Auto Close Terminal', description: 'Automatically close terminal after command execution', type: 'boolean', default: true },
                { id: 'showStatusBarTerminal', title: 'Show Status Bar Terminal', description: 'Show terminal button in status bar', type: 'boolean', default: true },
                { id: 'customTerminalOptions', title: 'Custom Terminal Options', description: 'Custom options for terminal creation', type: 'object', default: {} }
            ]
        },
        {
            title: 'Commands',
            settings: [
                { id: 'maxCommandHistoryItems', title: 'Max History Items', description: 'Maximum number of commands to keep in history', type: 'number', default: 50 },
                { id: 'preserveCommandHistory', title: 'Preserve History', description: 'Preserve command history between sessions', type: 'boolean', default: true },
                { id: 'autoSaveDelay', title: 'Auto Save Delay', description: 'Delay in milliseconds before auto-saving commands', type: 'number', default: 1000 },
                { id: 'autoImportCommandsFromClipboard', title: 'Auto Import from Clipboard', description: 'Auto-import commands from clipboard', type: 'boolean', default: false },
                { id: 'customCommandTemplate', title: 'Command Template', description: 'Custom template for new commands', type: 'string', default: '' },
                { id: 'enableCommandTypeSuggestions', title: 'Command Type Suggestions', description: 'Enable command type suggestions', type: 'boolean', default: true },
                { id: 'openCommandFileOnCreation', title: 'Open on Creation', description: 'Open command file when created', type: 'boolean', default: true },
                { id: 'commandSortOrder', title: 'Sort Order', description: 'Command sort order', type: 'select', default: 'alphabetical',
                  options: [
                      { value: 'alphabetical', label: 'Alphabetical' },
                      { value: 'created', label: 'Creation Date' },
                      { value: 'modified', label: 'Modified Date' },
                      { value: 'type', label: 'Command Type' }
                  ]
                }
            ]
        },
        {
            title: 'Sync',
            settings: [
                { id: 'syncWithGitRepo', title: 'Sync with Git', description: 'Sync commands with Git repository', type: 'boolean', default: false },
                { id: 'gitRepoUrl', title: 'Git Repository URL', description: 'Git repository URL for command sync', type: 'string', default: '' },
                { id: 'gitRepoUsername', title: 'Git Username', description: 'Git repository username', type: 'string', default: '' },
                { id: 'gitRepoPassword', title: 'Git Password/Token', description: 'Git repository password (or token)', type: 'string', default: '' },
                { id: 'exportFormat', title: 'Export Format', description: 'Format for command export', type: 'select', default: 'json',
                  options: [
                      { value: 'json', label: 'JSON' },
                      { value: 'yaml', label: 'YAML' }
                  ]
                },
                { id: 'exportIncludeMetadata', title: 'Include Metadata', description: 'Include metadata in command export', type: 'boolean', default: true }
            ]
        },
        {
            title: 'Advanced',
            settings: [
                { id: 'logLevel', title: 'Log Level', description: 'Log level for the extension', type: 'select', default: 'info',
                  options: [
                      { value: 'debug', label: 'Debug' },
                      { value: 'info', label: 'Info' },
                      { value: 'warn', label: 'Warning' },
                      { value: 'error', label: 'Error' },
                      { value: 'none', label: 'None' }
                  ]
                },
                { id: 'enablePerformanceMonitoring', title: 'Performance Monitoring', description: 'Enable performance monitoring', type: 'boolean', default: false },
                { id: 'performanceMonitoringThreshold', title: 'Performance Threshold', description: 'Threshold in ms for performance warnings', type: 'number', default: 500 },
                { id: 'enableDetailedLogs', title: 'Detailed Logs', description: 'Enable detailed logs', type: 'boolean', default: false }
            ]
        }
    ];
} 