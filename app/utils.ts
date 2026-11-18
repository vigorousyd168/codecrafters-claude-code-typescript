import type { SkillMetadata } from "./skills";

/**
 * Splits on whitespace, keeping "double" or 'single' quoted text together as one argument (quotes removed).
 */
export function splitTokens(input: string): string[] {
  return [...input.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)]
    .map(m => m[1] ?? m[2] ?? m[3]);
}

const PLACEHOLDER = /\$ARGUMENTS\[(\d+)\]|\$(\d+)|\$ARGUMENTS/g;

/**
 * Substitutes $ARGUMENTS[N], $N (0-based) and $ARGUMENTS in a single pass,
 * so placeholders inside substituted arguments are left untouched.
 * Out-of-range indexes are left as-is.
 */
export function formatString(template: string, ...args: string[]): string {
  return template.replace(PLACEHOLDER, (match, bracketIndex, shortIndex) => {
    const index = bracketIndex ?? shortIndex;
    if (index === undefined) {
      return args.join(" ");
    }
    return args[Number(index)] ?? match;
  });
}

/**
 * Builds the text sent to the model for an invoked skill: a header naming the skill's
 * folder, then the body with arguments substituted. If the body has no placeholders,
 * the arguments are appended so they aren't lost.
 */
export function expandSkill(skill: SkillMetadata, args: string[]): string {
  let body = formatString(skill.body, ...args);
  if (args.length > 0 && !skill.body.match(PLACEHOLDER)) {
    body += `\n\nARGUMENTS: ${args.join(" ")}`;
  }
  return `Skill: ${skill.name} (path: ${skill.filePath})\n` +
    `Paths in the instructions below are relative to the skill's folder.\n\n` +
    body;
}
