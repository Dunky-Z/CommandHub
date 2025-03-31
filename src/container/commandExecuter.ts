import * as vscode from 'vscode';
import * as fs from 'fs';
import { Entry } from '../type/common';
import { Command, ShellType } from '../type/common';
import { dealTerminal } from './terminal';

export class CommandExecuter {

  constructor(viewId: string, context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand(`${viewId}.execute`, 
      (element: Entry) => {
        this.executeCommand(element, context);
      }
    ));
  }

  private executeCommand(element: Entry, context: vscode.ExtensionContext){
    console.log('CommandExecuter.execute called for:', element);
    const command: Command = JSON.parse(fs.readFileSync(element.uri.fsPath, 'utf8'));
    
    // 使用 dealTerminal 来支持分割终端功能
    const shell: ShellType = {
      key: "",
      value: command.script || ""
    };
    
    // 从命令路径中提取项目路径和名称
    const path = element.uri.fsPath.substring(0, element.uri.fsPath.lastIndexOf('/'));
    const projectName = path.substring(path.lastIndexOf('/') + 1);
    
    // 调用 dealTerminal 处理终端
    dealTerminal(context, {
      title: command.label || command.script || "",
      label: command.label || command.script || "",
      shell,
      path,
      projectName
    });
  }

  // 拿到window.termianls 用来给用户选择 选完再操作
  private selectTerminal(): Thenable<vscode.Terminal | undefined> {
    interface TerminalQuickPickItem extends vscode.QuickPickItem {
      terminal: vscode.Terminal;
    }
    const terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;
    const items: TerminalQuickPickItem[] = terminals.map(terminal => {
      return {
        label: `${terminal.name}`,
        terminal: terminal
      };
    });
    return vscode.window.showQuickPick(items).then(item => {
      return item ? item.terminal : undefined;
    });
  }
  
  private ensureTerminalExists(): void {
    if (vscode.window.terminals.length === 0) {
      vscode.window.createTerminal('Command List');
    }
  }
  
}