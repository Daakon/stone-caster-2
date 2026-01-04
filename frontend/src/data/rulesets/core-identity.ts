import type { RulesetTemplate } from '../../services/admin.chimera';

export const UNIVERSAL_IDENTITY_RULESET: Partial<RulesetTemplate> & { key?: string } = {
    id: "core-identity-universal",
    key: "core-identity-universal",
    definition: {
        name: "Universal Identity",
        description_short: "Core narrative identity fields required for all characters.",
        state_contributions: {
            tier1_entity: {
                form_hints: {
                    name: {
                        label: "Character Name",
                        control: "text",
                        default: "",
                        ui_step: "identity",
                        ui_step_priority: 10,
                        ui_group: "Essentials",
                        ui_group_priority: 0,
                        ui_order: 0
                    },
                    pronouns: {
                        label: "Pronouns",
                        control: "dropdown",
                        options: ["He/Him", "She/Her", "They/Them", "It/Its", "Any", "Ask Me"],
                        default: "They/Them",
                        ui_step: "identity",
                        ui_step_priority: 10,
                        ui_group: "Essentials",
                        ui_group_priority: 0,
                        ui_order: 1
                    },
                    age: {
                        label: "Age / Apparent Age",
                        control: "text", // Text allows "Unknown" or "Ancient"
                        default: "25",
                        ui_step: "identity",
                        ui_step_priority: 10,
                        ui_group: "Essentials",
                        ui_group_priority: 0,
                        ui_order: 2
                    },
                    appearance: {
                        label: "Physical Description",
                        control: "textarea",
                        default: "",
                        ui_step: "identity",
                        ui_step_priority: 10,
                        ui_group: "Visuals",
                        ui_group_priority: 10,
                        ui_order: 0
                    },
                    backstory: {
                        label: "History & Origin",
                        control: "textarea",
                        default: "",
                        ui_step: "identity",
                        ui_step_priority: 10,
                        ui_group: "History",
                        ui_group_priority: 20,
                        ui_order: 0
                    }
                },
                definitions: {
                    name: {
                        value: "Nameless",
                        description: "The primary name used to refer to this entity.",
                        context_priority: "ai_visible"
                    },
                    pronouns: {
                        value: "They/Them",
                        description: "Grammatical pronouns used for this entity.",
                        context_priority: "ai_visible"
                    },
                    age: {
                        value: "Unknown",
                        description: "The chronological or apparent age of the entity.",
                        context_priority: "ai_visible"
                    },
                    appearance: {
                        value: "",
                        description: "Visual details: hair, eyes, build, clothing style.",
                        context_priority: "ai_visible"
                    },
                    backstory: {
                        value: "",
                        description: "Past events that shaped this entity.",
                        context_priority: "ai_visible"
                    }
                },
                target_kind: ["player", "npc"]
            }
        }
    }
};
