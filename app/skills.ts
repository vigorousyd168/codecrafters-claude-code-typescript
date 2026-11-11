import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SkillMetadata {
  name: string;
  description: string;
  filePath: string;
}

/**
 * Parses YAML front matter using zero external dependencies.
 * Supports single-line strings, quoted values, and basic multi-line blocks (| or >).
 */
function parseFrontMatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }

  const result: Record<string, string> = {};
  const lines = match[1].split(/\r?\n/);

  let currentKey: string | null = null;
  let blockStyle: '|' | '>' | null = null;
  let blockLines: string[] = [];

  const flushBlock = () => {
    if (currentKey && blockLines.length > 0) {
      result[currentKey] =
        blockStyle === '>'
          ? blockLines.join(' ').trim()
          : blockLines.join('\n').trim();
    }
    currentKey = null;
    blockStyle = null;
    blockLines = [];
  };

  for (const line of lines) {
    // Check if we are inside an indented multi-line block
    if (currentKey && (line.startsWith('  ') || line.startsWith('\t') || line.trim() === '')) {
      blockLines.push(line.trim());
      continue;
    }

    // If a new non-indented line starts, save any active multi-line block
    if (currentKey) {
      flushBlock();
    }

    // Ignore comments and blank lines
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (rawValue === '|' || rawValue === '>') {
      currentKey = key;
      blockStyle = rawValue;
    } else {
      // Strip matching surrounding single or double quotes
      const unquoted = rawValue.replace(/^(['"])(.*)\1$/, '$2');
      result[key] = unquoted;
    }
  }

  flushBlock();
  return result;
}

/**
 * Recursively scans a directory for SKILL.md files and extracts their name and description.
 */
export function scanSkills(dirPath: string): SkillMetadata[] {
  const results: SkillMetadata[] = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...scanSkills(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase() === 'skill.md') {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const metadata = parseFrontMatter(content);

        results.push({
          name: metadata.name || path.basename(dirPath),
          description: metadata.description || '',
          filePath: fullPath,
        });
      } catch (error) {
        console.error(`Failed to read or parse ${fullPath}:`, error);
      }
    }
  }

  return results;
}
