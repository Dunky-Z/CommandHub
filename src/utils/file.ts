import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// 使用require代替import
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

export namespace _ {
    function handleResult<T>(
        resolve: (result: T) => void,
        reject: (error: Error) => void,
        error: Error | null | undefined,
        result: T
    ): void {
        if (error) {
            reject(messageError(error));
        } else {
            resolve(result);
        }
    }

    function messageError(error: Error & { code?: string }): Error {
        if (error.code === 'ENOENT') {
            return vscode.FileSystemError.FileNotFound();
        }
        if (error.code === 'EISDIR') {
            return vscode.FileSystemError.FileIsADirectory();
        }
        if (error.code === 'EEXIST') {
            return vscode.FileSystemError.FileExists();
        }
        if (error.code === 'EPERM' || error.code === 'EACCESS') {
            return vscode.FileSystemError.NoPermissions();
        }
        return error;
    }
    //  判断路径是否存在
    export function exists(path: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            fs.exists(path, (exists) =>
                handleResult(resolve, reject, null, exists)
            );
        });
    }

    // 创建目录
    export function mkdir(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            mkdirp(path, (err: Error | null) => {
                if (err) {
                    reject(messageError(err));
                } else {
                    resolve();
                }
            });
        });
    }

    // 获取文件
    export function readdir(path: string): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            fs.readdir(path, (error, children) => {
                handleResult(resolve, reject, error, normalizeNFC(children));
            });
        });
    }

    // 文件状态
    export function stat(path: string): Promise<fs.Stats> {
        return new Promise<fs.Stats>((resolve, reject) => {
            fs.stat(path, (error, stat) =>
                handleResult(resolve, reject, error, stat)
            );
        });
    }

    export function normalizeNFC(items: string): string;
    export function normalizeNFC(items: string[]): string[];
    export function normalizeNFC(items: string | string[]): string | string[] {
        if (process.platform !== 'darwin') {
            return items;
        }
        if (Array.isArray(items)) {
            return items.map((item) => item.normalize('NFC'));
        }
        return items.normalize('NFC');
    }

    export function rmrf(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            rimraf(path, (err: Error | null) => {
                if (err) {
                    reject(messageError(err));
                } else {
                    resolve();
                }
            });
        });
    }
    export function unlink(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.unlink(path, (error) =>
                handleResult(resolve, reject, error, void 0)
            );
        });
    }
    export function rename(oldPath: string, newPath: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.rename(oldPath, newPath, (error) =>
                handleResult(resolve, reject, error, void 0)
            );
        });
    }
    export function readfile(path: string): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            fs.readFile(path, (error, buffer) =>
                handleResult(resolve, reject, error, buffer)
            );
        });
    }
    export function writefile(path: string, content: Buffer): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
        });
    }
    
    export function getPortablePath(filePath: string): string {
        return path.normalize(filePath);
    }

    export function ensureDirectoryExistence(filePath: string): void {
        const dirname = path.dirname(filePath);
        if (fs.existsSync(dirname)) {
            return;
        }
        ensureDirectoryExistence(dirname);
        fs.mkdirSync(dirname);
    }
}
