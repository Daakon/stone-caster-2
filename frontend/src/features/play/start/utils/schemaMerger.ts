import { record, text, strings } from "../../utils/value";
import type {
  SchemaField,
  Tier1Schema,
} from "../../create/utils/schemaSplitter";

function schemaField(value: unknown): SchemaField {
  const data = record(value);
  return {
    ...data,
    type: text(data.type) || undefined,
    label: text(data.label) || undefined,
    description: text(data.description) || undefined,
    enum: Array.isArray(data.enum) ? strings(data.enum) : undefined,
    minimum: typeof data.minimum === "number" ? data.minimum : undefined,
    maximum: typeof data.maximum === "number" ? data.maximum : undefined,
    maxLength: typeof data.maxLength === "number" ? data.maxLength : undefined,
  };
}
function schema(value: unknown): Tier1Schema {
  const data = record(value);
  return {
    definitions: Object.fromEntries(
      Object.entries(record(data.definitions)).map(([key, field]) => [
        key,
        schemaField(field),
      ]),
    ),
    form_hints: Object.fromEntries(
      Object.entries(record(data.form_hints)).map(([key, hint]) => {
        const h = record(hint);
        return [
          key,
          {
            ...h,
            ui_widget: text(h.ui_widget) || undefined,
            section: text(h.section) || undefined,
            hidden: h.hidden === true,
            order: typeof h.order === "number" ? h.order : undefined,
          },
        ];
      }),
    ),
  };
}
function deepMerge(target: unknown, source: unknown): unknown {
  if (typeof source !== "object" || source === null || Array.isArray(source))
    return source;
  const output = { ...record(target) };
  for (const [key, value] of Object.entries(record(source))) {
    if (key === "__proto__" || key === "constructor" || key === "prototype")
      continue;
    output[key] = deepMerge(output[key], value);
  }
  return output;
}
export function mergeCharacterSchema(compiledStory: unknown): Tier1Schema {
  const story = record(compiledStory),
    engine = record(story.config_engine),
    world = record(story.snapshot_world);
  const base = schema(record(engine.schema).tier1_entity);
  const override = schema(
    record(world.character_schema_contributions).tier1_entity,
  );
  const fields: unknown[] = Array.isArray(record(engine.creation).fields)
    ? (record(engine.creation).fields as unknown[])
    : [];
  for (const entry of fields) {
    const field = record(entry),
      key = text(field.key);
    if (!key) continue;
    if (!base.definitions[key] && !override.definitions[key])
      base.definitions[key] = {
        type:
          field.control === "slider" || field.min !== undefined
            ? "number"
            : "string",
        label: text(field.label),
        description: text(field.description),
        default: field.min,
      };
    base.form_hints ??= {};
    if (!base.form_hints[key] && !override.form_hints?.[key])
      base.form_hints[key] = {
        ui_widget: text(field.control),
        section: text(field.category, "general").toLowerCase(),
        ...{ min: field.min, max: field.max, options: field.options },
        order: 100,
      };
  }
  return schema(deepMerge(base, override));
}
