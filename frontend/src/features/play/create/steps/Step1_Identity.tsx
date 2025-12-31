
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DynamicSchemaField } from '@/components/form/DynamicSchemaField';
import type { FormHint } from '@/types/chimera-form';

interface Step1Props {
    data: any;
    updateData: (key: string, value: any) => void;
    schema: any; // SplittedSchema['identity']
}

export function Step1_Identity({ data, updateData, schema }: Step1Props) {
    const specials = schema?.specialFields || {};

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Intro */}
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Who are you?</h2>
                <p className="text-muted-foreground">
                    Define the origin, look, and name of your character.
                </p>
            </div>

            {/* Core Identity Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="char-name">Name <span className="text-destructive">*</span></Label>
                    <Input
                        id="char-name"
                        placeholder="e.g. Lyra Sunweaver"
                        value={data.name || ''}
                        onChange={(e) => updateData('name', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="char-pronouns">Pronouns</Label>
                    <Select
                        value={data.pronouns || ''}
                        onValueChange={(val) => updateData('pronouns', val)}
                    >
                        <SelectTrigger id="char-pronouns">
                            <SelectValue placeholder="Select or type..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="They/Them">They/Them</SelectItem>
                            <SelectItem value="She/Her">She/Her</SelectItem>
                            <SelectItem value="He/Him">He/Him</SelectItem>
                            <SelectItem value="It/Its">It/Its</SelectItem>
                            <SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Special Selection Cards (Race/Class) if they exist */}
            {Object.keys(specials).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {Object.entries(specials).map(([key, def]) => {
                        const hint = def as unknown as FormHint;
                        return (
                            <DynamicSchemaField
                                key={key}
                                name={key}
                                hint={hint}
                            />
                        );
                    })}
                </div>
            )}

            {/* Narrative Fields */}
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="appearance">Appearance</Label>
                    <Textarea
                        id="appearance"
                        placeholder="Describe your character's physical features, clothing, and demeanor..."
                        className="min-h-[100px] resize-y"
                        value={data.appearance || ''}
                        onChange={(e) => updateData('appearance', e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="backstory">Backstory</Label>
                    <Textarea
                        id="backstory"
                        placeholder="Where do they come from? What drives them?"
                        className="min-h-[120px] resize-y"
                        value={data.backstory || ''}
                        onChange={(e) => updateData('backstory', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}
