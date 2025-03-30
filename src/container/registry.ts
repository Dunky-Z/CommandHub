import * as vscode from 'vscode';

// 用于跟踪已注册的视图和命令
const registeredViews: Set<string> = new Set();
const registeredCommands: Set<string> = new Set();

// 检查视图是否已注册
export function isViewRegistered(viewId: string): boolean {
    return registeredViews.has(viewId);
}

// 检查命令是否已注册
export function isCommandRegistered(commandId: string): boolean {
    return registeredCommands.has(commandId);
}

// 注册视图
export function registerView<T>(viewId: string, provider: vscode.TreeDataProvider<T>, context: vscode.ExtensionContext): void {
    if (isViewRegistered(viewId)) {
        console.log(`View ${viewId} already registered, skipping.`);
        return;
    }
    try {
        vscode.window.registerTreeDataProvider(viewId, provider);
        registeredViews.add(viewId);
        console.log(`Successfully registered view: ${viewId}`);
    } catch (error) {
        console.error(`Failed to register view ${viewId}:`, error);
    }
}

// 注册命令
export function registerCommand<T extends (...args: any[]) => any>(commandId: string, handler: T, context: vscode.ExtensionContext): void {
    if (isCommandRegistered(commandId)) {
        console.log(`Command ${commandId} already registered, skipping.`);
        return;
    }
    try {
        const disposable = vscode.commands.registerCommand(commandId, handler);
        context.subscriptions.push(disposable);
        registeredCommands.add(commandId);
        console.log(`Successfully registered command: ${commandId}`);
    } catch (error) {
        console.error(`Failed to register command ${commandId}:`, error);
    }
} 