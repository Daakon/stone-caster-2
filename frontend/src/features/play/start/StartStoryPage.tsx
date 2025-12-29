
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api'; // Using raw apiFetch if specific method doesn't exist yet
import { mergeCharacterSchema } from './utils/schemaMerger';
import { Loader2, AlertTriangle } from 'lucide-react';
import CharacterCreatorWizard from '../create/CharacterCreatorWizard'; // Adjust path if needed

// Use a simplified type for the Compiled Story payload since it's complex
// We just need the parts relevant to the merger
interface CompiledStoryPayload {
    id: string;
    display_name: string;
    [key: string]: any;
}

import StartGatewayPage from './StartGatewayPage';

export default function StartStoryPage() {
    return <StartGatewayPage />;
}
