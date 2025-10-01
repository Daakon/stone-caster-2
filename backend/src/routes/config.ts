import { Router, type Request, type Response } from 'express';
import { configService } from '../services/config.service.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    try {
      await configService.whenReady();
    } catch {
      await configService.refreshNow();
    }

    let etag: string;
    try {
      etag = configService.getEtag();
    } catch {
      await configService.refreshNow();
      etag = configService.getEtag();
    }

    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      return res.status(304).end();
    }

    const publicConfig = configService.toPublicDTO();

    res.set({
      'Cache-Control': 'public, max-age=15',
      ETag: etag,
      'Content-Type': 'application/json',
    });

    res.json(publicConfig);
  } catch (error) {
    console.error('Error serving config:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to load configuration',
    });
  }
});

export default router;
