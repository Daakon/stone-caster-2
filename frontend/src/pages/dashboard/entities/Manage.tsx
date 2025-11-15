/**
 * Entity Management Page
 * Placeholder for future entity management features
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function EntityManage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/entities')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Manage Entity</h1>
          <p className="text-muted-foreground mt-2">Entity ID: {id}</p>
        </div>
      </div>
    </div>
  );
}

