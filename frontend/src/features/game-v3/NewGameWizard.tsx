
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChimeraV3, type SetupConfig } from '@/services/chimera-v3';
import { ChevronRight, Dna, Shield, AlertTriangle } from 'lucide-react';

export default function NewGameWizard() {
    const { id: storyId } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [config, setConfig] = useState<SetupConfig | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!storyId) return;

        const loadConfig = async () => {
            try {
                const cfg = await ChimeraV3.getSetupConfig(storyId);
                setConfig(cfg);

                // Initialize defaults
                const defaults: Record<string, any> = {};
                Object.values(cfg.fields).flat().forEach(field => {
                    defaults[field.key] = field.default ?? (field.min ?? '');
                });
                setFormData(defaults);
            } catch (err: any) {
                setError(err.message || 'Failed to load setup configuration');
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, [storyId]);

    const handleChange = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!storyId) return;

        setSubmitting(true);
        try {
            const result = await ChimeraV3.startGame(storyId, formData);
            if (result.success) {
                navigate(`/play/v3/${result.instanceId}`);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to start game');
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <Dna className="w-12 h-12 text-emerald-500 animate-spin" />
                <p className="text-slate-400 font-mono">Initializing Neural Link...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950">
            <div className="bg-red-950/30 border border-red-800 rounded-lg p-8 max-w-md text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-red-400 mb-2">Initialization Failed</h2>
                <p className="text-red-300/80 mb-6">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-900/50 hover:bg-red-800/50 text-red-200 rounded border border-red-700 transition-colors"
                >
                    Retry Connection
                </button>
            </div>
        </div>
    );

    if (!config) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/30">
            {/* Header / Hero */}
            <div className="relative h-64 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 to-slate-950 border-b border-emerald-500/10" />
                <div className="max-w-4xl mx-auto px-6 h-full flex flex-col justify-end pb-12 relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-5 h-5 text-emerald-500" />
                        <span className="text-emerald-500 font-mono text-sm tracking-widest uppercase">New Game Initialization</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-100 to-slate-400">
                        {config.storyTitle}
                    </h1>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-6 py-12">
                <form onSubmit={handleSubmit} className="space-y-12">
                    {Object.entries(config.fields).map(([category, fields]) => (
                        <div key={category} className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in fill-mode-backwards">
                            <div className="flex items-center gap-4">
                                <h3 className="text-2xl font-light text-white capitalize">{category}</h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {fields.map(field => (
                                    <div key={field.key} className="group relative bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
                                        <label className="block text-sm font-medium text-slate-300 mb-2 group-hover:text-emerald-400 transition-colors">
                                            {field.label}
                                        </label>

                                        {field.description && (
                                            <p className="text-xs text-slate-500 mb-4 leading-relaxed">{field.description}</p>
                                        )}

                                        {field.control === 'slider' && (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-mono text-slate-500">{field.min}</span>
                                                    <span className="text-xl font-bold text-emerald-400 font-mono">{formData[field.key]}</span>
                                                    <span className="text-xs font-mono text-slate-500">{field.max}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={field.min}
                                                    max={field.max}
                                                    value={formData[field.key] || 0}
                                                    onChange={(e) => handleChange(field.key, Number(e.target.value))}
                                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-colors"
                                                />
                                            </div>
                                        )}

                                        {field.control === 'dropdown' && (
                                            <div className="relative">
                                                <select
                                                    value={formData[field.key] || ''}
                                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none appearance-none transition-all text-sm"
                                                >
                                                    {field.options?.map((opt: any) => {
                                                        const label = typeof opt === 'string' ? opt : opt.label;
                                                        const val = typeof opt === 'string' ? opt : opt.value;
                                                        return <option key={val} value={val}>{label}</option>;
                                                    })}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                    <ChevronRight className="w-4 h-4 rotate-90" />
                                                </div>
                                            </div>
                                        )}

                                        {(field.control === 'text' || (field.control as any) === 'tag_list') && (
                                            <input
                                                type={field.key === 'name' ? 'text' : 'text'}
                                                value={formData[field.key] || ''}
                                                onChange={(e) => handleChange(field.key, e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all text-sm placeholder:text-slate-700"
                                                placeholder={`Enter values for ${field.label}...`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="pt-12 border-t border-slate-800 flex justify-end">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="relative group bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-lg shadow-emerald-900/20"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <span className="relative flex items-center gap-3">
                                {submitting ? (
                                    <>
                                        <Dna className="w-5 h-5 animate-spin" />
                                        <span>Forging Soul...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Begin Adventure</span>
                                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </span>
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
