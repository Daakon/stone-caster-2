import React from 'react';
import { useMyWorlds, useMyEntities, useMyStories } from '../../services/chimera-api';

export function ApiConnectionTest() {
    const { data: worlds, isLoading: loadingWorlds, error: errorWorlds } = useMyWorlds();
    const { data: entities, isLoading: loadingEntities, error: errorEntities } = useMyEntities();
    const { data: stories, isLoading: loadingStories, error: errorStories } = useMyStories();

    return (
        <div className="p-4 bg-gray-900 text-white font-mono text-sm max-h-[80vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4 text-emerald-400">API Connection Test</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Worlds Section */}
                <div className="border border-gray-700 p-4 rounded">
                    <h3 className="font-bold mb-2 border-b border-gray-700 pb-2">Worlds ({worlds?.length ?? 0})</h3>
                    {loadingWorlds && <div className="text-yellow-400">Loading worlds...</div>}
                    {errorWorlds && <div className="text-red-400">Error: {(errorWorlds as Error).message}</div>}
                    {worlds && (
                        <pre className="text-xs bg-black p-2 rounded overflow-auto h-64">
                            {JSON.stringify(worlds, null, 2)}
                        </pre>
                    )}
                </div>

                {/* Entities Section */}
                <div className="border border-gray-700 p-4 rounded">
                    <h3 className="font-bold mb-2 border-b border-gray-700 pb-2">Entities ({entities?.length ?? 0})</h3>
                    {loadingEntities && <div className="text-yellow-400">Loading entities...</div>}
                    {errorEntities && <div className="text-red-400">Error: {(errorEntities as Error).message}</div>}
                    {entities && (
                        <pre className="text-xs bg-black p-2 rounded overflow-auto h-64">
                            {JSON.stringify(entities, null, 2)}
                        </pre>
                    )}
                </div>

                {/* Stories Section */}
                <div className="border border-gray-700 p-4 rounded">
                    <h3 className="font-bold mb-2 border-b border-gray-700 pb-2">Stories ({stories?.length ?? 0})</h3>
                    {loadingStories && <div className="text-yellow-400">Loading stories...</div>}
                    {errorStories && <div className="text-red-400">Error: {(errorStories as Error).message}</div>}
                    {stories && (
                        <pre className="text-xs bg-black p-2 rounded overflow-auto h-64">
                            {JSON.stringify(stories, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
}
