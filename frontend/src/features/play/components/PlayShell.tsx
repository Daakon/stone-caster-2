import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useActiveGameStore } from "@/stores/useActiveGameStore";
import type { PlayView } from "../model/play-view";
import type { ModulePolicy } from "../model/layout";
import type { LogEntry } from "./Narrative/types";
import { ThreeColumnLayout } from "../layout/ThreeColumnLayout";
import { GameHeader } from "./GameHeader";
import { CharacterRail } from "./HUD/CharacterRail";
import { HereRail } from "./HUD/HereRail";
import { SlimRail } from "./HUD/SlimRail";
import { MobileVitalsStrip } from "./HUD/MobileVitalsStrip";
import { CastStack } from "./HUD/CastStack";
import { PopInCard } from "./HUD/PopInCard";
import { PlayComposer } from "./PlayComposer";
import { PlayTranscript } from "./PlayTranscript";
import "../play-shell.css";

type Surface = "Character" | "Here" | "Journal" | "Layout and HUD" | "Actions";
export function PlayShell({
  view,
  logs,
  suggestions,
  onExit,
}: {
  view: PlayView;
  logs: LogEntry[];
  suggestions: string[];
  onExit: () => void;
}) {
  const layout = useActiveGameStore((state) => state.layout);
  const initializeLayout = useActiveGameStore(
    (state) => state.initializeLayout,
  );
  const togglePanel = useActiveGameStore((state) => state.togglePanel);
  const setPanel = useActiveGameStore((state) => state.setPanel);
  const toggleFocus = useActiveGameStore((state) => state.toggleFocus);
  const hideModule = useActiveGameStore((state) => state.hideModule);
  const setPolicy = useActiveGameStore((state) => state.setModulePolicy);
  const pendingInput = useActiveGameStore((state) => state.pendingInput);
  const [surface, setSurface] = useState<Surface | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const openSurface = (next: Surface) => {
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSurface(next);
  };
  useEffect(() => {
    initializeLayout(window.innerWidth);
  }, [initializeLayout]);
  const visibleView = {
    ...view,
    modules: view.modules.filter(
      (module) => (layout.modules[module.id] ?? "always") === "always",
    ),
  };
  const mobileHereView = {
    ...view,
    scene: layout.modules.scene === "never" ? undefined : view.scene,
    presence: layout.modules.cast === "never" ? undefined : view.presence,
  };
  const character = (
    <CharacterRail view={view} policies={layout.modules} onHide={hideModule} />
  );
  const here = (
    <HereRail view={view} policies={layout.modules} onHide={hideModule} />
  );
  const moduleList = [
    ...view.modules.map((module) => ({ id: module.id, label: module.label })),
    ...(view.scene ? [{ id: "scene", label: "Scene" }] : []),
    ...(view.presence ? [{ id: "cast", label: "Present" }] : []),
  ];
  return (
    <>
      <ThreeColumnLayout
        header={
          <GameHeader
            view={view}
            layout={layout}
            onExit={onExit}
            onTogglePanel={togglePanel}
            onFocus={toggleFocus}
            onConfig={() => {
              openSurface("Layout and HUD");
            }}
            onJournal={() => {
              openSurface("Journal");
            }}
          />
        }
        leftState={layout.left}
        rightState={layout.right}
        leftSidebar={
          layout.left === "slim" ? (
            <SlimRail
              side="left"
              view={view}
              policies={layout.modules}
              onExpand={() => {
                setPanel("left", "open");
              }}
            />
          ) : (
            character
          )
        }
        rightSidebar={
          layout.right === "slim" ? (
            <SlimRail
              side="right"
              view={view}
              policies={layout.modules}
              onExpand={() => {
                setPanel("right", "open");
              }}
            />
          ) : (
            here
          )
        }
        mobileBar={
          !layout.focus && (
            <>
              {layout.left !== "hidden" && (
                <MobileVitalsStrip
                  view={visibleView}
                  onOpen={() => {
                    openSurface("Character");
                  }}
                />
              )}
              {layout.right !== "hidden" && (
                <CastStack
                  view={mobileHereView}
                  onOpen={() => {
                    openSurface("Here");
                  }}
                />
              )}
            </>
          )
        }
        footer={
          <PlayComposer
            suggestions={suggestions}
            onTray={() => {
              openSurface("Actions");
            }}
          />
        }
      >
        <PlayTranscript view={view} logs={logs} pendingInput={pendingInput} />
        <div className="sc-pop-ins">
          {view.modules
            .filter((module) => layout.modules[module.id] === "on_change")
            .map((module) => (
              <PopInCard key={module.id} module={module} />
            ))}
        </div>
      </ThreeColumnLayout>
      <Sheet
        open={surface !== null}
        onOpenChange={(open) => {
          if (!open) setSurface(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="sc-play-sheet"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <div className="sc-grab" aria-hidden="true" />
          <SheetTitle>{surface}</SheetTitle>
          <SheetDescription className="sr-only">
            {surface === "Layout and HUD"
              ? "Choose which panels and declared modules surround your story."
              : `Your ${surface ?? "story"}`}
          </SheetDescription>
          {surface === "Character" && character}
          {surface === "Here" && here}
          {surface === "Journal" && (
            <div className="sc-journal">
              {logs.length ? (
                logs.map((log) => <p key={log.id}>{log.text}</p>)
              ) : (
                <p>No moments yet.</p>
              )}
            </div>
          )}
          {surface === "Actions" && (
            <div className="sc-tray">
              {(["Character", "Here", "Journal", "Layout and HUD"] as const)
                .filter(
                  (item) =>
                    item !== "Character" || view.player || view.modules.length,
                )
                .filter(
                  (item) => item !== "Here" || view.scene || view.presence,
                )
                .map((item) => (
                  <Button
                    key={item}
                    variant="outline"
                    className="sc-action"
                    onClick={() => {
                      setSurface(item);
                    }}
                  >
                    Open {item}
                  </Button>
                ))}
              <Button
                variant="outline"
                className="sc-action"
                onClick={() => {
                  toggleFocus();
                  setSurface(null);
                }}
              >
                {layout.focus ? "Exit focus" : "Enter focus"}
              </Button>
            </div>
          )}
          {surface === "Layout and HUD" && (
            <div className="sc-layout-options">
              <p className="sc-muted">Choose what surrounds your story.</p>
              {(["left", "right"] as const).map((side) => (
                <fieldset key={side}>
                  <legend>{side === "left" ? "Character" : "Here"}</legend>
                  <div className="sc-options">
                    {(["open", "slim", "hidden"] as const).map((mode) => (
                      <Button
                        key={
                          mode === "open"
                            ? "Open"
                            : mode === "slim"
                              ? "Slim"
                              : "Hidden"
                        }
                        className="sc-action"
                        variant={layout[side] === mode ? "default" : "outline"}
                        aria-pressed={layout[side] === mode}
                        onClick={() => {
                          setPanel(side, mode);
                        }}
                      >
                        {mode === "open"
                          ? "Open"
                          : mode === "slim"
                            ? "Slim"
                            : "Hidden"}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              ))}
              {moduleList.map((module) => (
                <fieldset key={module.id}>
                  <legend>{module.label}</legend>
                  <div className="sc-options">
                    {(["always", "on_change", "never"] as ModulePolicy[])
                      .filter(
                        (policy) =>
                          policy !== "on_change" ||
                          (module.id !== "scene" && module.id !== "cast"),
                      )
                      .map((policy) => (
                        <Button
                          key={policy}
                          className="sc-action"
                          variant={
                            (layout.modules[module.id] ?? "always") === policy
                              ? "default"
                              : "outline"
                          }
                          aria-pressed={
                            (layout.modules[module.id] ?? "always") === policy
                          }
                          onClick={() => {
                            setPolicy(module.id, policy);
                          }}
                        >
                          {policy === "on_change"
                            ? "On change"
                            : policy === "always"
                              ? "Always"
                              : "Never"}
                        </Button>
                      ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
