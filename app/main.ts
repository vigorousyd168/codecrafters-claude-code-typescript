import OpenAI from "openai";
import { $ } from "bun";

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const messages = [{ role: "user", content: prompt }];
  let exit = false;

  while (!exit) {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages,
      tools: [{
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
      ]
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    messages.push(response.choices[0].message);

    // function calls -> append result to messages and loop
    // otherwise, print the content and exit
    if (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
      for (const toolCall of response.choices[0].message.tool_calls) {
        if (toolCall.function.name === "Read") {
          const functionArguments = JSON.parse(toolCall.function.arguments);
          const filePath = functionArguments.file_path;
          const fileContent = await Bun.file(filePath).text();
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: fileContent
          });
        }
        else if (toolCall.function.name === "Write") {
          const functionArguments = JSON.parse(toolCall.function.arguments);
          const filePath = functionArguments.file_path;
          const content = functionArguments.content;
          // This API automatically creates the file if it does not exist, overwrites existing contents,
          // and accepts both absolute and relative paths
          await Bun.write(filePath, content);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `Content written to ${filePath}`
          });
        }
        else if (toolCall.function.name === "Bash") {
          const functionArguments = JSON.parse(toolCall.function.arguments);
          const command = functionArguments.command;
          const { stdout, stderr } = await $`${command}`;
          const output = await stdout.text();
          const errorOutput = await stderr.text();
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `Command executed: ${command}\nOutput:\n${output}\nError Output:\n${errorOutput}`
          });
        }
        else {
          process.stderr.write(`Tool call to unknown tool: ${toolCall.function.name}`);
        }
      }
    }
    else {
      process.stdout.write(response.choices[0].message.content);
      exit = true;
    }
  }
}

main();
