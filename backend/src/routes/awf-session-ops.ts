import { Router } from 'express';
import { SnapshotsService } from '../services/snapshots.service.js';
import { RecapService } from '../services/recap.service.js';
import { ExportImportService } from '../services/export-import.service.js';
import { WALService } from '../services/wal.service.js';

const router = Router();
const snapshotsService = new SnapshotsService();
const recapService = new RecapService();
const exportImportService = new ExportImportService();
const walService = new WALService();

// Middleware to require admin role (placeholder - implement based on your auth system)
const requireAdminRole = (req: any, res: any, next: any) => {
  // TODO: Implement admin role check
  next();
};

// Snapshots endpoints
router.post('/sessions/:sessionId/snapshots', requireAdminRole, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { label } = req.body;

    const snapshot = await snapshotsService.createSnapshot({
      session_id: sessionId,
      label
    });

    res.json({
      ok: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create snapshot',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/sessions/:sessionId/snapshots', requireAdminRole, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const snapshots = await snapshotsService.listSnapshots(sessionId);

    res.json({
      ok: true,
      data: snapshots
    });
  } catch (error) {
    console.error('Error listing snapshots:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to list snapshots',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/sessions/:sessionId/restore/:snapshotId', requireAdminRole, async (req, res) => {
  try {
    const { sessionId, snapshotId } = req.params;

    await snapshotsService.restoreSnapshot({
      session_id: sessionId,
      snapshot_id: snapshotId
    });

    res.json({
      ok: true,
      message: 'Session restored from snapshot'
    });
  } catch (error) {
    console.error('Error restoring snapshot:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to restore snapshot',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/sessions/:sessionId/snapshots/:snapshotId', requireAdminRole, async (req, res) => {
  try {
    const { sessionId, snapshotId } = req.params;

    await snapshotsService.deleteSnapshot(sessionId, snapshotId);

    res.json({
      ok: true,
      message: 'Snapshot deleted'
    });
  } catch (error) {
    console.error('Error deleting snapshot:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete snapshot',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Recap endpoint
router.get('/sessions/:sessionId/recap', requireAdminRole, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { lastTurns } = req.query;

    const recap = await recapService.generateRecap({
      session_id: sessionId,
      lastTurns: lastTurns ? parseInt(lastTurns as string) : undefined
    });

    res.json({
      ok: true,
      data: recap
    });
  } catch (error) {
    console.error('Error generating recap:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to generate recap',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export endpoint
router.get('/sessions/:sessionId/export', requireAdminRole, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const exportData = await exportImportService.exportSession({
      session_id: sessionId
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}-export.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting session:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to export session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Import endpoint
router.post('/sessions/import', requireAdminRole, async (req, res) => {
  try {
    const { exportData, preserveTurnId } = req.body;

    const newSessionId = await exportImportService.importSession({
      exportData,
      preserveTurnId
    });

    res.json({
      ok: true,
      data: {
        session_id: newSessionId
      }
    });
  } catch (error) {
    console.error('Error importing session:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to import session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// WAL endpoints
router.post('/wal/repair', requireAdminRole, async (req, res) => {
  try {
    const { sessionId } = req.body;

    const result = await walService.reconcile({
      session_id: sessionId
    });

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Error repairing WAL:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to repair WAL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/wal/:sessionId/entries', requireAdminRole, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const entries = await walService.getUnappliedEntries(sessionId);

    res.json({
      ok: true,
      data: entries
    });
  } catch (error) {
    console.error('Error getting WAL entries:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get WAL entries',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;


