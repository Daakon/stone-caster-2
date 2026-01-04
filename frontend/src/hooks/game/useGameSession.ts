
import { useState, useEffect, useCallback } from 'react';
import { validateSessionIntegrity } from '@/engine/game/sessionValidator';
import type { SessionStatus, GameContext } from '@/engine/game/sessionValidator';
import { toast } from 'sonner';

export function useGameSession(storyId: string | null) {
    const [status, setStatus] = useState<SessionStatus>('loading');
    const [context, setContext] = useState<GameContext | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkSession = useCallback(async () => {
        if (!storyId) {
            setStatus('error');
            setError('No Story ID provided.');
            return;
        }

        setStatus('loading');
        setError(null);

        const result = await validateSessionIntegrity(storyId);

        if (result.status === 'error') {
            setStatus('error');
            setError(result.error || 'Unknown session error');
            // Optional: toast.error(result.error);
        } else {
            setStatus(result.status);
            if (result.context) {
                setContext(result.context);
            }
        }
    }, [storyId]);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    return {
        status,
        context,
        error,
        refresh: checkSession
    };
}
