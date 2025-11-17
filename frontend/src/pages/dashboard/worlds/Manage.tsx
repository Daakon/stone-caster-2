/**
 * World Management Page
 * Placeholder for future world management features
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function WorldManage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/creations/worlds')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Manage World</h1>
          <p className="text-muted-foreground mt-2">World ID: {id}</p>
        </div>
      </div>
    </div>
  );
}

