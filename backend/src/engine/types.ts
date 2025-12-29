import { InterpreterConfig } from '../services/compiler/refiners/interpreter.refiner';

// 1. Runtime Types (The Engine)
export interface RuntimeSchema {
    [key: string]: {
        type: string; // 'number', 'string', 'boolean'
        min?: number;
        max?: number;
        defaultValue: any;
        // No labels, no dropdowns, no UI noise
    };
}

export interface RuntimeConfig {
    logic: InterpreterConfig;      // Intents & Constraints (Uses the Config object from InterpreterRefiner)
    actions: Record<string, any>;  // Action Definitions
    schema: RuntimeSchema;         // Validation Rules only
}

// 2. Creation Types (The UI Wizard)
export interface CreationField {
    key: string;
    label: string;
    control: string; // 'slider', 'dropdown', 'text', 'tag_list'
    options?: string[];
    suggestions?: string[];
    min?: number;
    max?: number;
    description?: string;
    entity?: string;
    category?: string;
}

export interface CreationConfig {
    fields: CreationField[]; // Ordered list for the UI
}

// 3. The Master Cartridge
export interface CompiledCartridge {
    runtime: RuntimeConfig;
    creation: CreationConfig;
}
