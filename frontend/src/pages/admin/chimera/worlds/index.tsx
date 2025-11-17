/**
 * Chimera Worlds Admin Page
 * Admin interface for managing Chimera V2 worlds
 */

import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';
import { makeTitle } from '@/lib/meta';
import { useEffect } from 'react';

export default function ChimeraWorldsAdmin() {
  useEffect(() => {
    document.title = makeTitle(['Chimera Worlds', 'Admin']);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chimera Worlds</h1>
          <p className="text-muted-foreground mt-2">
            Manage Chimera V2 worlds
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/creations/worlds">
            <Plus className="mr-2 h-4 w-4" />
            Manage My Worlds
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>World Management</CardTitle>
          <CardDescription>
            Use the "Manage My Worlds" button above to access your personal world creation dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This admin interface will be expanded in the future to include administrative tools for managing all worlds across the platform.
          </p>
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link to="/dashboard/creations/worlds">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go to My Creations Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

