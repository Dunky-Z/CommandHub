/**
 * 比较两个版本号字符串
 * @param version1 第一个版本号 (例如 "1.0.0")
 * @param version2 第二个版本号 (例如 "1.0.1")
 * @returns 如果 version1 > version2，返回 1；如果 version1 < version2，返回 -1；如果相等，返回 0
 */
export function compareVersions(version1: string, version2: string): number {
    if (version1 === version2) {
        return 0;
    }

    const parts1 = parseVersionString(version1);
    const parts2 = parseVersionString(version2);

    // 比较主要版本部分 (major.minor.patch)
    for (let i = 0; i < 3; i++) {
        if (parts1[i] > parts2[i]) {
            return 1;
        }
        if (parts1[i] < parts2[i]) {
            return -1;
        }
    }

    // 如果主要版本相同，检查预发布标识符
    if (parts1[3] === '' && parts2[3] !== '') {
        // 稳定版本大于预发布版本
        return 1;
    }
    if (parts1[3] !== '' && parts2[3] === '') {
        // 预发布版本小于稳定版本
        return -1;
    }
    if (parts1[3] !== '' && parts2[3] !== '') {
        // 比较预发布标识符
        return comparePreReleaseIdentifiers(parts1[3], parts2[3]);
    }

    // 如果所有部分都相同，版本相等
    return 0;
}

/**
 * 将版本号字符串解析为各个部分
 * @param version 版本号字符串，例如 "1.2.3-beta.1"
 * @returns 解析后的版本号部分 [major, minor, patch, preRelease]
 */
function parseVersionString(version: string): [number, number, number, string] {
    // 移除可能的前缀 'v'
    version = version.trim().replace(/^v/, '');

    // 将版本号分割为主要部分和预发布部分
    const [mainVersion, preRelease = ''] = version.split('-', 2);
    
    // 分割主要版本号
    const parts = mainVersion.split('.').map(Number);
    
    // 确保至少有3个部分（major, minor, patch）
    while (parts.length < 3) {
        parts.push(0);
    }
    
    return [
        parts[0] || 0,
        parts[1] || 0,
        parts[2] || 0,
        preRelease
    ];
}

/**
 * 比较两个预发布标识符
 * @param pre1 第一个预发布标识符，例如 "alpha.1"
 * @param pre2 第二个预发布标识符，例如 "beta.2"
 * @returns 比较结果：1, 0, 或 -1
 */
function comparePreReleaseIdentifiers(pre1: string, pre2: string): number {
    if (pre1 === pre2) {
        return 0;
    }
    
    const parts1 = pre1.split('.');
    const parts2 = pre2.split('.');
    
    // 预发布标识符优先级（从低到高）
    const identifierPriority: Record<string, number> = {
        'dev': 0,
        'alpha': 1,
        'a': 1,
        'beta': 2,
        'b': 2,
        'rc': 3,
        'pre': 3
    };
    
    // 比较第一个标识符（alpha、beta等）
    const id1 = parts1[0].toLowerCase();
    const id2 = parts2[0].toLowerCase();
    
    const priority1 = identifierPriority[id1] !== undefined ? identifierPriority[id1] : 99;
    const priority2 = identifierPriority[id2] !== undefined ? identifierPriority[id2] : 99;
    
    if (priority1 !== priority2) {
        return priority1 > priority2 ? 1 : -1;
    }
    
    // 如果第一个标识符相同，比较后续数字
    const len = Math.max(parts1.length, parts2.length);
    for (let i = 1; i < len; i++) {
        const p1 = i < parts1.length ? parts1[i] : '0';
        const p2 = i < parts2.length ? parts2[i] : '0';
        
        const num1 = parseInt(p1, 10);
        const num2 = parseInt(p2, 10);
        
        if (!isNaN(num1) && !isNaN(num2)) {
            // 都是数字
            if (num1 !== num2) {
                return num1 > num2 ? 1 : -1;
            }
        } else if (!isNaN(num1)) {
            // 只有p1是数字，数字小于字符串
            return -1;
        } else if (!isNaN(num2)) {
            // 只有p2是数字，数字小于字符串
            return 1;
        } else {
            // 都是字符串，按字母顺序比较
            const comp = p1.localeCompare(p2);
            if (comp !== 0) {
                return comp > 0 ? 1 : -1;
            }
        }
    }
    
    // 如果所有部分都相同，则版本相等
    return 0;
}

/**
 * 检查版本是否在指定的版本范围内
 * @param version 要检查的版本号
 * @param range 版本范围（例如 ">= 1.0.0 < 2.0.0"）
 * @returns 是否在范围内
 */
