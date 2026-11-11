import OpenAI from "openai";
import { scanSkills } from "./skills";
import { toolDefinitions, executeTool } from "./tools";

function buildSystemPrompt(): string {
  const skills = scanSkills(".claude/skills");
  if (skills.length === 0) {
    return "";
  }
  const skillList = skills
    .map(skill => `Name: ${skill.name}\nDescription: ${skill.description}\nFile: ${skill.filePath}\n\n`)
    .join("");
  return "You have access to the following skills. When a skill is relevant to the task, " +
    "read its file with the Read tool and follow its instructions.\n\n" + skillList;
}

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

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: prompt }
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages,
      tools: toolDefinitions,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    const message = response.choices[0].message;
    messages.push(message);

    // function calls -> append result to messages and loop
    // otherwise, print the content and exit
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: await executeTool(toolCall.function.name, toolCall.function.arguments)
        });
      }
    }
    else {
      process.stdout.write(message.content ?? "");
      return;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
