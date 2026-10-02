import type { PlayView } from "../../model/play-view";
import type { ModulePolicy } from "../../model/layout";
import { ModuleCard } from "./ModuleCard";
export function HereRail({
  view,
  policies,
  onHide,
}: {
  view: PlayView;
  policies: Record<string, ModulePolicy>;
  onHide: (id: string) => void;
}) {
  return (
    <div className="sc-here">
      {view.scene && (policies.scene ?? "always") === "always" && (
        <ModuleCard id="scene" label="Here" onHide={onHide}>
          <div className="sc-scene-card">
            <div className="sc-scene-art" aria-hidden="true">
              <span />
              <i />
            </div>
            {view.scene.name && <h2>{view.scene.name}</h2>}
            <div className="sc-scene-details">
              {view.scene.tags?.length ? (
                <div className="sc-tags">
                  {view.scene.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
              {view.scene.time && <p>{view.scene.time}</p>}
              {view.scene.atmosphere && (
                <p className="sc-muted">{view.scene.atmosphere}</p>
              )}
            </div>
          </div>
        </ModuleCard>
      )}
      {view.presence && (policies.cast ?? "always") === "always" && (
        <ModuleCard id="cast" label="Present" onHide={onHide}>
          {view.presence.availability === "empty" ? (
            <p>No one else is here.</p>
          ) : (
            view.presence.cast.map((person) => (
              <article className="sc-cast-card" key={person.id}>
                <span
                  className={`sc-avatar${person.identified ? "" : " sc-unidentified"}`}
                  aria-hidden="true"
                >
                  {person.identified ? person.name.slice(0, 1) : "?"}
                </span>
                <div>
                  <h3>{person.name}</h3>
                  {person.role && <p>{person.role}</p>}
                  {(person.disposition || person.known_count !== undefined) && (
                    <p className="sc-muted">
                      {person.disposition}
                      {person.disposition && person.known_count !== undefined
                        ? " · "
                        : ""}
                      {person.known_count !== undefined &&
                        `${String(person.known_count)} things known`}
                    </p>
                  )}
                </div>
              </article>
            ))
          )}
        </ModuleCard>
      )}
    </div>
  );
}
