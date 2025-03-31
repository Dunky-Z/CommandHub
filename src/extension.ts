import * as vscode from 'vscode';
import container from './container';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "CommandHub" is now active!');
	let disposable = vscode.commands.registerCommand('CommandHub.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from CommandHub!' );
	});
	context.subscriptions.push(disposable);
	container(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
