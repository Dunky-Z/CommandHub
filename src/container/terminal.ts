import * as vscode from 'vscode';
import { MyTerminalOptions, ShellType } from '../type/common';
import { PREFIX } from '../constants';
import { getPathHack, getWorkSpaceFolders, uniqBy } from '../utils';
import { StatusBarTerminal } from './StatusBarTerminal';

// 最大终端数量
const MAX_TERMINALS = 10;
// 终端数组
let terminals: StatusBarTerminal[] = [];
// 终端数量
let terminalCount = 0;
// 当前终端索引
let terminalIndex: number;

// 终端处理
export async function dealTerminal(context: vscode.ExtensionContext, args: { title: string; shell: ShellType; [key: string]: any }) {
        const { label, shell = null, path, projectName } = args;
        const reg = new RegExp(PREFIX);
        console.log('label:', label);
        if (reg.test(label)) {
            vscode.window.showErrorMessage(label);
        } else {
            // 获取用户配置是否分割终端设置
            const splitTerminal = vscode.workspace.getConfiguration().get('CommandHub.splitTerminal') || false;
            console.log('splitTerminal:', splitTerminal);
            // 获取用户配置的是否自动运行脚本
            const autoRunTerminal: boolean = vscode.workspace.getConfiguration().get('CommandHub.autoRunTerminal') || false;

            // splitTerminal=true: 每次在新的终端标签页执行
            // splitTerminal=false: 始终在同一个终端标签页执行
            if (splitTerminal) {
                // 总是创建新的终端标签页
                console.log('创建新终端...');
                addTerminal(path, projectName, shell, autoRunTerminal);
            } else {
                // 查找是否有任何终端存在
                if (terminals.length === 0) {
                    // 没有终端，创建一个
                    console.log('没有终端，创建新终端...');
                    addTerminal(path, projectName, shell, autoRunTerminal);
                } else {
                    // 使用第一个终端
                    console.log('使用已有终端...');
                    const firstTerminal = terminals[0];
                    firstTerminal.show();
                    
                    // 直接发送命令到终端
                    if (shell) {
                        const command = shell.value || '';
                        console.log('执行命令:', command);
                        // 调用show方法确保终端可见，然后使用VS Code API发送命令
                        if (vscode.window.activeTerminal) {
                            vscode.window.activeTerminal.sendText(command, autoRunTerminal);
                        }
                    }
                }
            }

            // 订阅关闭终端方法
            context.subscriptions.push(vscode.window.onDidCloseTerminal(onDidCloseTerminal));
        } 
}

// 增加终端
function addTerminal(path: string, projectName: any, shell: ShellType | null, autoRunTerminal: boolean) {
    terminals.push(
        new StatusBarTerminal(terminalCount++, {
            terminalCwd: getPathHack(path),
            terminalName: projectName,
            terminalText: shell?.value || '',  // 使用完整命令，而不是npm run
            terminalAutoInputText: true,
            terminalAutoRun: autoRunTerminal
        })
    );
}

// 创建分割拆分终端
async function createNewSplitTerminal(terminalIndex: number, terminalOptions: MyTerminalOptions): Promise<vscode.Terminal> {
    return new Promise(async () => {
        // 通过命令创建的终端是默认的终端信息，暂未发现此命令可以通过传参配置生成的命令
        // 解决方案就是构造一个StatusBarTerminal实例，再updateTerminal
        await vscode.commands.executeCommand('workbench.action.terminal.split'); // 终端切割
        const activeTerminal = vscode.window.activeTerminal; // 此时激活的终端就是当前分屏后的， 然后设置一个新的终端 指向这个分屏的终端
        const splitInstance = new StatusBarTerminal(terminalIndex, terminalOptions, false);
        if (activeTerminal && terminalOptions?.terminalAutoInputText && terminalOptions?.terminalText) {
            activeTerminal.sendText(
                terminalOptions.terminalText,
                terminalOptions.terminalAutoRun
            );
        }
        splitInstance.updateTerminal(activeTerminal); // 新建的这个终端的this指向 activeTerminal
        terminals.push(splitInstance);
    });
}

/**
 * @description 关闭终端执行
 * @param terminal: 当前关闭的终端
 *  */ 
function onDidCloseTerminal(terminal: vscode.Terminal): void {
    terminals.forEach((eachTerminal: StatusBarTerminal, index) => {
        // 找到当前终端的索引
        if (eachTerminal.hasTerminal(terminal)) {
            terminalIndex = index;
        }
    });
    terminals[terminalIndex]?.dispose(); // 关闭当前的终端
    terminals.splice(terminalIndex, 1); // 删除关闭的终端
    // 设置下终端的索引文案
    terminals.forEach((eachTerminal: StatusBarTerminal, i) => {
        terminals[i].setTerminalIndex(i);
    });
    // 终端数量-1
    terminalCount--;
};