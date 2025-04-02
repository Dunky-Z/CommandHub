import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Command } from '../type/common';

export interface CommandFilter {
    search?: string;
    tags?: string[];
    category?: string;
    sortBy?: 'name' | 'createTime' | 'updateTime' | 'executionCount';
    sortDirection?: 'asc' | 'desc';
}

export interface CommandChangeEvent {
    type: 'create' | 'update' | 'delete' | 'move';
    commandId: string;
    command?: Command;
}

export class CommandDataProvider extends EventEmitter {
    private static instance: CommandDataProvider;
    private commandsMap: Map<string, Command> = new Map();
    private categoriesMap: Map<string, Set<string>> = new Map();
    private tagsMap: Map<string, Set<string>> = new Map();
    private commandHistoryMap: Map<string, number> = new Map();
    private storagePath: string = '';
    private isInitialized: boolean = false;
    private _onDidChangeCommands = new vscode.EventEmitter<CommandChangeEvent>();

    readonly onDidChangeCommands = this._onDidChangeCommands.event;

    private constructor() {
        super();
    }

    public static getInstance(): CommandDataProvider {
        if (!CommandDataProvider.instance) {
            CommandDataProvider.instance = new CommandDataProvider();
        }
        return CommandDataProvider.instance;
    }

    public async initialize(storagePath: string): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        this.storagePath = storagePath;
        await this.ensureStoragePath();
        await this.loadCommands();
        await this.loadCommandHistory();
        this.isInitialized = true;
    }

    private async ensureStoragePath(): Promise<void> {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }

        const commandsDir = path.join(this.storagePath, 'commands');
        if (!fs.existsSync(commandsDir)) {
            fs.mkdirSync(commandsDir, { recursive: true });
        }

        const historyPath = path.join(this.storagePath, 'history.json');
        if (!fs.existsSync(historyPath)) {
            fs.writeFileSync(historyPath, '{}', 'utf8');
        }
    }

    private async loadCommands(): Promise<void> {
        const commandsDir = path.join(this.storagePath, 'commands');
        await this.loadCommandsFromDirectory(commandsDir);
    }

    private async loadCommandsFromDirectory(directory: string, category: string = ''): Promise<void> {
        const entries = fs.readdirSync(directory, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            
            if (entry.isDirectory()) {
                const subcategory = category 
                    ? `${category}/${entry.name}` 
                    : entry.name;
                await this.loadCommandsFromDirectory(fullPath, subcategory);
            } else if (entry.isFile() && entry.name.endsWith('.json')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const command = JSON.parse(content) as Command;
                    
                    if (!command.id) {
                        command.id = path.basename(entry.name, '.json');
                    }
                    
                    if (!command.category && category) {
                        command.category = category;
                    }
                    
                    this.addCommandToMaps(command);
                } catch (error) {
                    console.error(`Failed to load command from ${fullPath}:`, error);
                }
            }
        }
    }

    private async loadCommandHistory(): Promise<void> {
        const historyPath = path.join(this.storagePath, 'history.json');
        try {
            const content = fs.readFileSync(historyPath, 'utf8');
            const history = JSON.parse(content);
            
            for (const [commandId, count] of Object.entries(history)) {
                this.commandHistoryMap.set(commandId, count as number);
            }
        } catch (error) {
            console.error('Failed to load command history:', error);
        }
    }

    private async saveCommandHistory(): Promise<void> {
        const historyPath = path.join(this.storagePath, 'history.json');
        const history: Record<string, number> = {};
        
        this.commandHistoryMap.forEach((count, commandId) => {
            history[commandId] = count;
        });
        
        try {
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
        } catch (error) {
            console.error('Failed to save command history:', error);
        }
    }

    private addCommandToMaps(command: Command): void {
        // Add to main commands map
        this.commandsMap.set(command.id, command);
        
        // Add to categories map
        if (command.category) {
            if (!this.categoriesMap.has(command.category)) {
                this.categoriesMap.set(command.category, new Set());
            }
            this.categoriesMap.get(command.category)?.add(command.id);
        }
        
        // Add to tags map
        if (command.tags && Array.isArray(command.tags)) {
            for (const tag of command.tags) {
                if (!this.tagsMap.has(tag)) {
                    this.tagsMap.set(tag, new Set());
                }
                this.tagsMap.get(tag)?.add(command.id);
            }
        }
    }

    private removeCommandFromMaps(commandId: string): void {
        const command = this.commandsMap.get(commandId);
        if (!command) {
            return;
        }
        
        // Remove from main commands map
        this.commandsMap.delete(commandId);
        
        // Remove from categories map
        if (command.category && this.categoriesMap.has(command.category)) {
            this.categoriesMap.get(command.category)?.delete(commandId);
            if (this.categoriesMap.get(command.category)?.size === 0) {
                this.categoriesMap.delete(command.category);
            }
        }
        
        // Remove from tags map
        if (command.tags && Array.isArray(command.tags)) {
            for (const tag of command.tags) {
                if (this.tagsMap.has(tag)) {
                    this.tagsMap.get(tag)?.delete(commandId);
                    if (this.tagsMap.get(tag)?.size === 0) {
                        this.tagsMap.delete(tag);
                    }
                }
            }
        }
    }

    // Public API methods

    public getAllCommands(): Command[] {
        return Array.from(this.commandsMap.values());
    }

    public getCommand(id: string): Command | undefined {
        return this.commandsMap.get(id);
    }

    public getCommandsCount(): number {
        return this.commandsMap.size;
    }

    public getAllCategories(): string[] {
        return Array.from(this.categoriesMap.keys()).sort();
    }

    public getAllTags(): string[] {
        return Array.from(this.tagsMap.keys()).sort();
    }

    public getCommandsInCategory(category: string): Command[] {
        const commandIds = this.categoriesMap.get(category);
        if (!commandIds) {
            return [];
        }
        
        return Array.from(commandIds)
            .map(id => this.commandsMap.get(id))
            .filter((cmd): cmd is Command => cmd !== undefined);
    }

    public getCommandsWithTag(tag: string): Command[] {
        const commandIds = this.tagsMap.get(tag);
        if (!commandIds) {
            return [];
        }
        
        return Array.from(commandIds)
            .map(id => this.commandsMap.get(id))
            .filter((cmd): cmd is Command => cmd !== undefined);
    }

    public getCommandExecutionCount(commandId: string): number {
        return this.commandHistoryMap.get(commandId) || 0;
    }

    public incrementCommandExecutionCount(commandId: string): number {
        const currentCount = this.commandHistoryMap.get(commandId) || 0;
        const newCount = currentCount + 1;
        this.commandHistoryMap.set(commandId, newCount);
        this.saveCommandHistory();
        return newCount;
    }

    public async addCommand(command: Command): Promise<void> {
        if (!command.id) {
            command.id = this.generateCommandId(command);
        }
        
        if (!command.createTime) {
            command.createTime = new Date().toISOString();
        }
        
        command.updateTime = new Date().toISOString();
        
        this.addCommandToMaps(command);
        await this.saveCommand(command);
        
        this._onDidChangeCommands.fire({
            type: 'create',
            commandId: command.id,
            command
        });
    }

    public async updateCommand(command: Command): Promise<void> {
        if (!command.id || !this.commandsMap.has(command.id)) {
            throw new Error(`Command with id ${command.id} does not exist`);
        }
        
        command.updateTime = new Date().toISOString();
        
        this.removeCommandFromMaps(command.id);
        this.addCommandToMaps(command);
        await this.saveCommand(command);
        
        this._onDidChangeCommands.fire({
            type: 'update',
            commandId: command.id,
            command
        });
    }

    public async deleteCommand(commandId: string): Promise<void> {
        const command = this.commandsMap.get(commandId);
        if (!command) {
            return;
        }
        
        this.removeCommandFromMaps(commandId);
        await this.deleteCommandFile(command);
        
        this._onDidChangeCommands.fire({
            type: 'delete',
            commandId
        });
    }

    public async moveCommand(commandId: string, newCategory: string): Promise<void> {
        const command = this.commandsMap.get(commandId);
        if (!command) {
            return;
        }
        
        const oldCategory = command.category;
        command.category = newCategory;
        command.updateTime = new Date().toISOString();
        
        this.removeCommandFromMaps(commandId);
        this.addCommandToMaps(command);
        
        await this.deleteCommandFile(command, oldCategory);
        await this.saveCommand(command);
        
        this._onDidChangeCommands.fire({
            type: 'move',
            commandId,
            command
        });
    }

    public searchCommands(filter: CommandFilter = {}): Command[] {
        let results = this.getAllCommands();
        
        // Filter by search query
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            results = results.filter(cmd => 
                (cmd.name && cmd.name.toLowerCase().includes(searchLower)) ||
                (cmd.description && cmd.description.toLowerCase().includes(searchLower)) ||
                (cmd.script && cmd.script.toLowerCase().includes(searchLower))
            );
        }
        
        // Filter by category
        if (filter.category) {
            results = results.filter(cmd => cmd.category === filter.category);
        }
        
        // Filter by tags
        if (filter.tags && filter.tags.length > 0) {
            results = results.filter(cmd => {
                if (!cmd.tags || !Array.isArray(cmd.tags)) {
                    return false;
                }
                return filter.tags!.every(tag => cmd.tags.includes(tag));
            });
        }
        
        // Sort the results
        if (filter.sortBy) {
            results.sort((a, b) => {
                let valueA: any;
                let valueB: any;
                
                switch (filter.sortBy) {
                    case 'name':
                        valueA = a.name || '';
                        valueB = b.name || '';
                        break;
                    case 'createTime':
                        valueA = a.createTime || '';
                        valueB = b.createTime || '';
                        break;
                    case 'updateTime':
                        valueA = a.updateTime || '';
                        valueB = b.updateTime || '';
                        break;
                    case 'executionCount':
                        valueA = this.getCommandExecutionCount(a.id);
                        valueB = this.getCommandExecutionCount(b.id);
                        break;
                    default:
                        return 0;
                }
                
                // Compare the values
                if (valueA < valueB) {
                    return filter.sortDirection === 'desc' ? 1 : -1;
                }
                if (valueA > valueB) {
                    return filter.sortDirection === 'desc' ? -1 : 1;
                }
                return 0;
            });
        }
        
        return results;
    }

    // Helper methods for file operations

    private async saveCommand(command: Command): Promise<void> {
        const commandsDir = path.join(this.storagePath, 'commands');
        
        let targetDir = commandsDir;
        if (command.category) {
            targetDir = path.join(commandsDir, command.category);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
        }
        
        const filePath = path.join(targetDir, `${command.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(command, null, 2), 'utf8');
    }

    private async deleteCommandFile(command: Command, category?: string): Promise<void> {
        const commandsDir = path.join(this.storagePath, 'commands');
        
        let targetDir = commandsDir;
        if (category || command.category) {
            targetDir = path.join(commandsDir, category || command.category);
        }
        
        const filePath = path.join(targetDir, `${command.id}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    private generateCommandId(command: Command): string {
        // Generate a slug-like ID from the command name or script
        const base = command.name || command.script || 'command';
        const slug = base
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        // Ensure the ID is unique by appending a timestamp if needed
        let id = slug.substring(0, 40);
        if (this.commandsMap.has(id)) {
            id = `${id}-${Date.now().toString(36)}`;
        }
        
        return id;
    }
}

export const commandDataProvider = CommandDataProvider.getInstance(); 