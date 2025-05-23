import * as vscode from 'vscode';

// 工程文件类型
export interface FolderType {
    name: string;
    path: string;
}

// 命令
export interface ShellType {
    key: string; // 脚本名
    value: string; // 脚本内容
    environment?: string; // 脚本环境
}

// 终端类型接口
export interface MyTerminalOptions extends vscode.TerminalOptions {
    terminalCwd: string; // 执行目录
    terminalName?: string; // 终端名称
    terminalText?: string; // 终端填充内容
    terminalAutoInputText?: boolean; // 是否自动填充终端内容
    terminalAutoRun?: boolean; // 是否自动运行
}

export interface Entry {
    uri: vscode.Uri;
    type: vscode.FileType;
}
export interface Command {
    label?:string;
    script?:string;
    time?:number;
}