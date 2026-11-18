/**
 * Splits on whitespace, keeping "double" or 'single' quoted text together as one argument (quotes removed).
 */
export function splitTokens(input: string): string[] {
  return [...input.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)]
    .map(m => m[1] ?? m[2] ?? m[3]);
}

/**
 * Substitutes $ARGUMENTS[N], $N (0-based) and $ARGUMENTS in a single pass,
 * so placeholders inside substituted arguments are left untouched.
 * Out-of-range indexes are left as-is.
 */
export function formatString(template: string, ...args: string[]): string {
  return template.replace(/\$ARGUMENTS\[(\d+)\]|\$(\d+)|\$ARGUMENTS/g, (match, bracketIndex, shortIndex) => {
    const index = bracketIndex ?? shortIndex;
    if (index === undefined) {
      return args.join(" ");
    }
    return args[Number(index)] ?? match;
  });
}
