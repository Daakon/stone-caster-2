import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { loadState } from "@/services/game-client";
import { useActiveGameStore } from "@/stores/useActiveGameStore";
import {
  readPlayView,
  readTranscript,
  readSuggestions,
} from "@/features/play/model/play-view";
import { PlayShell } from "@/features/play/components/PlayShell";
import { Button } from "@/components/ui/button";

export function ActiveGameInterface({ gameStateId }: { gameStateId: string }) {
  const navigate = useNavigate();
  const setActiveGameId = useActiveGameStore((state) => state.setActiveGameId);
  const syncState = useActiveGameStore((state) => state.syncState);
  const unlockInput = useActiveGameStore((state) => state.unlockInput);
  const storedState = useActiveGameStore((state) => state.gameState);
  const activeId = useActiveGameStore((state) => state.activeGameId);
  const pending = useActiveGameStore((state) => state.pendingInput);
  const lastError = useActiveGameStore((state) => state.lastError);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["game-state", gameStateId],
    queryFn: () => loadState(gameStateId),
  });
  useEffect(() => {
    setActiveGameId(gameStateId);
    return () => unlockInput();
  }, [gameStateId, setActiveGameId, unlockInput]);
  useEffect(() => {
    if (data) syncState(data);
  }, [data, syncState]);
  // Until 0C also projects committed turn responses, refresh the same GET
  // boundary after success. Errors retain the draft and never refresh it away.
  const previousPending = useRef<string | null>(null);
  useEffect(() => {
    if (previousPending.current && !pending && !lastError) void refetch();
    previousPending.current = pending;
  }, [pending, lastError, refetch]);
  const snapshot = activeId === gameStateId && storedState ? storedState : data;
  const presentation = useMemo(() => {
    if (!snapshot) return null;
    try {
      return {
        view: readPlayView(snapshot),
        logs: readTranscript(snapshot),
        suggestions: readSuggestions(snapshot),
      };
    } catch {
      return null;
    }
  }, [snapshot]);
  if (isLoading)
    return (
      <div
        role="status"
        className="min-h-screen flex items-center justify-center bg-sc-page text-sc-text"
      >
        Loading your story?
      </div>
    );
  if (error || !presentation)
    return (
      <div
        role="alert"
        className="min-h-screen flex flex-col items-center justify-center gap-4 bg-sc-page text-sc-text"
      >
        <p>Your story could not be loaded.</p>
        <Button
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </Button>
        <Button variant="outline" onClick={() => navigate("/stories")}>
          Back to stories
        </Button>
      </div>
    );
  return <PlayShell {...presentation} onExit={() => navigate("/stories")} />;
}
