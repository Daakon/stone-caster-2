import type { SchemaField } from "../utils/schemaSplitter";
import { record, text } from "../../utils/value";

function toFormHint(key: string, field: SchemaField | undefined): FormHint {
  return {
    label: field?.label ?? key,
    control: field?.control ?? "text",
    options: field?.enum,
    min: field?.minimum,
    max: field?.maximum,
  };
}
import type { FormHint } from "@/types/chimera-form";
import { DynamicSchemaField } from "@/components/form/DynamicSchemaField";
import { Separator } from "@/components/ui/separator";

interface Step2Props {
  data: Record<string, unknown>;
  updateData: (key: string, value: unknown) => void;
  schema: Record<string, SchemaField>;
  activeRulesets: unknown[];
}

interface GroupedHints {
  rulesetTitle: string;
  hints: Record<string, FormHint>;
}

export function Step2_Attributes({ schema, activeRulesets }: Step2Props) {
  const groups: GroupedHints[] = [];
  const assignedKeys = new Set<string>();

  if (activeRulesets.length > 0) {
    activeRulesets.forEach((ruleset) => {
      const data = record(ruleset);
      const contributions = record(
        record(data.character_schema_contributions).tier1_entity,
      );

      const rulesetHints: Record<string, FormHint> = {};

      {
        Object.keys(record(contributions.definitions)).forEach((key) => {
          const field = schema[key];
          if (field) {
            rulesetHints[key] = toFormHint(key, field);
            assignedKeys.add(key);
          }
        });
      }

      if (Object.keys(rulesetHints).length > 0) {
        groups.push({
          rulesetTitle:
            text(data.display_name) || text(data.name) || "Unknown Ruleset",
          hints: rulesetHints,
        });
      }
    });
  }

  const remainingHints: Record<string, FormHint> = {};
  Object.entries(schema).forEach(([key, field]) => {
    if (!assignedKeys.has(key)) {
      remainingHints[key] = toFormHint(key, field);
    }
  });

  if (Object.keys(remainingHints).length > 0) {
    groups.push({
      rulesetTitle: "General Attributes",
      hints: remainingHints,
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Attributes</h2>
        <p className="text-muted-foreground">
          Define your specific capabilities and stats.
        </p>
      </div>

      <div className="space-y-8">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-primary">
                {group.rulesetTitle}
              </h3>
              <Separator className="flex-1" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {Object.entries(group.hints).map(([key, hint]) => (
                <DynamicSchemaField key={key} name={key} hint={hint} />
              ))}
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <div className="text-muted-foreground italic">
            No attributes to configure.
          </div>
        )}
      </div>
    </div>
  );
}
