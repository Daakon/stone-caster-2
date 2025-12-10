import { useState, useEffect } from 'react';
import {
    useLoreByWorld,
    useCreateLore,
    useUpdateLore,
    useDeleteLore
} from '@/services/chimera-api';
import type { ChimeraLoreType } from '@/types/chimera-v2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { KeywordInput } from '@/components/forms/shared/KeywordInput';
import { Plus, Pencil, Trash2, ArrowLeft, Save, Loader2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getLoreTypesForContext, getLoreTypeColor, type LoreContextType } from '@/utils/lore-context';

interface LoreManagerProps {
    worldId: string;
    contextType?: LoreContextType;
    onSubEditorChange?: (isOpen: boolean) => void;
}

type EditorMode = 'LIST' | 'CREATE' | 'EDIT';

const MAX_CONTENT_LENGTH = 1500;

export function LoreManager({ worldId, contextType = 'world', onSubEditorChange }: LoreManagerProps) {
    const { data: fragments, isLoading, error } = useLoreByWorld(worldId);
    const createLore = useCreateLore();
    const updateLore = useUpdateLore();
    const deleteLore = useDeleteLore();

    // Get valid types for this context
    const validLoreTypes = getLoreTypesForContext(contextType);
    const defaultType = validLoreTypes[0]?.value || 'general';

    const [mode, setMode] = useState<EditorMode>('LIST');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        type: defaultType as ChimeraLoreType,
        content: '',
        keywords: [] as string[]
    });

    const [validationError, setValidationError] = useState<string | null>(null);

    // Notify parent of sub-editor state
    useEffect(() => {
        if (onSubEditorChange) {
            onSubEditorChange(mode === 'CREATE' || mode === 'EDIT');
        }
    }, [mode, onSubEditorChange]);

    // Reset form when entering edit/create mode
    useEffect(() => {
        setValidationError(null);
        if (mode === 'CREATE') {
            setFormData({ title: '', type: defaultType, content: '', keywords: [] });
        } else if (mode === 'EDIT' && editingId && fragments) {
            const fragment = fragments.find(f => f.id === editingId);
            if (fragment) {
                setFormData({
                    title: fragment.title || '',
                    type: fragment.type || defaultType,
                    content: fragment.content || '',
                    keywords: fragment.keywords || []
                });
            }
        }
    }, [mode, editingId, fragments, defaultType]);

    const handleSave = async () => {
        if (!formData.title.trim()) {
            setValidationError("Title is required.");
            return;
        }
        if (!formData.content.trim()) {
            setValidationError("Content cannot be empty.");
            return;
        }
        if (formData.content.length > MAX_CONTENT_LENGTH) {
            setValidationError(`Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters.`);
            return;
        }

        try {
            if (mode === 'CREATE') {
                await createLore.mutateAsync({
                    world_id: worldId,
                    title: formData.title,
                    type: formData.type,
                    content: formData.content,
                    keywords: formData.keywords
                });
            } else if (mode === 'EDIT' && editingId) {
                await updateLore.mutateAsync({
                    id: editingId,
                    data: {
                        title: formData.title,
                        type: formData.type,
                        content: formData.content,
                        keywords: formData.keywords
                    }
                });
            }
            setMode('LIST');
            setEditingId(null);
        } catch (err) {
            console.error("Failed to save lore:", err);
            setValidationError("Failed to save lore fragment. Please try again.");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this lore fragment?")) {
            await deleteLore.mutateAsync(id);
        }
    };

    const startEdit = (id: string) => {
        setEditingId(id);
        setMode('EDIT');
    };

    // --- Loading State ---
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // --- Error State ---
    if (error) {
        return (
            <div className="p-4 text-red-500 bg-red-900/10 rounded border border-red-900/20">
                Failed to load lore fragments.
            </div>
        );
    }

    // --- Editor Mode ---
    if (mode === 'CREATE' || mode === 'EDIT') {
        const isSaving = createLore.isPending || updateLore.isPending;
        const modeTitle = mode === 'CREATE' ? 'New Lore Fragment' : 'Edit Lore Fragment';
        const contentLength = formData.content.length;
        const memoryCostPercent = Math.min(100, (contentLength / MAX_CONTENT_LENGTH) * 100);

        return (
            <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-stone-800 pb-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMode('LIST')}
                            className="text-stone-400 hover:text-stone-200"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <h2 className="text-xl font-semibold text-stone-200">{modeTitle}</h2>
                    </div>
                </div>

                {validationError && (
                    <Alert variant="destructive" className="bg-red-900/20 border-red-900/50 text-red-200">
                        <AlertTitle>Validation Error</AlertTitle>
                        <AlertDescription>{validationError}</AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Form Area */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="lore-title" className="text-stone-300">Title</Label>
                            <Input
                                id="lore-title"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g. The Age of Storms"
                                maxLength={60}
                                className="bg-stone-900 border-stone-800 focus:border-primary/50"
                            />
                            <div className="text-right text-xs text-stone-500">{formData.title.length}/60</div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="lore-content" className="text-stone-300">Content</Label>
                                <span className={cn(
                                    "text-xs font-mono",
                                    contentLength > MAX_CONTENT_LENGTH ? "text-red-400" : "text-stone-500"
                                )}>
                                    {contentLength} / {MAX_CONTENT_LENGTH} chars
                                </span>
                            </div>
                            <Textarea
                                id="lore-content"
                                value={formData.content}
                                onChange={(e) => {
                                    if (e.target.value.length <= MAX_CONTENT_LENGTH) {
                                        setFormData(prev => ({ ...prev, content: e.target.value }))
                                    }
                                }}
                                placeholder="Describe this historical event, person, or secret..."
                                className="bg-stone-900 border-stone-800 focus:border-primary/50 min-h-[300px] font-serif leading-relaxed resize-none"
                            />
                            {/* Memory Cost Visualization */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-stone-500 uppercase tracking-wider">
                                    <span>Memory Cost</span>
                                    <span>{Math.round(memoryCostPercent)}%</span>
                                </div>
                                <Progress value={memoryCostPercent} className="h-1 bg-stone-800" />
                            </div>
                        </div>
                    </div>

                    {/* Sidebar / Metadata */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-stone-300">Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(val: any) => setFormData(prev => ({ ...prev, type: val }))}
                            >
                                <SelectTrigger className="bg-stone-900 border-stone-800 text-stone-200">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent className="bg-stone-900 border-stone-800">
                                    {validLoreTypes.map(t => (
                                        <SelectItem key={t.value} value={t.value} className="text-stone-200 focus:bg-stone-800 focus:text-stone-100 cursor-pointer">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-2 h-2 rounded-full", t.color)} />
                                                {t.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-stone-500 leading-snug">
                                {contextType === 'world' ? 'Categorizing history and geography.' :
                                    contextType === 'npc' ? 'Defining memories and secrets.' :
                                        contextType === 'item' ? 'Defining origins and curses.' :
                                            'Categorizing lore.'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-stone-300">Keywords</Label>
                            <KeywordInput
                                value={formData.keywords}
                                onChange={(keywords) => setFormData(prev => ({ ...prev, keywords }))}
                                placeholder="Add keyword (e.g. 'King Alaric')"
                                className="w-full"
                            />
                            <p className="text-xs text-stone-500 leading-snug">
                                Specific entities or concepts referenced in this text.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-stone-800">
                    <Button
                        variant="ghost"
                        onClick={() => setMode('LIST')}
                        className="text-stone-400 hover:text-stone-200"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !formData.title || !formData.content}
                        className="gap-2 min-w-[140px]"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Fragment
                    </Button>
                </div>
            </div>
        );
    }

    // --- List Mode ---
    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-medium text-stone-200">Lore Fragments</h2>
                    <p className="text-sm text-stone-500">Atomic memories that feed the AI storyteller.</p>
                </div>
                <Button onClick={() => setMode('CREATE')} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Fragment
                </Button>
            </div>

            {(!fragments || fragments.length === 0) ? (
                <div className="flex flex-col items-center justify-center p-16 border border-dashed border-stone-800 rounded-lg bg-stone-900/30 text-stone-500 animate-in fade-in duration-500">
                    <div className="p-4 rounded-full bg-stone-900/50 mb-4">
                        <Info className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-lg font-medium text-stone-300 mb-2">No lore fragments yet</p>
                    <p className="text-sm text-center max-w-sm mb-6">
                        Add memories, secrets, or history to build your world's knowledge base.
                    </p>
                    <Button variant="secondary" onClick={() => setMode('CREATE')}>
                        Create your first fragment
                    </Button>
                </div>
            ) : (
                <div className="rounded-md border border-stone-800 bg-stone-900/50 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-stone-900">
                            <TableRow className="hover:bg-stone-900 border-stone-800">
                                <TableHead className="text-stone-400 w-[250px]">Title</TableHead>
                                <TableHead className="text-stone-400 w-[120px]">Type</TableHead>
                                <TableHead className="text-stone-400">Preview</TableHead>
                                <TableHead className="text-stone-400 w-[200px]">Keywords</TableHead>
                                <TableHead className="text-right text-stone-400 w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fragments.map((fragment) => (
                                <TableRow key={fragment.id} className="border-stone-800 hover:bg-stone-800/50 transition-colors">
                                    <TableCell className="font-medium text-stone-200">
                                        {fragment.title}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="secondary"
                                            className={cn("text-[10px] uppercase tracking-wider font-semibold text-white border-0", getLoreTypeColor(fragment.type))}
                                        >
                                            {fragment.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-stone-400 truncate max-w-[300px]">
                                        {fragment.content.length > 80
                                            ? fragment.content.slice(0, 80) + '...'
                                            : fragment.content}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {fragment.keywords?.slice(0, 2).map(k => (
                                                <Badge key={k} variant="outline" className="text-stone-400 border-stone-700 text-[10px] h-5">
                                                    {k}
                                                </Badge>
                                            ))}
                                            {fragment.keywords && fragment.keywords.length > 2 && (
                                                <span className="text-xs text-stone-500 self-center">+{fragment.keywords.length - 2}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => startEdit(fragment.id)}
                                                className="h-8 w-8 p-0 text-stone-400 hover:text-white"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(fragment.id)}
                                                className="h-8 w-8 p-0 text-stone-400 hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
