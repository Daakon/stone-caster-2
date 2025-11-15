/**
 * Content Pack Management Page
 * Placeholder for future pack management features
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PackManage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/packs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Manage Content Pack</h1>
          <p className="text-muted-foreground mt-2">Pack ID: {id}</p>
        </div>
      </div>
    </div>
  );
}

