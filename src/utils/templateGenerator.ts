import * as os from 'os';
import { ShellType } from '../type/common';
import { configManager } from './configuration';

export interface CommandTemplateOptions {
    type?: CommandTemplateType;
    name?: string;
    description?: string;
    platform?: 'windows' | 'linux' | 'macos' | 'all';
    shell?: ShellType;
    addPlaceholders?: boolean;
    category?: string;
    tags?: string[];
}

export type CommandTemplateType = 
    'basic' | 
    'git' | 
    'docker' | 
    'npm' | 
    'yarn' | 
    'pnpm' | 
    'python' | 
    'bash' | 
    'powershell' | 
    'kubernetes' | 
    'ssh' | 
    'custom';

export interface CommandTemplate {
    name: string;
    description: string;
    script: string;
    platform?: string;
    shell: ShellType;
    category?: string;
    tags?: string[];
}

/**
 * 命令模板生成器
 */
export class TemplateGenerator {
    private static instance: TemplateGenerator;

    private constructor() {}

    public static getInstance(): TemplateGenerator {
        if (!TemplateGenerator.instance) {
            TemplateGenerator.instance = new TemplateGenerator();
        }
        return TemplateGenerator.instance;
    }

    /**
     * 获取命令模板类型列表
     */
    public getTemplateTypes(): { value: CommandTemplateType; label: string }[] {
        return [
            { value: 'basic', label: '基本命令' },
            { value: 'git', label: 'Git 命令' },
            { value: 'docker', label: 'Docker 命令' },
            { value: 'npm', label: 'NPM 命令' },
            { value: 'yarn', label: 'Yarn 命令' },
            { value: 'pnpm', label: 'PNPM 命令' },
            { value: 'python', label: 'Python 命令' },
            { value: 'bash', label: 'Bash 脚本' },
            { value: 'powershell', label: 'PowerShell 脚本' },
            { value: 'kubernetes', label: 'Kubernetes 命令' },
            { value: 'ssh', label: 'SSH 命令' },
            { value: 'custom', label: '自定义命令' }
        ];
    }

    /**
     * 根据模板类型和选项生成命令模板
     */
    public generateTemplate(options: CommandTemplateOptions): CommandTemplate {
        const type = options.type || 'basic';
        const addPlaceholders = options.addPlaceholders ?? true;
        
        // 根据模板类型获取基本模板
        let template: CommandTemplate;

        switch (type) {
            case 'git':
                template = this.getGitTemplate(addPlaceholders);
                break;
            case 'docker':
                template = this.getDockerTemplate(addPlaceholders);
                break;
            case 'npm':
                template = this.getNpmTemplate(addPlaceholders);
                break;
            case 'yarn':
                template = this.getYarnTemplate(addPlaceholders);
                break;
            case 'pnpm':
                template = this.getPnpmTemplate(addPlaceholders);
                break;
            case 'python':
                template = this.getPythonTemplate(addPlaceholders);
                break;
            case 'bash':
                template = this.getBashTemplate(addPlaceholders);
                break;
            case 'powershell':
                template = this.getPowershellTemplate(addPlaceholders);
                break;
            case 'kubernetes':
                template = this.getKubernetesTemplate(addPlaceholders);
                break;
            case 'ssh':
                template = this.getSshTemplate(addPlaceholders);
                break;
            case 'custom':
                template = this.getCustomTemplate();
                break;
            case 'basic':
            default:
                template = this.getBasicTemplate(addPlaceholders);
                break;
        }

        // 应用用户提供的选项
        if (options.name) {
            template.name = options.name;
        }
        
        if (options.description) {
            template.description = options.description;
        }
        
        if (options.platform) {
            template.platform = options.platform;
        }
        
        if (options.shell) {
            template.shell = options.shell;
        }
        
        if (options.category) {
            template.category = options.category;
        }
        
        if (options.tags) {
            template.tags = options.tags;
        }

        return template;
    }

    /**
     * 基本命令模板
     */
    private getBasicTemplate(addPlaceholders: boolean): CommandTemplate {
        const script = addPlaceholders ? 'echo "Hello, ${name}!"' : 'echo "Hello, World!"';
        
        return {
            name: '基本命令',
            description: '这是一个基本的命令模板',
            script,
            shell: this.getDefaultShell()
        };
    }

