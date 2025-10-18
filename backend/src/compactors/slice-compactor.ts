/**
 * Slice Compactor
 * Phase 6: Performance & Cost Controls - Compact slice summaries for caching
 */

export interface SliceSummary {
  name: string;
  content: string;
  tokenCount: number;
  keyPoints: string[];
  metadata: {
    originalLength: number;
    compressedRatio: number;
    createdAt: string;
  };
}

export interface CompactSliceOptions {
  maxTokens?: number;
  preserveKeyPoints?: boolean;
  includeMetadata?: boolean;
}

/**
 * Compact a slice to a summary string (≤ 250 tokens target)
 */
export function compactSlice(
  sliceContent: string,
  sliceName: string,
  options: CompactSliceOptions = {}
): SliceSummary {
  const maxTokens = options.maxTokens || 250;
  const preserveKeyPoints = options.preserveKeyPoints !== false;
  const includeMetadata = options.includeMetadata !== false;

  const originalLength = sliceContent.length;
  
  // Extract key points (first few sentences or bullet points)
  const keyPoints = extractKeyPoints(sliceContent);
  
  // Create compact summary
  let compactContent = createCompactSummary(sliceContent, keyPoints, maxTokens);
  
  // Ensure we don't exceed token limit
  const estimatedTokens = estimateTokens(compactContent);
  if (estimatedTokens > maxTokens) {
    compactContent = truncateToTokenLimit(compactContent, maxTokens);
  }

  const compressedRatio = originalLength > 0 ? compactContent.length / originalLength : 1;

  return {
    name: sliceName,
    content: compactContent,
    tokenCount: estimateTokens(compactContent),
    keyPoints: preserveKeyPoints ? keyPoints : [],
    metadata: includeMetadata ? {
      originalLength,
      compressedRatio,
      createdAt: new Date().toISOString()
    } : {
      originalLength: 0,
      compressedRatio: 1,
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Extract key points from slice content
 */
function extractKeyPoints(content: string): string[] {
  const keyPoints: string[] = [];
  
  // Look for bullet points or numbered lists
  const bulletMatches = content.match(/^[\s]*[-*•]\s+(.+)$/gm);
  if (bulletMatches) {
    keyPoints.push(...bulletMatches.map(match => match.replace(/^[\s]*[-*•]\s+/, '').trim()));
  }

  // Look for numbered lists
  const numberedMatches = content.match(/^[\s]*\d+\.\s+(.+)$/gm);
  if (numberedMatches) {
    keyPoints.push(...numberedMatches.map(match => match.replace(/^[\s]*\d+\.\s+/, '').trim()));
  }

  // If no lists found, extract first few sentences
  if (keyPoints.length === 0) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    keyPoints.push(...sentences.slice(0, 3).map(s => s.trim()));
  }

  return keyPoints.slice(0, 5); // Limit to 5 key points
}

/**
 * Create compact summary from content and key points
 */
function createCompactSummary(content: string, keyPoints: string[], maxTokens: number): string {
  // If content is already short, return as-is
  if (estimateTokens(content) <= maxTokens) {
    return content;
  }

  // Start with key points
  let summary = keyPoints.length > 0 ? keyPoints.join('. ') + '. ' : '';
  
  // Add condensed version of main content
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const importantSentences = sentences.filter(s => 
    s.length > 20 && // Not too short
    !s.toLowerCase().includes('note:') && // Skip notes
    !s.toLowerCase().includes('warning:') && // Skip warnings
    !s.toLowerCase().includes('important:') // Skip importance markers
  );

  // Add sentences until we approach token limit
  for (const sentence of importantSentences) {
    const testSummary = summary + sentence + '. ';
    if (estimateTokens(testSummary) > maxTokens * 0.8) { // Leave some buffer
      break;
    }
    summary = testSummary;
  }

  return summary.trim();
}

/**
 * Truncate content to fit within token limit
 */
function truncateToTokenLimit(content: string, maxTokens: number): string {
  const words = content.split(/\s+/);
  let truncated = '';
  let currentTokens = 0;

  for (const word of words) {
    const testContent = truncated + (truncated ? ' ' : '') + word;
    const testTokens = estimateTokens(testContent);
    
    if (testTokens > maxTokens) {
      break;
    }
    
    truncated = testContent;
    currentTokens = testTokens;
  }

  return truncated + (truncated.endsWith('.') ? '' : '...');
}

/**
 * Estimate token count for text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This is a simplified estimate; in production you might use a more sophisticated tokenizer
  return Math.ceil(text.length / 4);
}

/**
 * Compact multiple slices at once
 */
export function compactSlices(
  slices: Array<{ name: string; content: string }>,
  options: CompactSliceOptions = {}
): SliceSummary[] {
  return slices.map(slice => 
    compactSlice(slice.content, slice.name, options)
  );
}

/**
 * Create inline slice summaries for bundle injection
 */
export function createInlineSummaries(
  worldSlices: string[],
  adventureSlices: string[],
  options: CompactSliceOptions = {}
): {
  world: { inline: string[] };
  adventure: { inline: string[] };
} {
  const worldSummaries = worldSlices.map(slice => 
    compactSlice(slice, 'world-slice', { ...options, maxTokens: 200 }).content
  );
  
  const adventureSummaries = adventureSlices.map(slice => 
    compactSlice(slice, 'adventure-slice', { ...options, maxTokens: 200 }).content
  );

  return {
    world: { inline: worldSummaries },
    adventure: { inline: adventureSummaries }
  };
}

/**
 * Validate slice summary quality
 */
export function validateSliceSummary(summary: SliceSummary): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (summary.content.length === 0) {
    issues.push('Summary content is empty');
  }

  if (summary.tokenCount > 300) {
    issues.push(`Token count (${summary.tokenCount}) exceeds recommended limit (300)`);
  }

  if (summary.metadata.compressedRatio > 0.1) {
    issues.push(`Compression ratio (${summary.metadata.compressedRatio.toFixed(2)}) is too high`);
  }

  if (summary.keyPoints.length === 0) {
    issues.push('No key points extracted');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}


