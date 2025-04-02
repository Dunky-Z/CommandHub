import * as vscode from 'vscode';

export interface FormField {
    id: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'password' | 'textarea';
    placeholder?: string;
    description?: string;
    default?: any;
    required?: boolean;
    options?: Array<{ value: any; label: string }>;
    validation?: RegExp | ((value: any) => boolean | string);
}

export interface FormOptions {
    title: string;
    width?: string;
    height?: string;
    cancelButtonText?: string;
    submitButtonText?: string;
    fields: FormField[];
}

export interface FormResult {
    submitted: boolean;
    values: Record<string, any>;
}

/**
 * 表单生成器
 */
export class FormGenerator {
    /**
     * 显示一个表单
     * @param options 表单选项
     */
    public static async showForm(options: FormOptions): Promise<FormResult> {
        // 创建 webview 面板
        const panel = vscode.window.createWebviewPanel(
            'commandHubForm',
            options.title,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [],
                retainContextWhenHidden: true
            }
        );

        // 设置面板大小
        if (options.width || options.height) {
            const width = options.width || '600px';
            const height = options.height || '400px';
            panel.webview.html = this.generateFormHtml(options, width, height);
        } else {
            panel.webview.html = this.generateFormHtml(options);
        }

        // 处理表单提交
        return new Promise<FormResult>((resolve) => {
            panel.webview.onDidReceiveMessage(
                (message) => {
                    if (message.command === 'formSubmit') {
                        panel.dispose();
                        resolve({
                            submitted: true,
                            values: message.data
                        });
                    } else if (message.command === 'formCancel') {
                        panel.dispose();
                        resolve({
                            submitted: false,
                            values: {}
                        });
                    }
                }
            );
        });
    }

    /**
     * 生成表单的 HTML
     */
    private static generateFormHtml(options: FormOptions, width: string = '600px', height: string = 'auto'): string {
        const { title, fields, cancelButtonText = '取消', submitButtonText = '提交' } = options;

        // 生成表单字段的 HTML
        const fieldsHtml = fields.map(field => this.generateFieldHtml(field)).join('\n');

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 16px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            max-width: ${width};
            margin: 0 auto;
        }
        .form-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .form-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        .form-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 12px;
        }
        .field-label {
            font-weight: bold;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
        }
        .required {
            color: var(--vscode-errorForeground);
            font-size: 12px;
        }
        .field-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        input[type="text"], 
        input[type="number"], 
        input[type="password"],
        textarea,
        select {
            padding: 6px 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: 14px;
        }
        input[type="text"]:focus, 
        input[type="number"]:focus, 
        input[type="password"]:focus,
        textarea:focus,
        select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        textarea {
            min-height: 80px;
            resize: vertical;
        }
        .checkbox-container {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .buttons {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 16px;
        }
        button {
            padding: 6px 12px;
            border: none;
            border-radius: 2px;
            font-size: 14px;
            cursor: pointer;
        }
        .button-cancel {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button-submit {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .button-cancel:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .button-submit:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .field-error {
            font-size: 12px;
            color: var(--vscode-errorForeground);
            margin-top: 4px;
            display: none;
        }
        .multiselect-options {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 6px;
        }
    </style>
</head>
<body>
    <div class="form-container">
        <div class="form-title">${title}</div>
        <form id="commandHubForm">
            ${fieldsHtml}
            
            <div class="buttons">
                <button type="button" class="button-cancel" id="cancelButton">${cancelButtonText}</button>
                <button type="submit" class="button-submit" id="submitButton">${submitButtonText}</button>
            </div>
        </form>
    </div>

    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            
            // 表单元素
            const form = document.getElementById('commandHubForm');
            const cancelButton = document.getElementById('cancelButton');
            
            // 处理表单提交
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // 验证表单
                const isValid = validateForm();
                if (!isValid) {
                    return;
                }
                
                // 收集表单数据
                const formData = {};
                const fields = ${JSON.stringify(fields)};
                
                fields.forEach(field => {
                    if (field.type === 'boolean') {
                        formData[field.id] = document.getElementById(field.id).checked;
                    } else if (field.type === 'multiselect') {
                        const selectedValues = [];
                        const checkboxes = document.querySelectorAll(\`input[name="\${field.id}"]:checked\`);
                        checkboxes.forEach(checkbox => {
                            selectedValues.push(checkbox.value);
                        });
                        formData[field.id] = selectedValues;
                    } else {
                        formData[field.id] = document.getElementById(field.id).value;
                    }
                });
                
                // 发送结果到扩展
                vscode.postMessage({
                    command: 'formSubmit',
                    data: formData
                });
            });
            
            // 处理取消按钮
            cancelButton.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'formCancel'
                });
            });
            
            // 表单验证
            function validateForm() {
                let isValid = true;
                const fields = ${JSON.stringify(fields)};
                
                fields.forEach(field => {
                    const element = document.getElementById(field.id);
                    const errorElement = document.getElementById(\`\${field.id}-error\`);
                    
                    if (!errorElement) {
                        return;
                    }
                    
                    // 重置错误
                    errorElement.style.display = 'none';
                    errorElement.textContent = '';
                    
                    // 检查必填字段
                    if (field.required) {
                        let value;
                        
                        if (field.type === 'boolean') {
                            value = element.checked;
                        } else if (field.type === 'multiselect') {
                            const checkboxes = document.querySelectorAll(\`input[name="\${field.id}"]:checked\`);
                            value = checkboxes.length > 0;
                        } else {
                            value = element.value.trim();
                        }
                        
                        if (!value) {
                            errorElement.textContent = '此字段为必填项';
                            errorElement.style.display = 'block';
                            isValid = false;
                        }
                    }
                    
                    // 检查自定义验证
                    if (field.validation && field.validation.pattern) {
                        if (element.value && !new RegExp(field.validation.pattern).test(element.value)) {
                            errorElement.textContent = field.validation.message || '输入的值无效';
                            errorElement.style.display = 'block';
                            isValid = false;
                        }
                    }
                });
                
                return isValid;
            }
        })();
    </script>
</body>
</html>
        `;
    }

    /**
     * 生成表单字段的 HTML
     */
    private static generateFieldHtml(field: FormField): string {
        const { id, label, type, description, placeholder, required, options, default: defaultValue } = field;

        // 必填项标记
        const requiredLabel = required ? '<span class="required">*必填</span>' : '';

        // 字段描述
        const descriptionHtml = description ? `<div class="field-description">${description}</div>` : '';

        // 错误消息容器
        const errorHtml = `<div class="field-error" id="${id}-error"></div>`;

        let inputHtml = '';

        switch (type) {
            case 'text':
            case 'number':
            case 'password':
                const inputType = type === 'number' ? 'number' : (type === 'password' ? 'password' : 'text');
                inputHtml = `<input type="${inputType}" id="${id}" name="${id}" ${placeholder ? `placeholder="${placeholder}"` : ''} ${defaultValue !== undefined ? `value="${defaultValue}"` : ''} ${required ? 'required' : ''}>`;
                break;

            case 'textarea':
                inputHtml = `<textarea id="${id}" name="${id}" ${placeholder ? `placeholder="${placeholder}"` : ''} ${required ? 'required' : ''}>${defaultValue || ''}</textarea>`;
                break;

            case 'boolean':
                inputHtml = `
                <div class="checkbox-container">
                    <input type="checkbox" id="${id}" name="${id}" ${defaultValue ? 'checked' : ''}>
                    <label for="${id}">${label}</label>
                </div>`;
                // 替换标签，因为在 checkbox 中已显示
                return `
                <div class="form-field">
                    ${descriptionHtml}
                    ${inputHtml}
                    ${errorHtml}
                </div>`;

            case 'select':
                const optionsHtml = options ? options.map(opt => 
                    `<option value="${opt.value}" ${defaultValue === opt.value ? 'selected' : ''}>${opt.label}</option>`
                ).join('') : '';
                
                inputHtml = `
                <select id="${id}" name="${id}" ${required ? 'required' : ''}>
                    <option value="" disabled ${!defaultValue ? 'selected' : ''}>请选择...</option>
                    ${optionsHtml}
                </select>`;
                break;

            case 'multiselect':
                inputHtml = `<div class="multiselect-options">`;
                if (options) {
                    options.forEach(opt => {
                        const isSelected = Array.isArray(defaultValue) && defaultValue.includes(opt.value);
                        inputHtml += `
                        <div class="checkbox-container">
                            <input type="checkbox" id="${id}_${opt.value}" name="${id}" value="${opt.value}" ${isSelected ? 'checked' : ''}>
                            <label for="${id}_${opt.value}">${opt.label}</label>
                        </div>`;
                    });
                }
                inputHtml += `</div>`;
                break;
        }

        return `
        <div class="form-field">
            <div class="field-label">
                <label for="${id}">${label}</label>
                ${requiredLabel}
            </div>
            ${descriptionHtml}
            ${inputHtml}
            ${errorHtml}
        </div>`;
    }
}

export interface InputBoxOptions extends vscode.InputBoxOptions {
    validation?: RegExp | ((value: string) => boolean | string);
}

/**
 * 简单表单帮助函数
 */
export class QuickForm {
    /**
     * 显示输入框
     */
    public static async showInputBox(options: InputBoxOptions): Promise<string | undefined> {
        const inputOptions: vscode.InputBoxOptions = {
            ...options,
            validateInput: (value: string) => {
                if (options.required && !value.trim()) {
                    return '此字段为必填项';
                }

                if (options.validation) {
                    if (options.validation instanceof RegExp) {
                        return options.validation.test(value) ? null : '输入的值无效';
                    } else if (typeof options.validation === 'function') {
                        const result = options.validation(value);
                        if (typeof result === 'string') {
                            return result;
                        } else if (result === false) {
                            return '输入的值无效';
                        }
                    }
                }

                return null;
            }
        };

        return vscode.window.showInputBox(inputOptions);
    }

    /**
     * 显示下拉选择框
     */
    public static async showQuickPick<T extends vscode.QuickPickItem>(
        items: T[],
        options: vscode.QuickPickOptions & { canPickMany?: false }
    ): Promise<T | undefined>;
    public static async showQuickPick<T extends vscode.QuickPickItem>(
        items: T[],
        options: vscode.QuickPickOptions & { canPickMany: true }
    ): Promise<T[] | undefined>;
    public static async showQuickPick<T extends vscode.QuickPickItem>(
        items: T[],
        options: vscode.QuickPickOptions
    ): Promise<T | T[] | undefined> {
        return vscode.window.showQuickPick(items, options);
    }

    /**
     * 显示确认对话框
     */
    public static async showConfirmDialog(
        message: string,
        options?: { title?: string; detail?: string; confirmText?: string; cancelText?: string; }
    ): Promise<boolean> {
        const { title, detail, confirmText = '确认', cancelText = '取消' } = options || {};
        
        const result = await vscode.window.showInformationMessage(
            message,
            { modal: true, detail },
            confirmText,
            cancelText
        );
        
        return result === confirmText;
    }

    /**
     * 显示简单的表单
     */
    public static async showSimpleForm(fields: FormField[]): Promise<Record<string, any> | undefined> {
        const values: Record<string, any> = {};
        
        for (const field of fields) {
            let value: any;
            
            // 根据字段类型显示不同的输入方式
            switch (field.type) {
                case 'text':
                case 'number':
                case 'password':
                case 'textarea':
                    value = await this.showInputBox({
                        title: field.label,
                        prompt: field.description,
                        placeHolder: field.placeholder,
                        password: field.type === 'password',
                        value: field.default?.toString(),
                        required: field.required,
                        validation: field.validation
                    });
                    
                    if (value === undefined) {
                        return undefined; // 用户取消
                    }
                    
                    if (field.type === 'number' && value) {
                        value = Number(value);
                    }
                    break;
                    
                case 'boolean':
                    // 使用确认对话框
                    value = await this.showConfirmDialog(field.label, {
                        detail: field.description
                    });
                    break;
                    
                case 'select':
                    if (!field.options || field.options.length === 0) {
                        break;
                    }
                    
                    const selected = await this.showQuickPick(
                        field.options.map(opt => ({ label: opt.label, value: opt.value })),
                        { 
                            title: field.label,
                            placeHolder: field.placeholder || '请选择...',
                            canPickMany: false
                        }
                    );
                    
                    if (!selected) {
                        return undefined; // 用户取消
                    }
                    
                    value = selected.value;
                    break;
                    
                case 'multiselect':
                    if (!field.options || field.options.length === 0) {
                        break;
                    }
                    
                    const selectedItems = await this.showQuickPick(
                        field.options.map(opt => ({ label: opt.label, value: opt.value })),
                        { 
                            title: field.label,
                            placeHolder: field.placeholder || '请选择...',
                            canPickMany: true
                        }
                    );
                    
                    if (!selectedItems) {
                        return undefined; // 用户取消
                    }
                    
                    value = selectedItems.map(item => item.value);
                    break;
            }
            
            values[field.id] = value;
        }
        
        return values;
    }
}

/**
 * 快速创建表单字段的辅助函数
 */
export class Field {
    public static text(id: string, label: string, options?: Partial<Omit<FormField, 'id' | 'label' | 'type'>>): FormField {
        return {
            id,
            label,
            type: 'text',
            ...options
        };
    }
    
    public static number(id: string, label: string, options?: Partial<Omit<FormField, 'id' | 'label' | 'type'>>): FormField {
        return {
            id,
            label,
            type: 'number',
            ...options
        };
    }
    
    public static boolean(id: string, label: string, options?: Partial<Omit<FormField, 'id' | 'label' | 'type'>>): FormField {
        return {
            id,
            label,
            type: 'boolean',
            ...options
        };
    }
    
    public static select(
        id: string, 
        label: string, 
        options: Array<{ value: any; label: string }>,
        fieldOptions?: Partial<Omit<FormField, 'id' | 'label' | 'type' | 'options'>>
    ): FormField {
        return {
            id,
            label,
            type: 'select',
            options,
            ...fieldOptions
        };
    }
    
    public static multiselect(
        id: string, 
        label: string, 
        options: Array<{ value: any; label: string }>,
        fieldOptions?: Partial<Omit<FormField, 'id' | 'label' | 'type' | 'options'>>
    ): FormField {
        return {
            id,
            label,
            type: 'multiselect',
            options,
            ...fieldOptions
        };
    }
    
    public static password(id: string, label: string, options?: Partial<Omit<FormField, 'id' | 'label' | 'type'>>): FormField {
        return {
            id,
            label,
            type: 'password',
            ...options
        };
    }
    
    public static textarea(id: string, label: string, options?: Partial<Omit<FormField, 'id' | 'label' | 'type'>>): FormField {
        return {
            id,
            label,
            type: 'textarea',
            ...options
        };
    }
} 