    /**
     * Git 命令模板
     */
    private getGitTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `# 从远程仓库获取最新变更
git fetch origin

# 切换到分支
git checkout ${branch}

# 拉取最新变更
git pull origin ${branch}

# 查看状态
git status`;
        } else {
            script = `# 从远程仓库获取最新变更
git fetch origin

# 切换到分支
git checkout main

# 拉取最新变更
git pull origin main

# 查看状态
git status`;
        }
        
        return {
            name: 'Git 命令',
            description: '常用的 Git 操作',
            script,
            shell: this.getDefaultShell(),
            tags: ['git', 'version-control']
        };
    }

    /**
     * Docker 命令模板
     */
    private getDockerTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `# 拉取镜像
docker pull ${image}:${tag}

# 运行容器
docker run -d --name ${containerName} -p ${hostPort}:${containerPort} ${image}:${tag}

# 查看运行中的容器
docker ps`;
        } else {
            script = `# 拉取镜像
docker pull nginx:latest

# 运行容器
docker run -d --name my-nginx -p 8080:80 nginx:latest

# 查看运行中的容器
docker ps`;
        }
        
        return {
            name: 'Docker 命令',
            description: '常用的 Docker 操作',
            script,
            shell: this.getDefaultShell(),
            tags: ['docker', 'container']
        };
    }

    /**
     * NPM 命令模板
     */
    private getNpmTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `# 安装依赖
npm install ${dependencies}

# 安装开发依赖
npm install --save-dev ${devDependencies}

# 运行脚本
npm run ${scriptName}`;
        } else {
            script = `# 安装依赖
npm install

# 安装指定依赖
npm install express

# 安装开发依赖
npm install --save-dev typescript

# 运行脚本
npm run start`;
        }
        
        return {
            name: 'NPM 命令',
            description: '常用的 NPM 包管理操作',
            script,
            shell: this.getDefaultShell(),
            tags: ['npm', 'node', 'package-manager']
        };
    }

    /**
     * Yarn 命令模板
     */
    private getYarnTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `# 安装依赖
yarn

# 添加依赖
yarn add ${dependencies}

# 添加开发依赖
yarn add --dev ${devDependencies}

# 运行脚本
yarn ${scriptName}`;
        } else {
            script = `# 安装依赖
yarn

# 添加依赖
yarn add react react-dom

# 添加开发依赖
yarn add --dev webpack

# 运行脚本
yarn start`;
        }
        
        return {
            name: 'Yarn 命令',
            description: '常用的 Yarn 包管理操作',
            script,
            shell: this.getDefaultShell(),
            tags: ['yarn', 'node', 'package-manager']
        };
    }

    /**
     * PNPM 命令模板
     */
    private getPnpmTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `# 安装依赖
pnpm install

# 添加依赖
pnpm add ${dependencies}

# 添加开发依赖
pnpm add -D ${devDependencies}

# 运行脚本
pnpm ${scriptName}`;
        } else {
            script = `# 安装依赖
pnpm install

# 添加依赖
pnpm add vue

# 添加开发依赖
pnpm add -D vite

# 运行脚本
pnpm dev`;
        }
        
        return {
            name: 'PNPM 命令',
            description: '常用的 PNPM 包管理操作',
            script,
            shell: this.getDefaultShell(),
            tags: ['pnpm', 'node', 'package-manager']
        };
    }

    /**
     * Python 命令模板
     */
    private getPythonTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `# 创建虚拟环境
python -m venv ${envName}

# 激活虚拟环境
${this.isPowerShell() ? `.\\${envName}\\Scripts\\Activate.ps1` : `source ${envName}/bin/activate`}

# 安装依赖
pip install -r requirements.txt

# 运行 Python 脚本
python ${scriptName}.py`;
        } else {
            script = `# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
${this.isPowerShell() ? `.\\venv\\Scripts\\Activate.ps1` : `source venv/bin/activate`}

# 安装依赖
pip install -r requirements.txt

# 运行 Python 脚本
python main.py`;
        }
        
        return {
            name: 'Python 命令',
            description: '常用的 Python 环境和脚本操作',
            script,
            shell: this.getDefaultShell(),
            tags: ['python', 'venv']
        };
    }

    /**
     * Bash 脚本模板
     */
    private getBashTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `#!/bin/bash

# 变量定义
NAME="${name}"
COUNT=${count}

# 函数定义
function greet() {
    echo "Hello, $1!"
}

# 条件语句
if [ $COUNT -gt 10 ]; then
    echo "Count is greater than 10"
else
    echo "Count is less than or equal to 10"
fi

# 循环
for i in {1..5}; do
    greet "$NAME $i"
done`;
        } else {
            script = `#!/bin/bash

# 变量定义
NAME="World"
COUNT=5

# 函数定义
function greet() {
    echo "Hello, $1!"
}

# 条件语句
if [ $COUNT -gt 10 ]; then
    echo "Count is greater than 10"
else
    echo "Count is less than or equal to 10"
fi

# 循环
for i in {1..5}; do
    greet "$NAME $i"
done`;
        }
        
        return {
            name: 'Bash 脚本',
            description: 'Bash 脚本示例',
            script,
            shell: 'bash',
            platform: 'linux',
            tags: ['bash', 'shell', 'script']
        };
    }

    /**
     * PowerShell 脚本模板
     */
    private getPowershellTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `# 变量定义
$Name = "${name}"
$Count = ${count}

# 函数定义
function Greet {
    param($Person)
    Write-Host "Hello, $Person!"
}

# 条件语句
if ($Count -gt 10) {
    Write-Host "Count is greater than 10"
} else {
    Write-Host "Count is less than or equal to 10"
}

# 循环
for ($i = 1; $i -le 5; $i++) {
    Greet "$Name $i"
}`;
        } else {
            script = `# 变量定义
$Name = "World"
$Count = 5

# 函数定义
function Greet {
    param($Person)
    Write-Host "Hello, $Person!"
}

# 条件语句
if ($Count -gt 10) {
    Write-Host "Count is greater than 10"
} else {
    Write-Host "Count is less than or equal to 10"
}

# 循环
for ($i = 1; $i -le 5; $i++) {
    Greet "$Name $i"
}`;
        }
        
        return {
            name: 'PowerShell 脚本',
            description: 'PowerShell 脚本示例',
            script,
            shell: 'powershell',
            platform: 'windows',
            tags: ['powershell', 'windows', 'script']
        };
    }

    /**
     * Kubernetes 命令模板
     */
    private getKubernetesTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `# 获取所有 Pod
kubectl get pods -n ${namespace}

# 描述 Pod
kubectl describe pod ${podName} -n ${namespace}

# 查看 Pod 日志
kubectl logs ${podName} -n ${namespace}

# 应用配置文件
kubectl apply -f ${configFile}.yaml

# 端口转发
kubectl port-forward ${podName} ${localPort}:${podPort} -n ${namespace}`;
        } else {
            script = `# 获取所有 Pod
kubectl get pods -n default

# 描述 Pod
kubectl describe pod my-pod -n default

# 查看 Pod 日志
kubectl logs my-pod -n default

# 应用配置文件
kubectl apply -f deployment.yaml

# 端口转发
kubectl port-forward my-pod 8080:80 -n default`;
        }
        
        return {
            name: 'Kubernetes 命令',
            description: '常用的 Kubernetes 操作',
            script,
            shell: this.getDefaultShell(),
            tags: ['kubernetes', 'k8s', 'container']
        };
    }

    /**
     * SSH 命令模板
     */
    private getSshTemplate(addPlaceholders: boolean): CommandTemplate {
        let script: string;
        
        if (addPlaceholders) {
            script = `# SSH 连接
ssh ${username}@${hostname}

# 使用私钥 SSH 连接
ssh -i ${keyPath} ${username}@${hostname}

# 端口转发
ssh -L ${localPort}:${remoteHost}:${remotePort} ${username}@${hostname}

# 传输文件
scp ${localFile} ${username}@${hostname}:${remotePath}

# 从远程获取文件
scp ${username}@${hostname}:${remoteFile} ${localPath}`;
        } else {
            script = `# SSH 连接
ssh user@example.com

# 使用私钥 SSH 连接
ssh -i ~/.ssh/id_rsa user@example.com

# 端口转发
ssh -L 8080:localhost:80 user@example.com

# 传输文件
scp local.txt user@example.com:~/

# 从远程获取文件
scp user@example.com:~/remote.txt ./`;
        }
        
        return {
            name: 'SSH 命令',
            description: '常用的 SSH 操作和文件传输',
            script,
            shell: this.getDefaultShell(),
            tags: ['ssh', 'network', 'remote']
        };
    }

    /**
     * 自定义命令模板
     */
    private getCustomTemplate(): CommandTemplate {
        const customTemplate = configManager.get<string>('customCommandTemplate', '');
        
        if (customTemplate.trim()) {
            return {
                name: '自定义命令',
                description: '用户自定义的命令模板',
                script: customTemplate,
                shell: this.getDefaultShell()
            };
        } else {
            return this.getBasicTemplate(false);
        }
    }

    /**
     * 获取当前系统的默认 shell 类型
     */
    private getDefaultShell(): ShellType {
        const configShell = configManager.get<string>('defaultShell', '');
        if (configShell) {
            return configShell as ShellType;
        }
        
        if (this.isPowerShell()) {
            return 'powershell';
        }
        
        return 'bash';
    }

    /**
     * 检查当前环境是否为 PowerShell
     */
    private isPowerShell(): boolean {
        const platform = os.platform();
        return platform === 'win32';
    }
}

export const templateGenerator = TemplateGenerator.getInstance(); 