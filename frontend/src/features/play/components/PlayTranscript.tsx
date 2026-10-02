import type { LogEntry } from "./Narrative/types";
import type { PlayView } from "../model/play-view";
export function PlayTranscript({
  view,
  logs,
  pendingInput,
}: {
  view: PlayView;
  logs: LogEntry[];
  pendingInput: string | null;
}) {
  return (
    <div className="sc-transcript">
      {(view.committed_turn !== undefined || view.scene?.time) && (
        <div className="sc-turn-divider">
          <span>
            {view.committed_turn !== undefined &&
              `Turn ${String(view.committed_turn)}`}
            {view.committed_turn !== undefined && view.scene?.time ? " · " : ""}
            {view.scene?.time}
          </span>
        </div>
      )}
      {logs.map((log) => (
        <article key={log.id} className={`sc-log sc-log-${log.role}`}>
          {log.role === "player" && <p className="sc-overline">You do</p>}
          <div>
            {log.text.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </article>
      ))}
      {pendingInput && (
        <div role="status" data-testid="turn-pending" className="sc-pending">
          <p>{pendingInput}</p>
          <p>The story unfolds…</p>
        </div>
      )}
    </div>
  );
}
