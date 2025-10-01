import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toSearchResultDTO } from '../utils/dto-mappers.js';
import { validateRequest } from '../middleware/validation.js';
import { SearchQuerySchema } from 'shared';
import { ApiErrorCode } from 'shared';

const router = Router();

// Search across all content
router.get('/', validateRequest(SearchQuerySchema, 'query'), async (req: Request, res: Response) => {
  try {
    const { q, limit, offset } = req.query as unknown as { q: string; limit: number; offset: number };

    // Mock search results - in real implementation, this would use a search service
    const mockResults = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Character',
        description: 'A test character for search',
      },
      {
        id: '456e7890-e89b-12d3-a456-426614174001',
        name: 'Fantasy World',
        description: 'A fantasy world for adventures',
      },
    ];

    const searchResults = mockResults
      .slice(offset, offset + limit)
      .map((item, index) => {
        const type = index % 2 === 0 ? 'character' : 'world';
        return toSearchResultDTO(item, type as any, 0.9 - (index * 0.1));
      });

    sendSuccess(res, {
      results: searchResults,
      total: mockResults.length,
      limit,
      offset,
    }, req);
  } catch (error) {
    console.error('Error searching:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to search',
      req
    );
  }
});

export default router;
