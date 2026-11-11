import OpenAI from "openai";
import { scanSkills, SkillMetadata } from "./skills";
import { toolDefinitions, executeTool } from "./tools";

function buildSystemPrompt(skills: SkillMetadata[]): string {
  if (skills.length === 0) {
    return "";
  }
  const skillList = skills
    .map(skill => `- ${skill.name}: ${skill.description}\n`)
    .join("");
  return "You have access to the following skills:\n\n" + skillList;
}

function buildUserPrompt(prompt: string, skills: SkillMetadata[]): string {
  if (prompt.startsWith("/")) {
    const skillName = prompt.slice(1);
    const skill = skills.find(s => s.name === skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }
    return skill.body;
  }
  return prompt;
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

  const skills = scanSkills(".claude/skills");

  const messages = [
    { role: "system", content: buildSystemPrompt(skills) },
    { role: "user", content: buildUserPrompt(prompt, skills) }
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
