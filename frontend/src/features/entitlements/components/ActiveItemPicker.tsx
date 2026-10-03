import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ActiveContentChoice,
  EntitlementView,
} from "@shared/types/chimera-entitlements";

type ReadyView = Extract<EntitlementView, { state: "ready" }>;
export function ActiveItemPicker({
  view,
  busy,
  error,
  onSave,
}: {
  view: ReadyView;
  busy: boolean;
  error: string | null;
  onSave: (choice: ActiveContentChoice) => void;
}) {
  const [choice, setChoice] = useState<ActiveContentChoice>(() => ({
    story_ids: [...view.selected_story_ids],
    game_ids: [...view.selected_game_ids],
  }));
  const groups = [
    {
      key: "story_ids" as const,
      title: "Stories",
      items: view.stories,
      cap: view.limits.max_owned_stories,
      writable: view.writable_story_ids,
    },
    {
      key: "game_ids" as const,
      title: "Saved games",
      items: view.games,
      cap: view.limits.max_saved_games,
      writable: view.writable_game_ids,
    },
  ];
  const valid = groups.every(
    (group) =>
      choice[group.key].length <= group.cap &&
      choice[group.key].every((id) =>
        group.items.some((item) => item.id === id),
      ),
  );
  function move(key: keyof ActiveContentChoice, id: string, direction: number) {
    setChoice((current) => {
      const ids = [...current[key]],
        index = ids.indexOf(id),
        next = index + direction;
      if (index < 0 || next < 0 || next >= ids.length) return current;
      const other = ids[next];
      if (!other) return current;
      ids[next] = id;
      ids[index] = other;
      return { ...current, [key]: ids };
    });
  }
  return (
    <form
      className="sc-entitlements sc-picker"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) onSave(choice);
      }}
    >
      <p className="sc-hint">
        Choose your priorities. Unfilled places use recent activity. Items
        outside your active set stay read-only; nothing is deleted.
      </p>
      {groups.map((group) => (
        <fieldset key={group.key} disabled={busy}>
          <legend>
            {group.title} · {choice[group.key].length} / {group.cap} chosen
          </legend>
          {choice[group.key].length > group.cap && (
            <p role="alert" className="sc-notice">
              Choose at most {group.cap} {group.title.toLowerCase()} before
              saving.
            </p>
          )}
          {group.items.length === 0 && (
            <p className="sc-hint">
              You have no {group.title.toLowerCase()} yet.
            </p>
          )}
          <ul className="sc-choice-list">
            {[...group.items]
              .sort((a, b) => {
                const aIndex = choice[group.key].indexOf(a.id),
                  bIndex = choice[group.key].indexOf(b.id);
                return (
                  (aIndex < 0 ? Infinity : aIndex) -
                  (bIndex < 0 ? Infinity : bIndex)
                );
              })
              .map((item) => {
                const index = choice[group.key].indexOf(item.id),
                  checked = index >= 0;
                return (
                  <li key={item.id}>
                    <label
                      className="sc-choice-label"
                      htmlFor={`${group.key}-${item.id}`}
                    >
                      <input
                        id={`${group.key}-${item.id}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setChoice((current) => ({
                            ...current,
                            [group.key]: checked
                              ? current[group.key].filter(
                                  (id) => id !== item.id,
                                )
                              : [...current[group.key], item.id],
                          }));
                        }}
                      />
                      <span>
                        {checked ? `${String(index + 1)}. ` : ""}
                        {item.label}
                        <small>
                          {group.writable.includes(item.id)
                            ? "Currently active"
                            : "Currently read-only"}
                        </small>
                      </span>
                    </label>
                    {checked && (
                      <div className="sc-choice-order">
                        <Button
                          type="button"
                          variant="outline"
                          className="sc-icon-button"
                          disabled={index === 0}
                          aria-label={`Move ${item.label} earlier`}
                          onClick={() => {
                            move(group.key, item.id, -1);
                          }}
                        >
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="sc-icon-button"
                          disabled={index === choice[group.key].length - 1}
                          aria-label={`Move ${item.label} later`}
                          onClick={() => {
                            move(group.key, item.id, 1);
                          }}
                        >
                          <ArrowDown aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </fieldset>
      ))}
      {error && (
        <p role="alert" className="sc-notice">
          {error}
        </p>
      )}
      <div className="sc-form-actions">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setChoice({ story_ids: [], game_ids: [] });
          }}
        >
          Use recent activity
        </Button>
        <Button type="submit" disabled={busy || !valid}>
          {busy ? "Saving choices…" : "Save active choices"}
        </Button>
      </div>
    </form>
  );
}