export function satisfiesVersion(version: string, range: string): boolean {
    // 解析范围表达式
    const rangeParts = range.split(/\s+/).filter(Boolean);
    
    for (let i = 0; i < rangeParts.length; i++) {
        const part = rangeParts[i];
        
        if (part === '||') {
            // 逻辑OR，前面的条件已满足，则整个表达式满足
            if (satisfiesVersion(version, rangeParts.slice(0, i).join(' '))) {
                return true;
            }
            // 否则检查后面的部分
            return satisfiesVersion(version, rangeParts.slice(i + 1).join(' '));
        }
    }
    
    // 处理所有AND条件
    return rangeParts.every(part => {
        if (part.startsWith('>=')) {
            const requiredVersion = part.substring(2).trim();
            return compareVersions(version, requiredVersion) >= 0;
        } else if (part.startsWith('>')) {
            const requiredVersion = part.substring(1).trim();
            return compareVersions(version, requiredVersion) > 0;
        } else if (part.startsWith('<=')) {
            const requiredVersion = part.substring(2).trim();
            return compareVersions(version, requiredVersion) <= 0;
        } else if (part.startsWith('<')) {
            const requiredVersion = part.substring(1).trim();
            return compareVersions(version, requiredVersion) < 0;
        } else if (part.startsWith('=') || part.match(/^\d/)) {
            // 精确匹配 (= 或无操作符)
            const requiredVersion = part.startsWith('=') ? part.substring(1).trim() : part.trim();
            return compareVersions(version, requiredVersion) === 0;
        } else if (part.startsWith('~')) {
            // 补丁版本兼容 (~1.2.3 意味着 >= 1.2.3 < 1.3.0)
            const baseVersion = part.substring(1).trim();
            const parsed = parseVersionString(baseVersion);
            
            const minVersion = baseVersion;
            const maxVersion = `${parsed[0]}.${parsed[1] + 1}.0`;
            
            return compareVersions(version, minVersion) >= 0 && compareVersions(version, maxVersion) < 0;
        } else if (part.startsWith('^')) {
            // 主版本兼容 (^1.2.3 意味着 >= 1.2.3 < 2.0.0)
            const baseVersion = part.substring(1).trim();
            const parsed = parseVersionString(baseVersion);
            
            const minVersion = baseVersion;
            const maxVersion = `${parsed[0] + 1}.0.0`;
            
            return compareVersions(version, minVersion) >= 0 && compareVersions(version, maxVersion) < 0;
        }
        
        // 不支持的操作符
        return false;
    });
}

/**
 * 检查版本号是否有效
 * @param version 要检查的版本号
 * @returns 是否是有效的版本号
 */
export function isValidVersion(version: string): boolean {
    if (!version) {
        return false;
    }
    
    // 移除可能的前缀 'v'
    version = version.trim().replace(/^v/, '');
    
    // 基本的 semver 格式: X.Y.Z 或 X.Y.Z-prerelease
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    
    return semverRegex.test(version);
}

/**
 * 增加版本号
 * @param version 当前版本号
 * @param releaseType 'major', 'minor', 'patch', 或 'prerelease'
 * @param prereleaseId 预发布标识符，例如 'alpha', 'beta' (仅当 releaseType 为 'prerelease' 时使用)
 * @returns 新的版本号
 */
export function incrementVersion(version: string, releaseType: 'major' | 'minor' | 'patch' | 'prerelease', prereleaseId?: string): string {
    const [major, minor, patch, preRelease] = parseVersionString(version);
    
    switch (releaseType) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        case 'prerelease': {
            if (!preRelease) {
                // 如果当前不是预发布版本，创建一个
                const preId = prereleaseId || 'beta';
                return `${major}.${minor}.${patch}-${preId}.1`;
            } else {
                // 已经是预发布版本，增加数字
                const parts = preRelease.split('.');
                const lastPart = parts[parts.length - 1];
                const num = parseInt(lastPart, 10);
                
                if (!isNaN(num)) {
                    // 最后一部分是数字，增加它
                    parts[parts.length - 1] = String(num + 1);
                    return `${major}.${minor}.${patch}-${parts.join('.')}`;
                } else {
                    // 最后一部分不是数字，添加.1
                    return `${major}.${minor}.${patch}-${preRelease}.1`;
                }
            }
        }
        default:
            return version; // 不支持的类型，返回原始版本
    }
}

/**
 * 解析版本范围并返回其组件
 * @param range 版本范围（例如 ">= 1.0.0 < 2.0.0"）
 * @returns 解析后的组件数组
 */
export function parseVersionRange(range: string): Array<{ operator: string; version: string }> {
    if (!range) {
        return [];
    }
    
    const parts = range.split(/\s+/).filter(Boolean);
    const result: Array<{ operator: string; version: string }> = [];
    
    for (const part of parts) {
        if (part === '||') {
            result.push({ operator: '||', version: '' });
            continue;
        }
        
        const match = part.match(/^([<>=~^]*)(.*)$/);
        if (match) {
            const [, operator, version] = match;
            result.push({ 
                operator: operator || '=', 
                version: version.trim() 
            });
        }
    }
    
    return result;
}

/**
 * 获取两个版本之间的差异类型
 * @param v1 第一个版本
 * @param v2 第二个版本
 * @returns 差异类型：'major', 'minor', 'patch', 'prerelease', 或 'none'
 */
export function getVersionDiff(v1: string, v2: string): 'major' | 'minor' | 'patch' | 'prerelease' | 'none' {
    const [major1, minor1, patch1, pre1] = parseVersionString(v1);
    const [major2, minor2, patch2, pre2] = parseVersionString(v2);
    
    if (major1 !== major2) {
        return 'major';
    }
    
    if (minor1 !== minor2) {
        return 'minor';
    }
    
    if (patch1 !== patch2) {
        return 'patch';
    }
    
    if (pre1 !== pre2) {
        return 'prerelease';
    }
    
    return 'none';
}