import * as vscode from 'vscode';
import { PREFIX } from '../constants';
import { FolderType, ShellType } from '../type/common';
import { trim } from '../utils';
import { getShell, hasFile, readFile } from '../utils/package';
import { SideBarEntryItem, SideBarEntryListImplements } from './SideBar';



// 实现侧边栏
export default class SideBarCommand extends SideBarEntryListImplements {
    constructor(private folderPathList: FolderType[] | undefined) {
        super();
    }
    // 获取子树方式
    async getChildren(element?: SideBarEntryItem): Promise<SideBarEntryItem[] | null | undefined> {
        console.log('SideBarCommand.getChildren called for:', element);
        if (element) {
            let childElement:any = [];
            const packJsonPath = `${element.path}/package.json`;
            const hasPackageJson = await hasFile(packJsonPath);
            // 如果有packjson
            if (hasPackageJson) {
                const packageValue = readFile(packJsonPath);
                // 有script
                if (packageValue?.scripts) {
                    let shellList: ShellType[] = [];
                    shellList = getShell(packageValue.scripts);
                    if (!!shellList.length) {
                        shellList.forEach((shell: ShellType, index: number) => {
                            const node = getNode(shell.key, {
                                title: shell,
                                path: element.path,
                                projectName: element.projectName,
                                description: shell.value,
                                shell,
                                contextValue: 'child'
                            });
                            childElement[index] = node;
                        });
                    } else {
                        const noneNode = getNode(`[${PREFIX}]: 😥 script command does not meet the rules`);
                        childElement = [noneNode];
                    }
                } else {
                    const noneNode = getNode(`[${PREFIX}]: 😞 no script commands`);
                    childElement = [noneNode];
                }
            } else {
                const noneNode = getNode(`[${PREFIX}]: 😅 project does not exist package.json`);
                childElement = [noneNode];
            }
            return childElement;
        } else {
            const itemCollapsibleState: boolean = vscode.workspace.getConfiguration().get('CommandHub.TreeItemCollapsibleState') || false;
            // 根命令目录是否折叠
            const treeItemCollapsibleState: number = itemCollapsibleState ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded;
            
            const folderNode = this.folderPathList?.map((folder: FolderType) => {
                return new SideBarEntryItem(
                    folder.name, 
                    treeItemCollapsibleState,
                    folder.path,
                    folder.name,
                    '',
                    '',
                    'parent'
                );
            }) || [];
            return folderNode;
        }
    }

    getTreeItem(element: any): vscode.TreeItem {
        console.log('SideBarCommand.getTreeItem called for:', element);
        let node = new SideBarEntryItem(
            element.title,
            vscode.TreeItemCollapsibleState.None, // 不折叠
            element.path, // Todo
            element.projectName,
            element.description,
            element.shell,
            element.contextValue
        );
        return node;
    }
}

// 获取节点
function getNode(title: string, args?:{[key: string]: any}) {
    let node = new SideBarEntryItem(
        title,
        vscode.TreeItemCollapsibleState.None, // 不折叠
        args?.path, // Todo
        args?.projectName,
        args?.description,
        args?.shell,
        args?.contextValue
    );
    return node;
}