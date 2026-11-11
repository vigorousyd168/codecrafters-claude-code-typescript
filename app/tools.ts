import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

const execAsync = promisify(exec);

// advertising tools: Read, Write, Bash
export const toolDefinitions: ChatCompletionTool[] = [
  {
    "type": "function",
    "function": {
      "name": "Read",
      "description": "Read and return the contents of a file",
      "parameters": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string",
            "description": "The path to the file to read"
          }
        },
        "required": ["file_path"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "Write",
      "description": "Write content to a file",
      "parameters": {
        "type": "object",
        "required": ["file_path", "content"],
        "properties": {
          "file_path": {
            "type": "string",
            "description": "The path of the file to write to"
          },
          "content": {
            "type": "string",
            "description": "The content to write to the file"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "Bash",
      "description": "Execute a shell command",
      "parameters": {
        "type": "object",
        "required": ["command"],
        "properties": {
          "command": {
            "type": "string",
            "description": "The command to execute"
          }
        }
      }
    }
  }
];

/**
 * Runs the named tool and returns the text to send back to the model.
 * Failures are returned as error text instead of thrown, so the model can recover.
 */
export async function executeTool(name: string, rawArguments: string): Promise<string> {
  try {
    if (name === "Read") {
      const functionArguments = JSON.parse(rawArguments);
      return await fs.readFile(functionArguments.file_path, "utf8");
    }
    else if (name === "Write") {
      const functionArguments = JSON.parse(rawArguments);
      const filePath = functionArguments.file_path;
      // Create missing parent directories; writeFile creates or overwrites the file itself
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, functionArguments.content);
      return `Content written to ${filePath}`;
    }
    else if (name === "Bash") {
      const functionArguments = JSON.parse(rawArguments);
      const command = functionArguments.command;
      console.error(`Executing command: ${command}`);
      // const { stdout, stderr } = await $`${command}`.quiet().nothrow(); // support of bun's $ function in my env appeared to be limited
      const { stdout, stderr } = await execAsync(command);
      return `Command executed: ${command}\nOutput:\n${stdout}\nError Output:\n${stderr}`;
    }
    else {
      return `Unknown tool call: ${name}`;
    }
  } catch (err: any) {
    // exec errors carry stdout/stderr
    let content = `Error: ${err instanceof Error ? err.message : String(err)}`;
    if (err?.stdout !== undefined || err?.stderr !== undefined) {
      content += `\nOutput:\n${err.stdout ?? ""}\nError Output:\n${err.stderr ?? ""}`;
    }
    return content;
  }
}
