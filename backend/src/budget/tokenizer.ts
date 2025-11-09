/**
 * Tokenizer
 * Estimates token count for text (reuses model tokenizer if available, else byteLength/4 fallback)
 */

/**
 * Estimate token count for text
 * Uses model tokenizer if available, else falls back to byteLength/4
 */
export async function estimateTokens(text: string, model?: string): Promise<number> {
  // Try to use model tokenizer if available
  // For now, we'll use a simple byteLength/4 fallback
  // In production, you might want to integrate with tiktoken or similar
  
  // Basic estimation: ~4 bytes per token (conservative for English)
  // This is a rough approximation; actual tokenizers vary by model
  const byteLength = Buffer.byteLength(text, 'utf8');
  return Math.ceil(byteLength / 4);
}

/**
 * Estimate tokens for multiple texts
 */
export async function estimateTokensBatch(texts: string[], model?: string): Promise<number[]> {
  return Promise.all(texts.map(text => estimateTokens(text, model)));
}

