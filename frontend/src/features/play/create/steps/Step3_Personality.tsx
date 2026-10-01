import type { SchemaField } from "../utils/schemaSplitter";

import { DynamicControl } from "../components/DynamicControl";

interface Step3Props {
  data: Record<string, unknown>;
  updateData: (key: string, value: unknown) => void;
  schema: Record<string, SchemaField>; // SplittedSchema['personality']
}

export function Step3_Personality({ data, updateData, schema }: Step3Props) {
  const keys = Object.keys(schema);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Soul & Drive</h2>
        <p className="text-muted-foreground">
          What motivates your character? Define their inner world.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 pt-2">
        {keys.length === 0 && (
          <div className="text-muted-foreground italic">
            No additional personality traits defined. You're ready to start!
          </div>
        )}

        {Object.entries(schema).map(([key, field]) => (
          <DynamicControl
            key={key}
            fieldKey={key}
            schema={field}
            value={data[key]}
            onChange={(val) => {
              updateData(key, val);
            }}
            hint={{
              ui_widget: field.type === "array" ? "tag_list" : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
