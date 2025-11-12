/**
 * Template & Prompt Health Dashboard
 * Admin page for monitoring template health, missing slots, high-trim stories, etc.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, Info, ExternalLink, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { isAdminPromptFormsEnabled } from '@/lib/feature-flags';

interface HealthData {
  missingSlots: Array<{ type: string; slot: string }>;
  templateChurn: Array<{ type: string; slot: string; publishCount: number }>;
  orphanedTemplates: Array<{ type: string; slot: string; version: number }>;
  highTrimStories: Array<{ storyId: string; total: number; trims: number; trimRate: number }>;
  oversizedSections: Array<{ slot: string; trimCount: number; avgTokensRemoved: number }>;
  timeRange: { from: string; to: string };
}

export default function Health() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [worldId, setWorldId] = useState('');
  const [rulesetId, setRulesetId] = useState('');
  const [storyId, setStoryId] = useState('');

  const { data: healthData, isLoading } = useQuery<HealthData>({
    queryKey: ['health', fromDate, toDate, worldId, rulesetId, storyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('fromDate', fromDate);
      params.set('toDate', toDate);
      if (worldId) params.set('worldId', worldId);
      if (rulesetId) params.set('rulesetId', rulesetId);
      if (storyId) params.set('storyId', storyId);

      const res = await api.get(`/api/admin/templates/health?${params.toString()}`);
      if (!res.ok) throw new Error(res.error?.message || 'Failed to fetch health data');
      return res.data;
    },
    enabled: isAdminPromptFormsEnabled(),
  });

  if (!isAdminPromptFormsEnabled()) {
    return (
      <div className="p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Health Dashboard is disabled. Enable VITE_ADMIN_PROMPT_FORMS_ENABLED to use this feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Template & Prompt Health</h1>
        <p className="text-muted-foreground">
          Monitor template health, missing slots, high-trim stories, and template churn
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="worldId">World ID (optional)</Label>
              <Input
                id="worldId"
                placeholder="Filter by world"
                value={worldId}
                onChange={(e) => setWorldId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rulesetId">Ruleset ID (optional)</Label>
              <Input
                id="rulesetId"
                placeholder="Filter by ruleset"
                value={rulesetId}
                onChange={(e) => setRulesetId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="storyId">Story ID (optional)</Label>
              <Input
                id="storyId"
                placeholder="Filter by story"
                value={storyId}
                onChange={(e) => setStoryId(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">Loading health data...</div>
      ) : healthData ? (
        <>
          {/* Missing Slots */}
          <Card>
            <CardHeader>
              <CardTitle>Missing/Unpublished Slots</CardTitle>
              <CardDescription>
                Slots that lack an active published template
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthData.missingSlots.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>All slots have published templates.</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthData.missingSlots.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="outline">{item.type}</Badge>
                        </TableCell>
                        <TableCell>{item.slot}</TableCell>
                        <TableCell>
                          <Button variant="link" size="sm" asChild>
                            <Link to={`/admin/templates?type=${item.type}&slot=${item.slot}`}>
                              View in Template Manager <ExternalLink className="h-3 w-3 ml-1 inline" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Template Churn */}
          <Card>
            <CardHeader>
              <CardTitle>Template Churn</CardTitle>
              <CardDescription>
                Slots with rapid publish cycles (3+ publishes in time range)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthData.templateChurn.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>No high-churn templates found.</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Publish Count</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthData.templateChurn.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="outline">{item.type}</Badge>
                        </TableCell>
                        <TableCell>{item.slot}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{item.publishCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="link" size="sm" asChild>
                            <Link to={`/admin/templates?type=${item.type}&slot=${item.slot}`}>
                              View History <ExternalLink className="h-3 w-3 ml-1 inline" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Orphaned Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Orphaned Templates</CardTitle>
              <CardDescription>
                Published templates for slots that no longer exist
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthData.orphanedTemplates.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>No orphaned templates found.</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthData.orphanedTemplates.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="outline">{item.type}</Badge>
                        </TableCell>
                        <TableCell>{item.slot}</TableCell>
                        <TableCell>v{item.version}</TableCell>
                        <TableCell>
                          <Button variant="link" size="sm" asChild>
                            <Link to={`/admin/templates?type=${item.type}&slot=${item.slot}`}>
                              View Template <ExternalLink className="h-3 w-3 ml-1 inline" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* High-Trim Stories */}
          <Card>
            <CardHeader>
              <CardTitle>High-Trim Stories</CardTitle>
              <CardDescription>
                Stories with 30%+ trim rate in previews/turns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthData.highTrimStories.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>No high-trim stories found.</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Story ID</TableHead>
                      <TableHead>Total Previews</TableHead>
                      <TableHead>Trims</TableHead>
                      <TableHead>Trim Rate</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthData.highTrimStories.map((item) => (
                      <TableRow key={item.storyId}>
                        <TableCell className="font-mono text-sm">{item.storyId.substring(0, 8)}...</TableCell>
                        <TableCell>{item.total}</TableCell>
                        <TableCell>{item.trims}</TableCell>
                        <TableCell>
                          <Badge variant={item.trimRate >= 50 ? 'destructive' : 'secondary'}>
                            {item.trimRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <HelpCircle className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80">
                                <p className="text-sm">
                                  Trimmed in {item.trims} of {item.total} previews ({item.trimRate.toFixed(1)}%).
                                  Consider reducing slot content or increasing budget.
                                </p>
                              </PopoverContent>
                            </Popover>
                            <Button variant="link" size="sm" asChild>
                              <Link to={`/admin/prompt-snapshots?gameId=${item.storyId}`}>
                                View Snapshots <ExternalLink className="h-3 w-3 ml-1 inline" />
                              </Link>
                            </Button>
                            <Button variant="link" size="sm" asChild>
                              <Link to={`/admin/prompt-builder?storyId=${item.storyId}`}>
                                Preview Impact <ExternalLink className="h-3 w-3 ml-1 inline" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Oversized Sections */}
          <Card>
            <CardHeader>
              <CardTitle>Oversized Sections</CardTitle>
              <CardDescription>
                Slots that are frequently trimmed (5+ times in time range)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthData.oversizedSections.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>No oversized sections found.</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slot</TableHead>
                      <TableHead>Trim Count</TableHead>
                      <TableHead>Avg Tokens Removed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthData.oversizedSections.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{item.slot}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.trimCount}</Badge>
                        </TableCell>
                        <TableCell>{item.avgTokensRemoved.toFixed(0)}</TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <HelpCircle className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <p className="text-sm">
                                This slot was trimmed {item.trimCount} times, removing an average of{' '}
                                {item.avgTokensRemoved.toFixed(0)} tokens per trim. Consider shortening the template
                                body or reducing redundancy.
                              </p>
                            </PopoverContent>
                          </Popover>
                          <Button variant="link" size="sm" asChild className="ml-2">
                            <Link to={`/admin/prompt-builder`}>
                              Preview Impact <ExternalLink className="h-3 w-3 ml-1 inline" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

