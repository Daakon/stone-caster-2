/**
 * Content QA Service
 * Lightweight checks for common content issues in prompt pieces
 */

export type QASeverity = 'error' | 'warn' | 'info';

export interface QAReportItem {
  type: QAReportType;
  piece: string; // Format: "scope:slug@version"
  severity: QASeverity;
  message: string;
  pct?: number; // For oversized pieces
  details?: Record<string, unknown>;
}

export type QAReportType =
  | 'EMPTY_TEXT'
  | 'EXCESS_WHITESPACE'
  | 'DUPLICATE_NPC_SLUG'
  | 'OVERSIZED_PIECE'
  | 'DISALLOWED_CHARS';

interface Piece {
  scope: string;
  slug: string;
  version?: string;
  tokens?: number;
  content?: string; // Optional: if available from assembler
}

export class ContentQAService {
  /**
   * Run QA checks on assembled pieces
   * Note: Content text may not be available; tokens are used as proxy
   */
  async checkPieces(
    pieces: Array<Piece>,
    totalBudget: number
  ): Promise<QAReportItem[]> {
    const report: QAReportItem[] = [];
    const seenNpcSlugs = new Set<string>();

    for (const piece of pieces) {
      const pieceId = `${piece.scope}:${piece.slug}@${piece.version || '1.0.0'}`;

      // Check for empty/missing content (if tokens are 0 or very low)
      if (!piece.tokens || piece.tokens < 10) {
        report.push({
          type: 'EMPTY_TEXT',
          piece: pieceId,
          severity: 'error',
          message: `Piece has very low token count (${piece.tokens || 0}), may be empty or missing`,
        });
      }

      // Check for oversized pieces (> 40% of budget)
      if (piece.tokens && totalBudget > 0) {
        const pct = piece.tokens / totalBudget;
        if (pct > 0.4) {
          report.push({
            type: 'OVERSIZED_PIECE',
            piece: pieceId,
            severity: 'warn',
            message: `Piece uses ${(pct * 100).toFixed(1)}% of budget`,
            pct,
          });
        }
      }

      // Check for duplicate NPC slugs
      if (piece.scope === 'npc') {
        const npcSlug = piece.slug;
        if (seenNpcSlugs.has(npcSlug)) {
          report.push({
            type: 'DUPLICATE_NPC_SLUG',
            piece: pieceId,
            severity: 'error',
            message: `NPC slug '${npcSlug}' appears multiple times`,
          });
        }
        seenNpcSlugs.add(npcSlug);
      }

      // Check content if available
      if (piece.content !== undefined) {
        // Check for excess whitespace (leading/trailing multiples)
        if (piece.content.match(/^\s{3,}|\s{3,}$/)) {
          report.push({
            type: 'EXCESS_WHITESPACE',
            piece: pieceId,
            severity: 'warn',
            message: 'Contains excessive leading or trailing whitespace',
          });
        }

        // Check for accidental markdown fences (``` at start/end)
        if (piece.content.trim().startsWith('```') || piece.content.trim().endsWith('```')) {
          report.push({
            type: 'DISALLOWED_CHARS',
            piece: pieceId,
            severity: 'info',
            message: 'Contains markdown code fences (may be intentional)',
          });
        }
      }
    }

    return report;
  }

  /**
   * Filter QA report by severity
   */
  filterBySeverity(report: QAReportItem[], severity: QASeverity): QAReportItem[] {
    return report.filter(item => item.severity === severity);
  }

  /**
   * Filter QA report by type
   */
  filterByType(report: QAReportItem[], type: QAReportType): QAReportItem[] {
    return report.filter(item => item.type === type);
  }
}

