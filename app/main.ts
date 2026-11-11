import OpenAI from "openai";
import { scanSkills, type SkillMetadata } from "./skills";
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
    const [command, ...args] = splitArgs(prompt);
    const skill = skills.find(s => s.name === command.slice(1));
    // No matching skill (e.g. "/etc/hosts ..."): fall through and send the prompt as-is
    if (skill) {
      return formatString(skill.body, ...args);
    }
  }
  return prompt;
}

/**
 * Splits on whitespace, keeping "double" or 'single' quoted text together as one argument (quotes removed).
 */
function splitArgs(input: string): string[] {
  return [...input.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)]
    .map(m => m[1] ?? m[2] ?? m[3]);
}

/**
 * Substitutes $ARGUMENTS[N], $N (0-based) and $ARGUMENTS in a single pass,
 * so placeholders inside substituted arguments are left untouched.
 * Out-of-range indexes are left as-is.
 */
function formatString(template: string, ...args: string[]): string {
  return template.replace(/\$ARGUMENTS\[(\d+)\]|\$(\d+)|\$ARGUMENTS/g, (match, bracketIndex, shortIndex) => {
    const index = bracketIndex ?? shortIndex;
    if (index === undefined) {
      return args.join(" ");
    }
    return args[Number(index)] ?? match;
  });
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
