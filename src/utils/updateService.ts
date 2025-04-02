import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { configManager } from './configuration';
import { compareVersions } from './version';

export interface ReleaseInfo {
    version: string;
    releaseDate: string;
    downloadUrl: string;
    description: string;
    requires: string;
    isPrerelease: boolean;
    changelog: string[];
}

export interface UpdateCheckResult {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseInfo?: ReleaseInfo;
    error?: string;
}

export class UpdateService {
    private static instance: UpdateService;
    private context: vscode.ExtensionContext | undefined;
    private currentVersion: string = '0.0.0';
    private lastCheckTime: Date | null = null;
    private checkInProgress: boolean = false;
    private updateAvailable: boolean = false;
    private latestReleaseInfo: ReleaseInfo | null = null;
    private statusBarItem: vscode.StatusBarItem | undefined;
    private updateCheckInterval: NodeJS.Timeout | undefined;
    private readonly RELEASE_API_URL = 'https://api.github.com/repos/user/commandhub/releases';
    private readonly LAST_DISMISSED_VERSION_KEY = 'lastDismissedUpdateVersion';
    private readonly UPDATE_CHECK_INTERVAL_MS = 86400000; // 24 hours

    private constructor() {}

    public static getInstance(): UpdateService {
        if (!UpdateService.instance) {
            UpdateService.instance = new UpdateService();
        }
        return UpdateService.instance;
    }

    public initialize(context: vscode.ExtensionContext, currentVersion: string): void {
        this.context = context;
        this.currentVersion = currentVersion;
        this.lastCheckTime = null;

        // Create status bar item if enabled
        if (configManager.get<boolean>('showUpdateNotification', true)) {
            this.createStatusBarItem();
        }

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('CommandHub.checkForUpdates', () => this.checkForUpdates(true)),
            vscode.commands.registerCommand('CommandHub.showChangelog', () => this.showChangelog()),
            vscode.commands.registerCommand('CommandHub.dismissUpdate', () => this.dismissUpdate())
        );

