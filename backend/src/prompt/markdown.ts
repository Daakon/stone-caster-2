/**
 * Markdown utilities for prompt assembly and formatting
 */

/**
 * Stable section delimiters for prompt assembly
 */
export const SECTION_DELIMITERS = {
  CORE: '--- CORE ---',
  RULESET: '--- RULESET ---',
  WORLD: '--- WORLD ---',
  ENTRY: '--- ENTRY ---',
  ENTRY_START: '--- ENTRY START ---',
  NPC: '--- NPC ---',
  GAME_STATE: '--- GAME STATE ---',
  PLAYER: '--- PLAYER ---',
  RNG: '--- RNG ---',
  INPUT: '--- INPUT ---',
} as const;

/**
 * Format a prompt section with consistent delimiters
 */
export function formatSection(
  content: string,
  sectionType: keyof typeof SECTION_DELIMITERS,
  title?: string
): string {
  if (!content || content.trim().length === 0) {
    return '';
  }
  
  const delimiter = SECTION_DELIMITERS[sectionType];
  const sectionTitle = title ? ` ${title}` : '';
  
  return `${delimiter}${sectionTitle}\n${content.trim()}\n\n`;
}

/**
 * Assemble multiple sections into a complete prompt
 */
export function assembleSections(sections: Array<{
  type: keyof typeof SECTION_DELIMITERS;
  content: string;
  title?: string;
}>): string {
  return sections
    .filter(section => section.content && section.content.trim().length > 0)
    .map(section => formatSection(section.content, section.type, section.title))
    .join('');
}

/**
 * Extract sections from a formatted prompt
 */
export function extractSections(prompt: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = prompt.split('\n');
  let currentSection = '';
  let currentContent = '';
  
  for (const line of lines) {
    if (line.startsWith('--- ') && line.endsWith(' ---')) {
      // Save previous section
      if (currentSection && currentContent.trim()) {
        sections[currentSection] = currentContent.trim();
      }
      
      // Start new section
      currentSection = line.replace(/^--- | ---$/g, '').toLowerCase().replace(/\s+/g, '_');
      currentContent = '';
    } else {
      currentContent += line + '\n';
    }
  }
  
  // Save last section
  if (currentSection && currentContent.trim()) {
    sections[currentSection] = currentContent.trim();
  }
  
  return sections;
}

/**
 * Validate markdown formatting
 */
export function validateMarkdown(content: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for common markdown issues
  if (content.includes('```') && !content.includes('```\n')) {
    issues.push('Code blocks should end with newline');
  }
  
  if (content.includes('**') && content.includes('** ')) {
    issues.push('Bold text should not have trailing space');
  }
  
  if (content.includes('*') && content.includes('* ')) {
    issues.push('Italic text should not have trailing space');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}
