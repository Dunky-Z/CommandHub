import * as vscode from 'vscode';
import { ShellType } from '../type/common';
import { copyToClipboard, getWorkSpaceFolders } from '../utils';
import SideBarCommand from './SideBarCommand';
import { CommandExplorer } from './CommandExplorer';
import { CommandExecuter } from './commandExecuter';
import { dealTerminal } from './terminal';


export default function(context: vscode.ExtensionContext) {
    // 项目命令
    initProjectCommand(context);
    
    // 自定义目录命令
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        // 注册一个命令处理程序来显示提示消息
        context.subscriptions.push(
            vscode.commands.registerCommand('WorkSpace-Command.add', () => {
                vscode.window.showInformationMessage('Please open a workspace first, then add workspace commands.');
            }),
            vscode.commands.registerCommand('WorkSpace-Command.addFolder', () => {
                vscode.window.showInformationMessage('Please open a workspace first, then add a folder.');
            }),
            vscode.commands.registerCommand('WorkSpace-Command.sync', () => {
                vscode.window.showInformationMessage('Please open a workspace first, then refresh.');
            }),
            vscode.commands.registerCommand('WorkSpace-Command.edit', () => {
                vscode.window.showInformationMessage('Please open a workspace first, then edit.');
            }),
            vscode.commands.registerCommand('WorkSpace-Command.editLabel', () => {
                vscode.window.showInformationMessage('Please open a workspace first, then edit the label.');
            })
        );
    } else {
        // 工作区存在时，正常初始化命令
        const workspaceStoragePath = context.storageUri ? context.storageUri.fsPath : context.storagePath || './';
        console.log('WorkSpace storage path:', workspaceStoragePath);
        new CommandExplorer('WorkSpace-Command', workspaceStoragePath, context);
        new CommandExecuter('workSpaceCommandExecuter', context);
    }

    // 全局命令 - 确保只初始化一次
    const globalStoragePath = context.globalStorageUri ? context.globalStorageUri.fsPath : context.globalStoragePath || './';
    console.log('Global storage path:', globalStoragePath);
    
    // 检查是否已经注册了Global-Command视图
    if (!vscode.window.registerTreeDataProvider.toString().includes('Global-Command')) {
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
    // 注册树形文件树
    vscode.window.registerTreeDataProvider('SideBar-Command', sideBar);
    

    // 注册命令 点击每行  context.subscriptions.push销毁命令用
    context.subscriptions.push(vscode.commands.registerCommand(
        `${viewId}.openChild`, 
        (args: { title: string; shell: ShellType; [key: string]: any }) => { 
            console.log('SideBar-Command.openChild 被触发:', args);
            dealTerminal(context, args);
        }
    ));
    // 复制命令
    context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.copy`, (node) => { 
        const shell = node.shell.value;
        copyToClipboard(shell, () => {
            vscode.window.showInformationMessage(`Command ${shell} has been copied to the clipboard`);
        });
    }));
}