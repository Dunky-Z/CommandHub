import * as vscode from 'vscode';
import { ShellType } from '../type/common';
import { copyToClipboard, getWorkSpaceFolders } from '../utils';
import SideBarCommand from './SideBarCommand';
import { CommandExplorer } from './CommandExplorer';
import { CommandExecuter } from './commandExecuter';
import { dealTerminal } from './terminal';
import { registerView, registerCommand, isViewRegistered } from './registry';

export default function(context: vscode.ExtensionContext) {
    // 项目命令
    initProjectCommand(context);
    
    // 自定义目录命令
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        // 注册一个命令处理程序来显示提示消息
        registerCommand('WorkSpace-Command.add', () => {
            vscode.window.showInformationMessage('请先打开一个工作区，然后再添加工作区命令。');
        }, context);
        
        registerCommand('WorkSpace-Command.addFolder', () => {
            vscode.window.showInformationMessage('请先打开一个工作区，然后添加文件夹。');
        }, context);
        
        registerCommand('WorkSpace-Command.sync', () => {
            vscode.window.showInformationMessage('请先打开一个工作区，然后再刷新。');
        }, context);
        
        registerCommand('WorkSpace-Command.edit', () => {
            vscode.window.showInformationMessage('请先打开一个工作区，然后再编辑。');
        }, context);
        
        registerCommand('WorkSpace-Command.editLabel', () => {
            vscode.window.showInformationMessage('请先打开一个工作区，然后再编辑标签。');
        }, context);
    } else {
        // 工作区存在时，正常初始化命令
        const workspaceStoragePath = context.storageUri ? context.storageUri.fsPath : context.storagePath || './';
        console.log('WorkSpace storage path:', workspaceStoragePath);
        
        if (!isViewRegistered('WorkSpace-Command')) {
            new CommandExplorer('WorkSpace-Command', workspaceStoragePath, context);
            new CommandExecuter('workSpaceCommandExecuter', context);
        }
    }

    // 全局命令
    const globalStoragePath = context.globalStorageUri ? context.globalStorageUri.fsPath : context.globalStoragePath || './';
    console.log('Global storage path:', globalStoragePath);
    
    if (!isViewRegistered('Global-Command')) {
        new CommandExplorer('Global-Command', globalStoragePath, context);
        new CommandExecuter('globalCommandExecuter', context);
    }
};

// 初始化本地项目命令
function initProjectCommand(context: vscode.ExtensionContext) {
    // 得到vscode工作区的工程项目
    const folderList = getWorkSpaceFolders();
    console.log('folderList:', folderList);

    // 注册侧边栏面板
    const sideBar = new SideBarCommand(folderList);

    // 定义本地项目命令的id
    const viewId = 'SideBar-Command';
    
    // 注册树形文件树（如果尚未注册）
    if (!isViewRegistered(viewId)) {
        registerView(viewId, sideBar, context);
        
        // 注册命令 点击每行
        registerCommand(`${viewId}.openChild`, (args: { title: string; shell: ShellType; [key: string]: any }) => { 
            dealTerminal(context, args);
        }, context);
        
        // 复制命令
        registerCommand(`${viewId}.copy`, (node: any) => { 
            const shell = node.shell.value;
            copyToClipboard(shell, () => {
                vscode.window.showInformationMessage(`已经复制命令${shell}到剪切板`);
            });
        }, context);
    }
}