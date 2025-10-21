/**
 * Roles Admin Page
 * Phase 5: Role management and user permissions
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, User, Crown, Search, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { rolesService, type UserRole, type AppRole, type RoleFilters } from '@/services/admin.roles';
import { useAppRoles } from '@/admin/routeGuard';

export default function RolesAdmin() {
  const { isAdmin } = useAppRoles();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RoleFilters>({});
  const [search, setSearch] = useState('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; email: string; name?: string }>>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    creators: 0,
    moderators: 0,
    admins: 0
  });

  // Load roles
  useEffect(() => {
    loadRoles();
    loadStats();
  }, [filters, search]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await rolesService.listRoles({
        ...filters,
        q: search || undefined
      });
      setRoles(response.data);
    } catch (error) {
      toast.error('Failed to load roles');
      console.error('Error loading roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await rolesService.getRoleStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await rolesService.searchUsers(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast.error('Please select a user and role');
      return;
    }

    try {
      await rolesService.assignRole(selectedUser.id, selectedRole);
      toast.success(`Role ${selectedRole} assigned to ${selectedUser.email}`);
      setIsAssignDialogOpen(false);
      setSelectedUser(null);
      setSelectedRole('');
      setUserSearch('');
      setSearchResults([]);
      loadRoles();
      loadStats();
    } catch (error) {
      toast.error('Failed to assign role');
      console.error('Error assigning role:', error);
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    if (!confirm(`Are you sure you want to remove the ${role} role from this user?`)) {
      return;
    }

    try {
      await rolesService.removeRole(userId, role);
      toast.success(`Role ${role} removed successfully`);
      loadRoles();
      loadStats();
    } catch (error) {
      toast.error('Failed to remove role');
      console.error('Error removing role:', error);
    }
  };

  const getRoleBadge = (role: AppRole) => {
    const variants = {
      creator: 'outline',
      moderator: 'secondary',
      admin: 'default'
    } as const;

    const icons = {
      creator: User,
      moderator: Shield,
      admin: Crown
    } as const;

    const Icon = icons[role];

    return (
      <Badge variant={variants[role]} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {role}
      </Badge>
    );
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Crown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You need admin permissions to manage roles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions across the system
          </p>
        </div>
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Assign Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Role</DialogTitle>
              <DialogDescription>
                Assign a role to a user
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-search">Search User</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="user-search"
                    placeholder="Search by email or user ID..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      handleSearchUsers(e.target.value);
                    }}
                    className="pl-10"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-md max-h-32 overflow-y-auto">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="p-2 hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setSelectedUser(user);
                          setUserSearch(user.email);
                          setSearchResults([]);
                        }}
                      >
                        <div className="font-medium">{user.email}</div>
                        {user.name && (
                          <div className="text-sm text-muted-foreground">{user.name}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-select">Role</Label>
                <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedUser && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Assigning {selectedRole} role to {selectedUser.email}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignRole} disabled={!selectedUser || !selectedRole}>
                Assign Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <div className="text-sm text-muted-foreground">Total Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats.creators}</div>
                <div className="text-sm text-muted-foreground">Creators</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{stats.moderators}</div>
                <div className="text-sm text-muted-foreground">Moderators</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{stats.admins}</div>
                <div className="text-sm text-muted-foreground">Admins</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-filter">Role</Label>
              <Select
                value={filters.role || ''}
                onValueChange={(value) => 
                  setFilters(prev => ({ 
                    ...prev, 
                    role: value as AppRole || undefined 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Roles ({roles.length})</CardTitle>
          <CardDescription>
            Manage user roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{role.user_name}</div>
                        <div className="text-sm text-muted-foreground">{role.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {role.roles.map((r) => (
                          <div key={r}>
                            {getRoleBadge(r)}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {role.last_sign_in 
                        ? new Date(role.last_sign_in).toLocaleDateString()
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(role.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {role.roles.map((r) => (
                          <Button
                            key={r}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRole(role.user_id, r)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