        // Configuration change handler
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('CommandHub.showUpdateNotification')) {
                    const showNotification = configManager.get<boolean>('showUpdateNotification', true);
                    if (showNotification) {
                        this.createStatusBarItem();
                        if (this.updateAvailable) {
                            this.showUpdateAvailable();
                        }
                    } else {
                        this.hideStatusBarItem();
                    }
                }
                
                if (e.affectsConfiguration('CommandHub.checkForUpdatesAutomatically')) {
                    this.setupAutomaticUpdateCheck();
                }
            })
        );

        // Setup automatic update check if enabled
        this.setupAutomaticUpdateCheck();

        // Check for updates on startup if enabled
        if (configManager.get<boolean>('checkForUpdatesOnStartup', true)) {
            this.checkForUpdates(false);
        }
    }

    private setupAutomaticUpdateCheck(): void {
        // Clear any existing interval
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval);
            this.updateCheckInterval = undefined;
        }

        const checkAutomatically = configManager.get<boolean>('checkForUpdatesAutomatically', true);
        if (checkAutomatically) {
            this.updateCheckInterval = setInterval(() => {
                this.checkForUpdates(false);
            }, this.UPDATE_CHECK_INTERVAL_MS);
        }
    }

    private createStatusBarItem(): void {
        if (this.statusBarItem) {
            return;
        }

        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'CommandHub.showChangelog';
        
        if (this.context) {
            this.context.subscriptions.push(this.statusBarItem);
        }
    }

    private hideStatusBarItem(): void {
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    private showUpdateAvailable(): void {
        if (!this.statusBarItem || !this.latestReleaseInfo) {
            return;
        }

        this.statusBarItem.text = `$(cloud-download) CommandHub v${this.latestReleaseInfo.version}`;
        this.statusBarItem.tooltip = `CommandHub update available. Click to see changes.`;
        this.statusBarItem.show();
    }

    public async checkForUpdates(showNotification: boolean = false): Promise<UpdateCheckResult> {
        if (this.checkInProgress) {
            return {
                hasUpdate: this.updateAvailable,
                currentVersion: this.currentVersion,
                latestVersion: this.latestReleaseInfo?.version || this.currentVersion,
                releaseInfo: this.latestReleaseInfo || undefined,
                error: 'Check already in progress'
            };
        }

        this.checkInProgress = true;

        try {
            const releases = await this.fetchReleases();
            
            if (!releases || releases.length === 0) {
                this.checkInProgress = false;
                return {
                    hasUpdate: false,
                    currentVersion: this.currentVersion,
                    latestVersion: this.currentVersion,
                    error: 'No releases found'
                };
            }

            const stableReleases = releases.filter(release => !release.isPrerelease);
            const includePrerelease = configManager.get<boolean>('includePrerelease', false);
            const latestRelease = includePrerelease ? releases[0] : stableReleases[0];

            if (!latestRelease) {
                this.checkInProgress = false;
                return {
                    hasUpdate: false,
                    currentVersion: this.currentVersion,
                    latestVersion: this.currentVersion,
                    error: 'No suitable releases found'
                };
            }

            const hasUpdate = compareVersions(latestRelease.version, this.currentVersion) > 0;
            this.updateAvailable = hasUpdate;
            this.latestReleaseInfo = latestRelease;
            this.lastCheckTime = new Date();

            if (hasUpdate) {
                const lastDismissedVersion = this.context?.globalState.get<string>(this.LAST_DISMISSED_VERSION_KEY) || '0.0.0';
                const wasAlreadyDismissed = compareVersions(lastDismissedVersion, latestRelease.version) >= 0;
                
                if (showNotification && !wasAlreadyDismissed) {
                    this.notifyUpdate(latestRelease);
                }

                // Show update in status bar if enabled
                if (configManager.get<boolean>('showUpdateNotification', true)) {
                    this.showUpdateAvailable();
                }
            } else {
                this.hideStatusBarItem();
                
                if (showNotification) {
                    vscode.window.showInformationMessage(`CommandHub is up to date (v${this.currentVersion}).`);
                }
            }

            this.checkInProgress = false;
            return {
                hasUpdate,
                currentVersion: this.currentVersion,
                latestVersion: latestRelease.version,
                releaseInfo: latestRelease
            };
        } catch (error) {
            this.checkInProgress = false;
            
            if (showNotification) {
                vscode.window.showErrorMessage(`Failed to check for updates: ${error}`);
            }
            
            return {
                hasUpdate: false,
                currentVersion: this.currentVersion,
                latestVersion: this.currentVersion,
                error: `${error}`
            };
        }
    }

    private async fetchReleases(): Promise<ReleaseInfo[]> {
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'User-Agent': 'CommandHub-VSCode-Extension'
                }
            };

            const req = https.get(this.RELEASE_API_URL, options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP Error: ${res.statusCode} - ${res.statusMessage}`));
                        return;
                    }
                    
                    try {
                        const releaseData = JSON.parse(data);
                        const releases: ReleaseInfo[] = releaseData.map((release: any) => ({
                            version: release.tag_name.replace(/^v/, ''),
                            releaseDate: release.published_at,
                            downloadUrl: release.assets[0]?.browser_download_url || '',
                            description: release.body,
                            requires: '',
                            isPrerelease: release.prerelease,
                            changelog: this.parseChangelog(release.body)
                        }));
                        
                        resolve(releases);
                    } catch (error) {
                        reject(new Error(`Failed to parse release data: ${error}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Network error: ${error.message}`));
            });
            
            req.end();
        });
    }

    private parseChangelog(body: string): string[] {
        if (!body) {
            return [];
        }
        
        const lines = body.split('\n');
        const changelog: string[] = [];
        
        let isInChangelog = false;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.toLowerCase().startsWith('## changelog') || 
                trimmedLine.toLowerCase().startsWith('### changelog')) {
                isInChangelog = true;
                continue;
            }
            
            if (isInChangelog && trimmedLine.startsWith('##')) {
                isInChangelog = false;
                break;
            }
            
            if (isInChangelog && trimmedLine.startsWith('- ')) {
                changelog.push(trimmedLine.substring(2));
            }
        }
        
        return changelog;
    }

    private notifyUpdate(release: ReleaseInfo): void {
        const message = `CommandHub v${release.version} is available (current: v${this.currentVersion})`;
        
        vscode.window.showInformationMessage(message, 'View Changes', 'Update Now', 'Dismiss')
            .then(selection => {
                if (selection === 'View Changes') {
                    this.showChangelog();
                } else if (selection === 'Update Now') {
                    vscode.commands.executeCommand('workbench.extensions.installExtension', 'CommandHub');
                } else if (selection === 'Dismiss') {
                    this.dismissUpdate();
                }
            });
    }

    public showChangelog(): void {
        if (!this.latestReleaseInfo) {
            vscode.window.showInformationMessage('No update information available.');
            return;
        }
        
        const changelog = this.latestReleaseInfo.changelog;
        const version = this.latestReleaseInfo.version;
        
        // Create a temporary markdown file with the changelog
        const tempDir = this.context?.globalStorageUri.fsPath || os.tmpdir();
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const changelogPath = path.join(tempDir, 'commandhub-changelog.md');
        
        let content = `# CommandHub v${version} Changelog\n\n`;
        
        if (changelog.length > 0) {
            content += changelog.map(item => `- ${item}`).join('\n');
        } else {
            content += `No detailed changelog available for this version.\n\n`;
            content += `Release notes:\n\n${this.latestReleaseInfo.description}`;
        }
        
        fs.writeFileSync(changelogPath, content, 'utf8');
        
        // Open the changelog file
        vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(changelogPath));
    }

    public dismissUpdate(): void {
        if (this.latestReleaseInfo && this.context) {
            this.context.globalState.update(this.LAST_DISMISSED_VERSION_KEY, this.latestReleaseInfo.version);
            this.hideStatusBarItem();
        }
    }

    public dispose(): void {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval);
        }
        
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
    }
}

export const updateService = UpdateService.getInstance(); 