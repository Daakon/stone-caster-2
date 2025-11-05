/**
 * Ruleset Detail Page
 * View and edit a specific ruleset
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { rulesetsService, type Ruleset } from '@/services/admin.rulesets';
import { RulesetForm } from '@/admin/components/RulesetForm';

export default function RulesetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (id) {
      loadRuleset(id);
    }
  }, [id]);

  const loadRuleset = async (rulesetId: string) => {
    try {
      setLoading(true);
      const data = await rulesetsService.getRuleset(rulesetId);
      setRuleset(data);
    } catch (error) {
      console.error('Failed to load ruleset:', error);
      toast.error('Failed to load ruleset');
      navigate('/admin/rulesets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: any) => {
    if (!ruleset) return;
    
    try {
      const updated = await rulesetsService.updateRuleset(ruleset.id, data);
      setRuleset(updated);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update ruleset:', error);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!ruleset) return;
    
    if (!confirm('Are you sure you want to delete this ruleset?')) return;
    
    try {
      await rulesetsService.deleteRuleset(ruleset.id);
      toast.success('Ruleset deleted successfully');
      navigate('/admin/rulesets');
    } catch (error) {
      console.error('Failed to delete ruleset:', error);
      toast.error('Failed to delete ruleset');
    }
  };

  const handleToggleActive = async () => {
    if (!ruleset) return;
    
    try {
      const updated = await rulesetsService.toggleActive(ruleset.id);
      setRuleset(updated);
      toast.success('Ruleset status updated');
    } catch (error) {
      console.error('Failed to toggle ruleset status:', error);
      toast.error('Failed to update ruleset status');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/rulesets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rulesets
          </Button>
        </div>
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  if (!ruleset) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/rulesets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rulesets
          </Button>
        </div>
        <div className="text-center py-8 text-gray-500">
          <p>Ruleset not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/rulesets')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Rulesets
        </Button>
      </div>

      {isEditing ? (
        <RulesetForm
          ruleset={ruleset}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">{ruleset.name}</h1>
              <p className="text-gray-600">{ruleset.slug}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={ruleset.active ? 'default' : 'secondary'}>
                  {ruleset.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleToggleActive}
              >
                {ruleset.active ? (
                  <EyeOff className="h-4 w-4 mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                {ruleset.active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">Description</h4>
                <p className="text-gray-600 mt-1">
                  {ruleset.description || 'No description provided'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Created</h4>
                  <p className="text-gray-600">
                    {new Date(ruleset.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Updated</h4>
                  <p className="text-gray-600">
                    {new Date(ruleset.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}















