import * as vscode from 'vscode';
import { FolderType } from '../type/common';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

import * as cp from 'child_process';
import { ExecException}  from 'child_process';
export * from './package';
export * from './file';

/**
 * @description 因为 vscode 支持 Multi-root 工作区，暴力解决
 * @summary 如果发现只有一个根文件夹，读取其子文件夹作为 workspaceFolders
 */
function getWorkSpaceFolders() {
    console.log('getWorkSpaceFolders:', vscode?.workspace?.workspaceFolders);
    const folders: FolderType[] = [];
    vscode?.workspace?.workspaceFolders?.forEach((folder: any) => {
        folders.push({
            name: folder.name,
            path: folder.uri.path
        });
        console.log('folder:', folder.name);
        console.log('getWorkSpaceFolders:', folder.uri.path);
    });
    return folders;
}

/**
 *@description 得到正确的地址，兼容window上的问题
 */
function getPathHack(filePath: string) {
    if (isWinOS()) {
        return filePath.slice(1);
    }
    return filePath;
}

/**
 * @description 获取操作系统平台
 */
function isWinOS() {
    return os.platform() === 'win32';
}

function isMacOS() {
    return os.platform() === 'darwin';
}

/**
 * @description 字符串去除首尾空格
 */
function trim(str: string) {
    return str.replace(/(^\s*)|(\s*$)/g, '');
}

/**
 * @description 数组去重
 * @param {Array} arr
 * @param {string} iteratee
 */
function uniqBy(arr: any[], iteratee: string) {
    return arr !== null && arr.length ? objUniq(arr, iteratee) : [];
}

/**
 * @description 对象去重
 * terminals = [{terminalName: aa}]
 */
function objUniq(arr: any[], iteratee: string) {
    let uniqMaps: { [key: string]: any } = {};
    arr.forEach((ele: { [key: string]: any }, index: number) => {
        if (!uniqMaps[ele[iteratee]]) {
            // 默认采用第一个出现的数据为准
            uniqMaps[ele[iteratee]] = index;
        }
    });
    // uniqMaps = {aa:1 , bb:2}
    const result = Object.keys(uniqMaps).map((key: string) => {
        return arr[uniqMaps[key]];
    });
    return result;
}

// 拷贝文本
function copyToClipboard(text: any, func: Function) {
    if (isMacOS()) {
        macCopy(text);
        func();
        return;
    }
    let resultfileName = "result.txt";
    let command = `clip < ${resultfileName} `;
    // 写入要粘贴的内容进result.txt
    fs.writeFileSync(resultfileName, text, { encoding: "utf8" });
    let cmdFileName = "copy.bat";
    // 写入粘贴命令 clip < result.text 进copy.bat
    fs.writeFileSync(cmdFileName, command, { encoding: "utf8" });
    cp.exec(cmdFileName, {}, (error: ExecException | null, stdout: string, stderr: string) => {
        if (error || stderr) {return console.log(error, stdout, stderr);}
        // 用nodejs删除文件
        fs.unlinkSync(cmdFileName);
        fs.unlinkSync(resultfileName);
        func(text, stdout);
    });
};

function macCopy(data: any) {
    const proc = cp.spawn("pbcopy");
    proc.stdin.write(data);
    proc.stdin.end();
}

/**
 * @description 规范化路径，确保在不同系统上使用正确的路径分隔符
 * @param filePath 需要规范化的路径
 * @returns 规范化后的路径
 */
export function normalizePath(filePath: string): string {
    if (!filePath) {
        return filePath;
    }
    
    // 将Windows风格路径转换为POSIX风格
    let normalized = filePath.replace(/\\/g, '/');
    
    // 处理Windows驱动器前缀 (如 C:/)
    if (/^[a-zA-Z]:\//.test(normalized)) {
        // 在Linux下保留驱动器前缀但不使用它（WSL访问Windows文件系统的特殊情况）
        if (process.platform !== 'win32') {
            console.log('Detected Windows drive prefix on Linux:', normalized);
        }
    }
    
    // 确保不以多余的斜杠开头 (除了第一个)
    normalized = normalized.replace(/^\/+/, '/');
    
    console.log(`Path normalized: "${filePath}" -> "${normalized}"`);
    return normalized;
}

export function isAbsolutePath(filePath: string): boolean {
    return path.isAbsolute(filePath);
}

export function resolveFilePath(basePath: string, relativePath: string): string {
    return path.resolve(basePath, relativePath);
}

export { getWorkSpaceFolders, getPathHack, trim, uniqBy, copyToClipboard, isWinOS };
