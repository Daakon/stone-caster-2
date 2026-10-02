import { useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActiveGameStore } from "@/stores/useActiveGameStore";

export function PlayComposer({
  suggestions,
  onTray,
}: {
  suggestions: string[];
  onTray: () => void;
}) {
  const draft = useActiveGameStore((state) => state.draftText);
  const mode = useActiveGameStore((state) => state.inputMode);
  const setDraft = useActiveGameStore((state) => state.setDraft);
  const commitInput = useActiveGameStore((state) => state.commitInput);
  const error = useActiveGameStore((state) => state.lastError);
  const [editing, setEditing] = useState(false);
  const busy = mode === "thinking" || mode === "locked";
  return (
    <div className={`sc-composer-wrap${editing ? " sc-editing" : ""}`}>
      {error && (
        <div role="alert" className="sc-input-error">
          <p>{error}</p>
          <Button
            className="sc-action"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void commitInput();
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="sc-suggestions" aria-label="Continue with">
          {suggestions.map((suggestion) => (
            <Button
              variant="outline"
              className="sc-chip"
              data-testid="suggestion-chip"
              key={suggestion}
              disabled={busy}
              onClick={() => {
                setDraft(suggestion);
              }}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
      <form
        className="sc-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void commitInput();
        }}
      >
        <div className="sc-composer-heading sc-desktop">
          <span className="sc-mode">Do</span>
          <span className="sc-muted">
            Enter to send · Shift+Enter for a new line
          </span>
        </div>
        <Button
          variant="ghost"
          type="button"
          className="sc-icon sc-mobile-only"
          aria-label="Open action tray"
          onClick={onTray}
        >
          <Plus aria-hidden="true" />
        </Button>
        <span className="sc-mode sc-mobile-only">Do</span>
        <label htmlFor="play-action" className="sr-only">
          Your action
        </label>
        <Textarea
          id="play-action"
          value={draft}
          disabled={busy}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onFocus={() => {
            setEditing(true);
          }}
          onBlur={() => {
            setEditing(false);
          }}
          placeholder={busy ? "The story unfolds…" : "What do you do?"}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void commitInput();
            }
          }}
        />
        <Button
          type="submit"
          className="sc-icon sc-send"
          aria-label="Send action"
          disabled={busy || !draft.trim()}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
