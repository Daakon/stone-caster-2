/**
 * Admin Home Page
 * Phase 2: Dashboard with key metrics and navigation
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppRoles } from '@/admin/routeGuard';

export default function AdminHome() {
  const { isCreator, isModerator, isAdmin } = useAppRoles();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the StoneCaster admin panel. Manage content, review submissions, and configure the system.
        </p>
      </div>

      {/* Role-based content */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Public Entry Points</CardTitle>
            <Badge variant="secondary">TODO</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Public entry points available to users
            </p>
          </CardContent>
        </Card>

        {isCreator && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Drafts</CardTitle>
              <Badge variant="outline">TODO</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Your unpublished content
              </p>
            </CardContent>
          </Card>
        )}

        {(isModerator || isAdmin) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Badge variant="destructive">TODO</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Items awaiting moderation
              </p>
            </CardContent>
          </Card>
        )}

        {(isModerator || isAdmin) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reports</CardTitle>
              <Badge variant="secondary">TODO</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                System reports and analytics
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium">Content Creation</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Create new entry point</li>
                <li>• Add prompt segments</li>
                <li>• Manage NPCs</li>
              </ul>
            </div>
            
            {(isModerator || isAdmin) && (
              <div className="space-y-2">
                <h4 className="font-medium">Moderation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Review submissions</li>
                  <li>• Approve content</li>
                  <li>• Manage reports</li>
                </ul>
              </div>
            )}

            {isAdmin && (
              <div className="space-y-2">
                <h4 className="font-medium">Administration</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Manage user roles</li>
                  <li>• System configuration</li>
                  <li>• Analytics & reports</li>
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
