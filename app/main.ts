import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { scanSkills, type SkillMetadata } from "./skills";
import { runAgentLoop } from "./agent";
import { splitTokens, expandSkill } from "./utils";

function buildSystemPrompt(skills: SkillMetadata[]): string {
  if (skills.length === 0) {
    return "";
  }
  const skillList = skills
    .map(skill => `- ${skill.name}: ${skill.description}\n`)
    .join("");
  return "You have access to the following skills:\n\n" + skillList + 
  `\n\nIf a skill matches the user's request, call the Skill tool with its name and follow the instructions it returns.`;
}

/**
 * Leading "/name" tokens that match a skill are consumed as skill invocations;
 * the first token that isn't a matching skill starts the arguments, which are
 * passed to every invoked skill. Returns one expanded body per invoked skill.
 * A fork skill ends the run, so it is never expanded alongside another skill:
 * leading, it is invoked alone; after other skills, it starts the arguments.
 */
function buildUserPrompts(prompt: string, skills: SkillMetadata[]): string[] {
  const tokens = splitTokens(prompt);
  const invoked: SkillMetadata[] = [];
  for (const token of tokens) {
    const skill = token.startsWith("/") ? skills.find(s => s.name === token.slice(1)) : undefined;
    if (!skill) break;
    if (skill.context === "fork" && invoked.length > 0) break;
    invoked.push(skill);
    if (skill.context === "fork") break;
  }
  // No matching skill (e.g. "/etc/hosts ..."): send the prompt as-is
  if (invoked.length === 0) {
    return [prompt];
  }
  const args = tokens.slice(invoked.length);
  return invoked.map(skill => expandSkill(skill, args));
}

async function main() {
  const [, , flag, prompt] = process.argv;

  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const skills = scanSkills(".claude/skills");

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(skills) },
    ...buildUserPrompts(prompt, skills).map(content => ({ role: "user" as const, content }))
  ];

  process.stdout.write(await runAgentLoop(messages));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
