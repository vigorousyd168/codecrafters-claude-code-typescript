import OpenAI from "openai";

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

  const response = await client.chat.completions.create({
    model: "anthropic/claude-haiku-4.5",
    messages: [{ role: "user", content: prompt }],
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
      }
    ]
  });

  if (!response.choices || response.choices.length === 0) {
    throw new Error("no choices in response");
  }

  // You can use print statements as follows for debugging, they'll be visible when running tests.
  console.error("Logs from your program will appear here!");

  // function call or print message content
  if (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
    const toolCall = response.choices[0].message.tool_calls[0];
    if (toolCall.function.name === "Read") {
      const functionArguments = JSON.parse(toolCall.function.arguments);
      const filePath = functionArguments.file_path;
      const fileContent = await Bun.file(filePath).text();
      process.stdout.write(fileContent);
    } else {
      console.error(`Tool call to unknown tool: ${toolCall.function.name}`);
    }
  }
  else {
    console.log(response.choices[0].message.content);
  }
}

main();
