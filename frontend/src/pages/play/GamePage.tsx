/**
 * Game Page
 * Phase 7: Game Play Interface (Frontend)
 * Main gameplay interface at /play/:gameStateId
 * 
 * Updated Phase SPI-V2:
 * Acts as a simple router wrapper. All logic delegated to ActiveGameInterface.
 */

import { useParams } from 'react-router-dom';
import { ActiveGameInterface } from '@/components/game/ActiveGameInterface';

export default function GamePage() {
  const { gameStateId } = useParams<{ gameStateId: string }>();

  // If no ID, we can't do anything (or redirect)
  if (!gameStateId) return <div className="p-4 text-destructive">Invalid Game ID</div>;

  return <ActiveGameInterface gameStateId={gameStateId} />;
}
