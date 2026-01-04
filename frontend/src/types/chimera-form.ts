
export interface FormHint {
    label: string;
    control: "text" | "dropdown" | "slider" | "tag_list";
    options?: string[]; // Simple list
    groups?: { label: string; options: string[] }[]; // Categorized list
    depends_on?: { field: string; value: any };
    default?: any;
    min?: number;
    max?: number;
    description?: string;
    placeholder?: string;
}
