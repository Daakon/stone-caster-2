import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { worldsService } from '@/services/authoring/worlds.service';
import type { WorldDefinition } from '@/types/chimera-domain';

const formSchema = z.object({
    title: z.string().min(2, 'Title must be at least 2 characters'),
    summary: z.string().min(10, 'Summary must be at least 10 characters'),
    genre_tags: z.string(), // Comma separated for simplicity in this modal
});

interface CreateWorldModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onWorldCreated: (world: WorldDefinition) => void;
}

export function CreateWorldModal({ open, onOpenChange, onWorldCreated }: CreateWorldModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            summary: '',
            genre_tags: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSubmitting(true);
        try {
            const tags = values.genre_tags.split(',').map(t => t.trim()).filter(Boolean);
            const newWorld = await worldsService.createWorld({
                title: values.title,
                summary: values.summary,
                genre_tags: tags.length > 0 ? tags : ['custom'],
                safety_filters: ['pg'],
                ruleset_keys: ['foundation-d100-5-pillars'], // Default for custom worlds
            });

            onWorldCreated(newWorld);
            onOpenChange(false);
            form.reset();
        } catch (error) {
            console.error('Failed to create world:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create New World</DialogTitle>
                    <DialogDescription>
                        Forge a new realm from scratch. You can refine details later.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>World Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="E.g., The Shimmering Isles" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="summary"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Summary</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Brief description of the setting..."
                                            className="resize-none min-h-[100px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="genre_tags"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tags (comma separated)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Fantasy, Steampunk, Dark..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="mt-6">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create World
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
