import { record, text, strings } from "./value";
export interface EntityDisplay {
  name: string;
  role: string;
  isUnknown: boolean;
}
export function resolveEntityDisplay(entity: unknown): EntityDisplay {
  const data = record(entity),
    props = record(data.properties),
    raw = record(data.raw_data);
  const identity = record(raw.identity),
    tiers = record(raw.tier1_entity);
  const name =
    text(data.display_name) ||
    text(props.display_name) ||
    text(props.name) ||
    text(identity.name) ||
    text(data.name) ||
    "Unknown Entity";
  const role =
    text(props.archetype) ||
    strings(props.occupation_tags)[0] ||
    text(identity.species) ||
    text(props.race) ||
    strings(tiers.occupation_tags)[0] ||
    "Unknown Role";
  return { name, role, isUnknown: /unknown|figure/i.test(name) };
}
export function resolveEntityDescription(entity: unknown): string | null {
  const data = record(entity),
    raw = record(data.raw_data);
  return (
    text(record(data.properties).description) ||
    text(data.description) ||
    text(record(raw.identity).description) ||
    text(record(raw.tier1_entity).description) ||
    null
  );
}
export interface EntityVitals {
  hp: number | null;
  maxHp: number;
  stamina: number | null;
  combatCondition: string | null;
  physicalCondition: string | null;
}
export function resolveEntityVitals(entity: unknown): EntityVitals {
  const props = record(record(entity).properties);
  return {
    hp: typeof props.hp === "number" ? props.hp : null,
    maxHp:
      typeof props.maxHp === "number"
        ? props.maxHp
        : typeof props.max_hp === "number"
          ? props.max_hp
          : 100,
    stamina:
      typeof props.current_stamina === "number"
        ? props.current_stamina
        : typeof props.stamina === "number"
          ? props.stamina
          : null,
    combatCondition: text(props.combat_condition) || null,
    physicalCondition: text(props.physical_condition) || null,
  };
}
