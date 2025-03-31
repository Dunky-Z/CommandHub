import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
// import * as sanitizeFilename from 'sanitize-filename';

import { FileStat } from './FileStat';
import { _, copyToClipboard, isWinOS } from '../utils';
import { Command, Entry } from '../type/common';

const sanitizeFilename = require('sanitize-filename');

export default class FileSystemProvider
    implements vscode.TreeDataProvider<Entry>, vscode.FileSystemProvider, vscode.TreeDragAndDropController<Entry>
{
    // 创建目录树的事件发射器
    private _onDidChangeTreeData: vscode.EventEmitter<Entry | undefined> =
        new vscode.EventEmitter<Entry | undefined>();
    // 获取事件发射器的事件
    readonly onDidChangeTreeData: vscode.Event<Entry | undefined> =
        this._onDidChangeTreeData.event;
    // 创建文件事件发射器
    private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]> =
        new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    // 定义视图id
    private viewId: string;

    // 将rootUri改为公开属性，以便 CommandExplorer 可以访问
    public rootUri: vscode.Uri;

    // 自定义排序映射
    private sortOrderMap: Map<string, string[]> = new Map();

    constructor(viewId: string, rootPath: string) {
        this.rootUri = vscode.Uri.file(rootPath);
        console.log('this.rootUri:', this.rootUri);
        this.viewId = viewId;
        this.watch(this.rootUri, { recursive: true, excludes: ['.json'] });
        
        // 初始化排序信息
        this.loadSortOrders();
    }
    
    // 加载所有文件夹的排序信息
    private async loadSortOrders(): Promise<void> {
        try {
            await this.loadFolderSortOrder(this.rootUri.fsPath);
        } catch (e) {
            console.error('Failed to load sort orders:', e);
        }
    }
    
    // 递归加载文件夹排序信息
    private async loadFolderSortOrder(folderPath: string): Promise<void> {
        // 先加载当前文件夹的排序
        const orderFilePath = path.join(folderPath, '.order');
        if (await _.exists(orderFilePath)) {
            try {
                const content = await _.readfile(orderFilePath);
                const order = JSON.parse(content.toString());
                if (Array.isArray(order)) {
                    this.sortOrderMap.set(folderPath, order);
                }
            } catch (e) {
                console.error(`Failed to read sort file: ${orderFilePath}`, e);
            }
        }
        
        // 递归处理子文件夹
        try {
            const entries = await _.readdir(folderPath);
            for (const entry of entries) {
                const entryPath = path.join(folderPath, entry);
                const stat = await _.stat(entryPath);
                if (stat.isDirectory()) {
                    await this.loadFolderSortOrder(entryPath);
                }
            }
        } catch (e) {
            console.error(`Failed to read directory: ${folderPath}`, e);
        }
    }
    
    // 保存排序信息
    private async saveSortOrder(folderPath: string, items: string[]): Promise<void> {
        try {
            const orderFilePath = path.join(folderPath, '.order');
            await _.writefile(orderFilePath, Buffer.from(JSON.stringify(items)));
            // 更新内存中的排序映射
            this.sortOrderMap.set(folderPath, items);
            console.log('saveSortOrder:', items);
            console.log('folderPath:', folderPath);
        } catch (e) {
            console.error(`Failed to save sort order: ${folderPath}`, e);
        }
    }
    
    async add(selected?: Entry) {
        const script = await vscode.window.showInputBox({
            placeHolder: `E.g.: npm run dev`,
            prompt: `Enter a new command script`
        });
        
        if (!script) {
            return; // 用户取消输入时退出
        }
        
        const command: Command = {
            script: script,
            label: `label:${script}`,
        };
        let fileName = command.script;
        const sanitizedFilename = sanitizeFilename(<string>fileName).slice(0, 250);
        console.log('sanitizedFilename:', sanitizedFilename);
        if (selected) {
            const filePath = selected.type === vscode.FileType.Directory ? 
            `${selected.uri.fsPath}/${sanitizedFilename}.json` :
            `${this.getDirectoryPath(selected.uri.fsPath)}/${sanitizedFilename}.json`;
            this._writeFile(filePath, this.stringToUnit8Array(JSON.stringify(command)), 
            {create: true, overwrite: true});
            console.log('add selected filePath:', filePath);
        } else {
            this._writeFile(`${this.rootUri.fsPath}/${sanitizedFilename}.json`, 
            this.stringToUnit8Array(JSON.stringify(command)), {create: true, overwrite: true});
            console.log('this.rootUri.fsPath:', `${this.rootUri.fsPath}`);
            console.log('add filePath:', `${this.rootUri.fsPath}/${sanitizedFilename}.json`);
        }
    }
    addFolder(selected?: Entry) {
        vscode.window.showInputBox({placeHolder: 'Enter a new group name'})
            .then(value => {
                if (value !== null && value !== undefined) {
                    const sanitizedFilename = sanitizeFilename(<string>value).slice(0, 250);

                    if (selected) {
                        const filePath = selected.type === vscode.FileType.Directory ? 
                        `${selected.uri.fsPath}/${sanitizedFilename}` : `${this.getDirectoryPath(selected.uri.fsPath)}/${sanitizedFilename}}`;
                        this.createDirectory(vscode.Uri.file(filePath));
                    } else {
                        // 根目录下创建
                        this.createDirectory(vscode.Uri.file(`${this.rootUri.fsPath}/${sanitizedFilename}`));
                    }
                }
            });
    }
    async edit(element?: Entry) {
        if (element && element.type === vscode.FileType.File) {
            const file: Command = JSON.parse(fs.readFileSync(element.uri.fsPath, 'utf8'));
            const script = await vscode.window.showInputBox({
                prompt: 'Edit command script',
                value: file.script ? file.script : ''
            });
            if(!script) {return;};
            const command: Command = {
                ...file,
                script
            };
            const fileName = command.script;
            const sanitizedFilename = sanitizeFilename(<string>fileName).slice(0, 250);
            const newUri = vscode.Uri.file(`${this.getDirectoryPath(element.uri.fsPath)}/${sanitizedFilename}.json`);
            await this.delete(element.uri, {recursive: false});
            await this._writeFile(newUri.fsPath, this.stringToUnit8Array(JSON.stringify(command)), {create: true, overwrite: true });
        } else if (element && element.type === vscode.FileType.Directory) {
            vscode.window.showInputBox({ placeHolder: 'Edit Folder name', value: this.getFileName(element.uri.fsPath) })
            .then(value => {
                const sanitizedFilename = sanitizeFilename(<string>value).slice(0, 250);

                if (value !== null && value !== undefined) {
                    const newPath = vscode.Uri.file(`${this.getDirectoryPath(element.uri.fsPath)}/${sanitizedFilename}`);
                    this.rename(element.uri, newPath, { overwrite: true});
                }
            });
        }
    }
    async editLabel(element?: Entry) {
        if (element && element.type === vscode.FileType.File) {
            const file: Command = JSON.parse(fs.readFileSync(element.uri.fsPath, 'utf8'));
            const label = await vscode.window.showInputBox({
                prompt: 'Edit command label',
                value: file.label ? file.label : ''
            });
            if (!label) {
                return;
            }
            const command: Command = {
                ...file,
                label
            };
            await this._writeFile(element.uri.fsPath, this.stringToUnit8Array(JSON.stringify(command)), {create: true, overwrite: true});
        }
    }
    copyCommand(element?: Entry) {
        if (element && element.type === vscode.FileType.File) { 
            const file: Command = JSON.parse(fs.readFileSync(element.uri.fsPath, 'utf8'));
            copyToClipboard(file.script, () => {
                vscode.window.showInformationMessage(`Command ${file.script} has been copied to the clipboard`);
            });
        }
    }
    watch(
        uri: vscode.Uri,
        options: { recursive: boolean; excludes: string[] }
    ): vscode.Disposable {
        const watcher = fs.watch(
            uri.fsPath,
            { recursive: options.recursive },
            async (event: string, filename: string | Buffer) => {
                // 获取文件路径
                const filePath = path.join(
                    uri.fsPath,
                    _.normalizeNFC(filename.toString())
                );
                this.refresh(); // 重新触发目录树的 getChildren
                // 更新文件状态 告知文件系统该文件改变了 
                this._onDidChangeFile.fire([
                    {
                        type:
                            event === 'change'
                                ? vscode.FileChangeType.Changed
                                : (await _.exists(filePath))
                                ? vscode.FileChangeType.Created
                                : vscode.FileChangeType.Deleted,
                        uri: uri.with({ path: filePath })
                    } as vscode.FileChangeEvent
                ]);
            }
        );
        return {
            dispose: () => watcher.close()
        };
    }
    stat(uri: vscode.Uri): Thenable<vscode.FileStat> {
        return this._stat(uri.fsPath);
    }
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
    get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
        return this._onDidChangeFile.event;
    }
    createDirectory(uri: vscode.Uri): void | Thenable<void> {
        return _.mkdir(uri.fsPath);
    }
    readDirectory(uri: vscode.Uri): Thenable<[string, vscode.FileType][]> {
        return this._readDirectory(uri);
    }
    async _stat(path: string): Promise<vscode.FileStat> {
        return new FileStat(await _.stat(path));
    }
    async _readDirectory(
        uri: vscode.Uri
    ): Promise<[string, vscode.FileType][]> {
        const children = await _.readdir(uri.fsPath);
        const result: [string, vscode.FileType][] = [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const stat = await this._stat(path.join(uri.fsPath, child));
            result.push([child, stat.type]);
        }
        return Promise.resolve(result);
    }
    getFileName(path: string): string {
        if(isWinOS()) {
            return path.slice(path.lastIndexOf('\\') + 1);
        }
        return path.slice(path.lastIndexOf('/') + 1);
    }
    delete(uri: vscode.Uri, options: { recursive: boolean }): Thenable<void> {
        const parentDir = this.getDirectoryPath(uri.fsPath);
        const fileName = this.getFileName(uri.fsPath);
        
        // 删除前更新排序信息
        this.updateSortOrderOnDelete(parentDir, fileName);
        
        if (options.recursive) {
            return _.rmrf(uri.fsPath);
        }
        return _.unlink(uri.fsPath);
    }

    rename(
        oldUri: vscode.Uri,
        newUri: vscode.Uri,
        options: { overwrite: boolean }
    ): Thenable<void> {
        return this._rename(oldUri, newUri, options);
    }
    async _rename(
        oldUri: vscode.Uri,
        newUri: vscode.Uri,
        options: { overwrite: boolean }
    ): Promise<void> {
        const oldParentDir = this.getDirectoryPath(oldUri.fsPath);
        const newParentDir = this.getDirectoryPath(newUri.fsPath);
        const oldFileName = this.getFileName(oldUri.fsPath);
        const newFileName = this.getFileName(newUri.fsPath);
        
        const exists = await _.exists(newUri.fsPath);
        if (exists) {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            } else {
                await _.rmrf(newUri.fsPath);
                // 目标存在且被覆盖时，从目标排序中移除
                await this.updateSortOrderOnDelete(newParentDir, newFileName);
            }
        }
        
        const parentExists = await _.exists(path.dirname(newUri.fsPath));
        if (!parentExists) {
            await _.mkdir(path.dirname(newUri.fsPath));
        }
        
        // 执行重命名/移动
        await _.rename(oldUri.fsPath, newUri.fsPath);
        
        // 重命名/移动后更新排序
        await this.updateSortOrderOnRename(oldParentDir, oldFileName, newParentDir, newFileName);
        
        // 刷新视图
        this.refresh();
    }
    
    // 重命名/移动后更新排序信息
    private async updateSortOrderOnRename(oldParentDir: string, oldFileName: string, 
                                         newParentDir: string, newFileName: string): Promise<void> {
        // 从源目录排序中移除
        if (this.sortOrderMap.has(oldParentDir)) {
            const sourceOrder = this.sortOrderMap.get(oldParentDir) || [];
            const newSourceOrder = sourceOrder.filter(name => name !== oldFileName);
            await this.saveSortOrder(oldParentDir, newSourceOrder);
        }
        
        // 如果是移动到其他目录
        if (oldParentDir !== newParentDir) {
            // 获取目标目录下所有项目
            const entries = await this.readDirectory(vscode.Uri.file(newParentDir));
            let items = entries.map(entry => entry[0]);
            
            // 确保新文件名在排序列表中
            if (!items.includes(newFileName)) {
                items.push(newFileName);
                await this.saveSortOrder(newParentDir, items);
            }
        } 
        // 如果是重命名但仍在同一目录
        else if (oldFileName !== newFileName) {
            const order = this.sortOrderMap.get(oldParentDir) || [];
            const index = order.indexOf(oldFileName);
            if (index !== -1) {
                // 替换旧名称为新名称
                order[index] = newFileName;
                await this.saveSortOrder(oldParentDir, order);
            } else {
                // 如果旧名称不在列表中，添加新名称到末尾
                order.push(newFileName);
                await this.saveSortOrder(oldParentDir, order);
            }
        }
    }
    
    // 在删除项目时更新排序信息
    private async updateSortOrderOnDelete(parentDir: string, fileName: string): Promise<void> {
        if (this.sortOrderMap.has(parentDir)) {
            const order = this.sortOrderMap.get(parentDir) || [];
            const newOrder = order.filter(name => name !== fileName);
            await this.saveSortOrder(parentDir, newOrder);
        }
    }
    
    readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return _.readfile(uri.fsPath);
    }
    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Thenable<void> {
        return this._writeFile(uri.fsPath, content, options);
    }
    async _writeFile(fsPath: string, content: Uint8Array, options: { create: boolean; overwrite: boolean; }) {
        const exists = await _.exists(fsPath);
        if (!exists) {
            if (!options.create) {
                throw vscode.FileSystemError.FileNotFound();
            }
            await _.mkdir(path.dirname(fsPath));
        } else {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            }
        } 
        return _.writefile(fsPath, content as Buffer);
        
    } 
    getDirectoryPath(path: string): string {
        if(isWinOS()) {
            return path.slice(0, path.lastIndexOf('\\'));
        }
        return path.slice(0, path.lastIndexOf('/'));
    }
    stringToUnit8Array(s: string): Uint8Array {
        return Uint8Array.from(Buffer.from(s));
    }
    // tree data provider
    // 获取子树
    async getChildren(element?: Entry): Promise<Entry[]> {
        let uri: vscode.Uri = element ? element.uri : this.rootUri;

        // 没有element 就是根目录 创建根目录
        if (!element && !(await _.exists(uri.fsPath))) {
            this.createDirectory(this.rootUri);
            return [];
        }
        const children = await this.readDirectory(uri);
        
        // 检查是否有自定义排序
        const folderPath = uri.fsPath;
        const customOrder = this.sortOrderMap.get(folderPath);
        
        if (customOrder && customOrder.length > 0) {
            // 使用自定义排序
            children.sort((a, b) => {
                const aName = a[0];
                const bName = b[0];
                const aIndex = customOrder.indexOf(aName);
                const bIndex = customOrder.indexOf(bName);
                
                // 如果两者都在排序列表中，根据列表顺序排序
                if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex;
                }
                
                // 只有一个在排序列表中，排序列表中的项目优先
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                
                // 都不在排序列表中，按默认规则排序
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }
                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });
        } else {
            // 默认排序：文件夹在前，同类型按名称排序
            children.sort((a, b) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }
                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });
        }
        
        return children
            .filter(([name, type]) => {
                // 过滤掉隐藏文件，如.order文件
                if (name.startsWith('.')) {
                    return false;
                }
                return this.isJson(name) || type === vscode.FileType.Directory;
            })
            .map(([name, type]) => {
                return {
                    uri: vscode.Uri.file(path.join(uri.fsPath, name)),
                    type
                };
            });
    }
    // 每个节点处理
    getTreeItem(element: Entry): vscode.TreeItem {
        const isDirectory = element.type === vscode.FileType.Directory;
        let label = this.getFileName(element.uri.fsPath);
        let tooltip = '';
        let description = '';
        let time = '';
        if (!isDirectory) {
            try {
                const command: Command = JSON.parse(
                    fs.readFileSync(element.uri.fsPath, 'utf8')
                );
                if (command.script === undefined) {
                    throw new Error('unknown data');
                }
                label = (command.label ? command.label : command.script);
                tooltip = command.script;
                description =
                    command.script !== command.label ? command.script : '';
            } catch (error) {
                label = '';
            }
        }
        const treeItem = new vscode.TreeItem(
            label,
            isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );
        if (element.type === vscode.FileType.File) {
            treeItem.command = {
                command: `${this.viewId}.edit`,
                title: 'Edit',
                arguments: [element]
            };
            treeItem.contextValue = 'file';
            treeItem.description = description;
            treeItem.tooltip = tooltip;
        }
        return treeItem;
    }
    isJson(path: string): boolean {
        const index = path.lastIndexOf('.json');
        if (index === -1) {
            return false;
        }
        return path.length - index === 5;
    }
    
    // 声明拖放处理器的接受类型
    public readonly dropMimeTypes = ['application/vnd.code.tree.CommandHub'];
    public readonly dragMimeTypes = ['application/vnd.code.tree.CommandHub'];
    
    // 处理拖动操作开始
    public handleDrag(source: readonly Entry[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void {
        console.log('Starting drag operation', source);
        
        // 使用字符串而不是对象，避免序列化问题
        const sourcePaths = source.map(entry => ({
            uri: entry.uri.toString(),
            type: entry.type
        }));
        
        // 使用简单的JSON字符串存储
        dataTransfer.set('application/vnd.code.tree.CommandHub', new vscode.DataTransferItem(JSON.stringify(sourcePaths)));
    }
    
    // 处理放置操作
    public async handleDrop(target: Entry | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        console.log('Handling drop operation', target ? target.uri.fsPath : 'root');
        
        const transferItem = dataTransfer.get('application/vnd.code.tree.CommandHub');
        if (!transferItem) {
            console.log('No transfer item found');
            return;
        }
        
        try {
            // 从JSON字符串恢复
            const sourcePaths = JSON.parse(transferItem.value as string);
            console.log('Parsing transfer item content', sourcePaths);
            
            if (!sourcePaths || sourcePaths.length === 0 || token.isCancellationRequested) {
                console.log('Source is empty or operation cancelled');
                return;
            }
            
            // 重新构建Entry对象
            const sources: Entry[] = sourcePaths.map((item: any) => ({
                uri: vscode.Uri.parse(item.uri),
                type: item.type
            }));
            
            await this.handleFileSystemDrop(sources, target);
            
            // 刷新视图以显示变更
            this.refresh();
        } catch (e) {
            console.error('Drop error:', e);
            vscode.window.showErrorMessage(`Drop operation failed: ${e}`);
        }
    }
    
    // 处理文件系统拖放操作
    private async handleFileSystemDrop(sources: Entry[], target: Entry | undefined): Promise<void> {
        console.log('Handling file system drop:', sources, target ? target.uri.fsPath : 'root');
        
        // 确定目标目录
        const targetDir = !target ? this.rootUri.fsPath : 
                         target.type === vscode.FileType.Directory ? target.uri.fsPath : 
                         this.getDirectoryPath(target.uri.fsPath);
                         
        // 先收集当前目录下所有项目的名称
        const currentEntries = await this.readDirectory(vscode.Uri.file(targetDir));
        let currentOrder = currentEntries.map(entry => entry[0])
                                        .filter(name => !name.startsWith('.'));
        
        // 创建新的排序列表
        let newOrder: string[] = [...currentOrder]; // 复制当前排序
        
        for (const source of sources) {
            // 跳过无效的拖拽操作
            if (!source.uri) {
                continue;
            }
            
            // 确定来源目录
            const sourceDir = this.getDirectoryPath(source.uri.fsPath);
            const fileName = this.getFileName(source.uri.fsPath);
            
            // 构建新路径
            const newPath = path.join(targetDir, fileName);
            
            // 如果不是同一个目录，处理移动操作
            if (sourceDir !== targetDir) {
                // 跳过拖到自己的情况
                if (source.uri.fsPath === newPath) {
                    continue;
                }
                
                // 如果目标路径已存在，请求用户确认
                if (await _.exists(newPath)) {
                    const response = await vscode.window.showWarningMessage(
                        `目标位置已存在 "${fileName}"，是否覆盖?`,
                        '覆盖',
                        '取消'
                    );
                    
                    if (response !== '覆盖') {
                        continue;
                    }
                    // 如果是覆盖，先删除目标
                    await this.delete(vscode.Uri.file(newPath), { recursive: true });
                }
                
                // 移动文件或目录
                await this.rename(source.uri, vscode.Uri.file(newPath), { overwrite: true });
                
                // 添加到新目录的排序列表末尾
                if (!newOrder.includes(fileName)) {
                    newOrder.push(fileName);
                }
            } 
            else if (target && target.type === vscode.FileType.File) {
                // 同一目录内的排序情况 - 将源文件移动到目标文件位置
                const targetFileName = this.getFileName(target.uri.fsPath);
                
                // 如果源文件和目标文件相同，跳过
                if (fileName === targetFileName) {
                    continue;
                }
                
                // 从新排序中移除源文件
                newOrder = newOrder.filter(name => name !== fileName);
                
                // 找到目标文件位置
                const targetIndex = newOrder.indexOf(targetFileName);
                if (targetIndex !== -1) {
                    // 插入源文件到目标文件位置
                    newOrder.splice(targetIndex, 0, fileName);
                } else {
                    // 如果找不到目标文件，添加到末尾
                    newOrder.push(fileName);
                }
                
                console.log('Sort updated:', fileName, 'moved to', targetFileName, 'before');
                console.log('New sort:', newOrder);
            }
        }
        
        // 保存新的排序信息
        await this.saveSortOrder(targetDir, newOrder);
        
        // 强制刷新视图
        setTimeout(() => this.refresh(), 100);
    }
}
