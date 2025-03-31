# CommandHub

[中文说明](README.md)

This plugin allows you to quickly execute terminal commands.

![](https://picbed-1311007548.cos.ap-shanghai.myqcloud.com/markdown_picbed/img//2025/03/31/3659e057e7ec6690984d657772667f82.gif)

## Features

- One-click command execution
- Automatically retrieves project commands and displays them in a file directory tree format
- Command import and export functionality for easy backup and sharing of command sets

## Feature Introduction

### Project-Command

Automatically retrieves project commands and displays them in a file directory tree format. Click the run button to execute the command.

### WorkSpace-Command

Customize commands under the current working project directory. New directories will be saved in the current workspace or project. You can add a universal command that can be executed in any project, achieving a sharing effect.

### Global-Command

Set global workspace commands for VSCode. New commands will be saved in the global workspace of VSCode and can be used in any project.

### Command Import and Export Functionality

CommandHub supports command import and export functionality, making it easy for you to back up, restore, and share command sets.

#### Export Command Set

1. Click the export icon in the title bar of the workspace command set or global command set.
2. Choose the save location and file name.
3. All commands (including folder structure) will be saved to a JSON file.

#### Import Command Set

1. Click the import icon in the title bar of the workspace command set or global command set.
2. Select the JSON file to import.
3. All commands will be imported into the current command set.

#### JSON File Format

The imported JSON file must be an array of commands, where each command is an object containing the following fields:

```json
[
  {
    "script": "command content", // Required field
    "label": "command label",     // Optional, for display name
    "folder": "folder path"       // Optional, specifies the folder where the command is located
  }
]
```

#### Folder Structure

- Commands without the `folder` field will be placed in the root directory.
- The `folder` field can specify a single-level folder: `"folder": "Git Commands"`.
- The `folder` field can also specify nested folders: `"folder": "Docker/Basic Commands"`.

Example:

```json
[
  {
    "script": "npm run dev",
    "label": "Start Development Server"
  },
  {
    "script": "git add .",
    "label": "Add All Files",
    "folder": "Git Commands"
  },
  {
    "script": "docker-compose up -d",
    "label": "Start Container",
    "folder": "Docker/Basic Commands"
  }
]
```

**Note**: During import, non-existent folder structures will be automatically created. If the imported commands have the same name as existing commands, the existing commands will be overwritten.
