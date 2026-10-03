import type { ChimeraStoryV2 } from "@/types/chimera-v2";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Lock } from "lucide-react";
import "@/features/entitlements/entitlements.css";

interface StoryCardProps {
  data: ChimeraStoryV2;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
  editingDisabled?: boolean;
}
export function StoryCard({
  data,
  onClick,
  onEdit,
  onDelete,
  readOnly = false,
  editingDisabled = false,
}: StoryCardProps) {
  return (
    <article className="sc-story-row" aria-label={data.display_name}>
      <button
        className="sc-story-title"
        type="button"
        disabled={!onClick}
        onClick={onClick}
        aria-label={`Open ${data.display_name}`}
      >
        <strong>{data.display_name}</strong>
        <small>
          Story{data.world_display_name ? ` · ${data.world_display_name}` : ""}
        </small>
      </button>
      {readOnly ? (
        <span className="sc-story-status sc-read-only">
          <Lock className="inline" size={12} aria-hidden="true" /> Read-only
        </span>
      ) : data.status ? (
        <span className="sc-story-status">{data.status}</span>
      ) : null}
      <div className="sc-story-actions">
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            disabled={editingDisabled || readOnly}
            aria-label={`Edit ${data.display_name}`}
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            className="sc-delete"
            aria-label={`Delete ${data.display_name}`}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </article>
  );
}
