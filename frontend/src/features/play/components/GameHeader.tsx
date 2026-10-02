import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  PanelLeft,
  PanelRight,
  Scan,
  SlidersHorizontal,
  BookOpen,
  Moon,
} from "lucide-react";
import { readPlayView, type PlayView } from "../model/play-view";
import type { PlayLayout } from "../model/layout";

interface GameHeaderProps {
  view?: PlayView;
  scene?: unknown;
  layout?: PlayLayout;
  onExit?: () => void;
  onConfig?: () => void;
  onJournal?: () => void;
  onTogglePanel?: (side: "left" | "right") => void;
  onFocus?: () => void;
}
export function GameHeader({
  view,
  scene,
  layout,
  onExit,
  onConfig,
  onJournal,
  onTogglePanel,
  onFocus,
}: GameHeaderProps) {
  const context =
    view ?? readPlayView({ narrative_focus: { scene_context: scene } });
  return (
    <header className="sc-game-header">
      <div className="sc-header-start">
        <Button
          variant="ghost"
          size="icon"
          className="sc-icon"
          aria-label="Exit Game"
          onClick={onExit}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        {layout && (
          <Button
            variant="ghost"
            size="icon"
            className="sc-icon sc-desktop"
            aria-label={`Cycle Character panel, currently ${layout.left}`}
            aria-controls="character-panel"
            onClick={() => onTogglePanel?.("left")}
          >
            <PanelLeft aria-hidden="true" />
          </Button>
        )}
        <div className="sc-story-title sc-desktop">
          {context.title && <h1>{context.title}</h1>}
          {context.committed_turn !== undefined && (
            <p>Turn {context.committed_turn}</p>
          )}
        </div>
      </div>
      <div className="sc-header-scene">
        {context.scene?.name && <h2>{context.scene.name}</h2>}
        <div>
          {context.scene?.time && (
            <span>
              <Moon aria-hidden="true" />
              {context.scene.time}
            </span>
          )}
          {context.scene?.atmosphere && (
            <span className="sc-mobile-only">
              {" "}
              · {context.scene.atmosphere}
            </span>
          )}
        </div>
      </div>
      <div className="sc-header-end">
        {layout?.focus && (
          <div className="sc-focus-pins" aria-label="Pinned modules">
            {context.modules
              .filter((module) => layout.modules[module.id] === "always")
              .map((module) => (
                <span key={module.id}>
                  {module.label}:{" "}
                  {module.fields.map((field) => field.value).join(" · ")}
                </span>
              ))}
          </div>
        )}
        {layout && (
          <Button
            variant="ghost"
            className="sc-icon sc-focus-toggle"
            aria-label={layout.focus ? "Exit focus" : "Enter focus"}
            aria-pressed={layout.focus}
            onClick={onFocus}
          >
            <Scan aria-hidden="true" />
            <span className="sc-desktop">
              {layout.focus ? "Show panels" : "Focus"}
            </span>
          </Button>
        )}
        <Button
          variant="ghost"
          className="sc-icon sc-desktop"
          aria-label={layout ? "Layout and HUD" : "Settings"}
          onClick={onConfig}
        >
          <SlidersHorizontal aria-hidden="true" />
          <span>Layout</span>
        </Button>
        {onJournal && (
          <Button
            variant="ghost"
            size="icon"
            className="sc-icon"
            aria-label="Open Journal"
            onClick={onJournal}
          >
            <BookOpen aria-hidden="true" />
          </Button>
        )}
        {layout && (
          <Button
            variant="ghost"
            size="icon"
            className="sc-icon sc-desktop"
            aria-label={`Cycle Here panel, currently ${layout.right}`}
            aria-controls="here-panel"
            onClick={() => onTogglePanel?.("right")}
          >
            <PanelRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </header>
  );
}
