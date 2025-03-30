import * as vscode from 'vscode';
import { ShellType } from '../type/common';

// 侧边栏item父类
class SideBarEntryItem extends vscode.TreeItem {
    constructor(
        public readonly label: string, // 标签
        public readonly collapsibleState: vscode.TreeItemCollapsibleState, // 可折叠状态
        public readonly path?: string,
        public readonly projectName?: string,
        public readonly description?: string,
        public readonly shell?: ShellType | string,
        public readonly contextValue?: string,
        
    ) {
        super(label, collapsibleState);
        this.path = `${path}`;
        this.tooltip = `tip: ${label}`;
        this.projectName = `${projectName}`;
        this.description = `${description || ''}`;
        this.shell = shell;
        // package.json的memu view/item/context  -> when条件判断用
        this.contextValue = contextValue;
    }
}

// 侧边栏入口抽象类
abstract class SideBarEntryListImplements implements vscode.TreeDataProvider<SideBarEntryItem> {
    abstract getChildren(element?: SideBarEntryItem): vscode.ProviderResult<SideBarEntryItem[]>;
    getTreeItem(element: SideBarEntryItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
}

export { SideBarEntryItem, SideBarEntryListImplements };