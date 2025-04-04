import * as vscode from 'vscode';
import { Entry } from '../type/common';
import { _ } from '../utils';
import FileSystemProvider from './FileSystemProvider';
import * as fs from 'fs';
import * as path from 'path';
import { Command } from '../type/common';

export class CommandExplorer {
    private commandExplorer?: vscode.TreeView<Entry>;

    private selectedFile?: Entry;

    constructor(viewId: string, storagePath: string, context: vscode.ExtensionContext) {
        this.setupStorage(storagePath).then(() => {
            // 创建文件树对象
            const treeDataProvider = new FileSystemProvider(viewId, storagePath);
            // 创建目录树
            this.commandExplorer = vscode.window.createTreeView(viewId, { 
                treeDataProvider,
                dragAndDropController: treeDataProvider as any // 使用 as any 解决类型问题
            });
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.openFile`, (resource) => this.openResource(resource)));

            this.commandExplorer.onDidChangeSelection(event => this.selectedFile = event.selection[0]);
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.add`, () => treeDataProvider.add(this.selectedFile)));
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.addFolder`, () => treeDataProvider.addFolder(this.selectedFile)));
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.sync`, () => treeDataProvider.refresh()));
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.edit`, (element) => treeDataProvider.edit(element)));
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.editLabel`, (element) => treeDataProvider.editLabel(element)));
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.editFolder`, (element) => treeDataProvider.edit(element)));
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.delete`, (element) => {
                    treeDataProvider.delete(element.uri, {recursive: true});
                    // 删除后就清除选中 否则会新增文件夹时用回这个已经删除的目录去新增子目录
                    this.selectedFile = undefined;
                }
            ));
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.copy`, (element) => treeDataProvider.copyCommand(element)));
            
            // 添加导出命令注册
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.export`, () => this.exportCommands(treeDataProvider)));
            
            // 添加导入命令注册
            context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.import`, () => this.importCommands(treeDataProvider)));
        });
    }

    private async setupStorage(storageUriFsPath: string) {
        const isExist = await _.exists(storageUriFsPath);

        if (!isExist) {
            await _.mkdir(storageUriFsPath);
        }
        return;
    }
    private openResource(resource: vscode.Uri): void {
        vscode.window.showTextDocument(resource);
    }

    // 导出命令集到JSON文件
    private async exportCommands(treeDataProvider: FileSystemProvider): Promise<void> {
        try {
            // 获取保存路径
            const saveUri = await vscode.window.showSaveDialog({
                filters: { 'JSON': ['json'] },
                saveLabel: 'Export Command Set',
                title: 'Select the location to save the exported command set'
            });
            
            if (!saveUri) {
                return; // 用户取消操作
            }
            
            // 递归收集所有命令和文件夹结构
            const commandsData = await this.collectCommands(treeDataProvider.rootUri.fsPath, '');
            
            // 写入文件
            fs.writeFileSync(saveUri.fsPath, JSON.stringify(commandsData, null, 2), 'utf8');
            
            vscode.window.showInformationMessage(`Command set exported successfully to: ${saveUri.fsPath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export command set: ${error}`);
            console.error('Error exporting command set:', error);
        }
    }
    
    // 递归收集命令和文件夹结构
    private async collectCommands(dirPath: string, folderPath: string): Promise<any[]> {
        const items: any[] = [];
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // 这是一个文件夹
                const folderName = file;
                const newFolderPath = folderPath ? `${folderPath}/${folderName}` : folderName;
                
                // 递归处理子文件夹
                const subItems = await this.collectCommands(fullPath, newFolderPath);
                items.push(...subItems);
            } else if (file.endsWith('.json')) {
                // 这是一个命令文件
                try {
                    const commandData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    // 添加folder字段
                    commandData.folder = folderPath;
                    items.push(commandData);
                } catch (e) {
                    console.error(`解析文件 ${file} 失败:`, e);
                }
            }
        }
        
        return items;
    }
    
    // 导入命令集
    private async importCommands(treeDataProvider: FileSystemProvider): Promise<void> {
        try {
            // 获取导入文件路径
            const fileUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'JSON': ['json'] },
                openLabel: 'Import Command Set',
                title: 'Select the JSON file of the command set to import'
            });
            
            if (!fileUris || fileUris.length === 0) {
                return; // 用户取消操作
            }
            
            const fileContent = fs.readFileSync(fileUris[0].fsPath, 'utf8');
            const commandsData = JSON.parse(fileContent);
            
            if (!Array.isArray(commandsData)) {
                throw new Error('Invalid command set file format');
            }
            
            // 导入命令
            let importCount = 0;
            for (const command of commandsData) {
                await this.importSingleCommand(treeDataProvider, command);
                importCount++;
            }
            
            // 刷新视图
            treeDataProvider.refresh();
            
            vscode.window.showInformationMessage(`Successfully imported ${importCount} commands`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import command set: ${error}`);
            console.error('Error importing command set:', error);
        }
    }
    
    // 导入单个命令
    private async importSingleCommand(treeDataProvider: FileSystemProvider, command: any): Promise<void> {
        // 检查必要字段
        if (!command.script) {
            console.warn('Skipping invalid command:', command);
            return;
        }
        
        // 处理文件夹路径
        let targetDir = treeDataProvider.rootUri.fsPath;
        if (command.folder) {
            // 创建嵌套文件夹结构
            const folderParts = command.folder.split('/');
            for (const part of folderParts) {
                if (!part) continue;
                
                const folderPath = path.join(targetDir, part);
                if (!fs.existsSync(folderPath)) {
                    fs.mkdirSync(folderPath, { recursive: true });
                }
                targetDir = folderPath;
            }
        }
        
        // 生成文件名
        const sanitizedFilename = require('sanitize-filename')(command.script).slice(0, 250);
        const commandFilePath = path.join(targetDir, `${sanitizedFilename}.json`);
        
        // 移除folder字段，因为它不是原始命令数据的一部分
        const commandToSave = { ...command };
        delete commandToSave.folder;
        
        // 写入命令文件
        fs.writeFileSync(commandFilePath, JSON.stringify(commandToSave, null, 2), 'utf8');
    }
}
