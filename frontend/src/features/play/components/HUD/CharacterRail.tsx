import type { PlayView, HudModule } from "../../model/play-view";
import type { ModulePolicy } from "../../model/layout";
import { ModuleCard } from "./ModuleCard";
import { Vital } from "./Vital";
import { Pillar } from "./Pillar";
import { ConditionPill } from "./ConditionPill";

export function ModuleContent({ module }: { module: HudModule }) {
  if (module.kind === "vitals")
    return (
      <>
        {module.fields.map((field) => (
          <Vital key={field.id} field={field} />
        ))}
      </>
    );
  if (module.kind === "pillars")
    return (
      <>
        {module.fields.map((field) => (
          <Pillar key={field.id} field={field} />
        ))}
      </>
    );
  if (module.kind === "conditions")
    return (
      <>
        {module.fields.map((field) => (
          <ConditionPill key={field.id} value={field.value} />
        ))}
      </>
    );
  return (
    <dl className="sc-values">
      {module.fields.map((field) => (
        <div key={field.id}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function CharacterRail({
  view,
  policies,
  onHide,
}: {
  view: PlayView;
  policies: Record<string, ModulePolicy>;
  onHide: (id: string) => void;
}) {
  return (
    <div className="sc-character">
      {view.player && (
        <div className="sc-identity">
          <span className="sc-avatar" aria-hidden="true">
            {view.player.name.slice(0, 1)}
          </span>
          <div>
            <h2>{view.player.name}</h2>
            {view.player.description && <p>{view.player.description}</p>}
          </div>
        </div>
      )}
      {view.modules
        .filter((module) => (policies[module.id] ?? "always") === "always")
        .map((module) => (
          <ModuleCard
            key={module.id}
            id={module.id}
            label={module.label}
            source={module.source}
            onHide={onHide}
          >
            <ModuleContent module={module} />
          </ModuleCard>
        ))}
    </div>
  );
}
