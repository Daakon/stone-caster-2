// Phase 27: Autonomous Playtesting Bots and Fuzz Harness
// Admin Test Lab UI for running autoplay matrices and viewing results

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  Square, 
  Download, 
  Eye, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  BarChart3,
  Settings,
  FileText,
  Image,
  Archive
} from 'lucide-react';

interface RunConfig {
  worlds: string[];
  adventures: string[];
  locales: string[];
  experiments: string[];
  variations: string[];
  seeds_per_scenario: number;
  max_turns: number;
  timeout_ms: number;
  parallel_shards: number;
  bot_modes: string[];
}

interface RunResult {
  run_id: string;
  scenario: any;
  mode: string;
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  turns_completed: number;
  coverage: any;
  oracles: any;
  performance: any;
  pass: boolean;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  artifacts: Array<{
    kind: string;
    path: string;
    bytes: number;
  }>;
}

interface BaselineComparison {
  baseline_key: string;
  verdict: 'pass' | 'fail' | 'warning';
  tolerance_exceeded: string[];
  significant_changes: string[];
  summary: string;
  deltas: any;
}

export default function TestLab() {
  const [runConfig, setRunConfig] = useState<RunConfig>({
    worlds: ['world.forest_glade'],
    adventures: ['adventure.tutorial'],
    locales: ['en_US'],
    experiments: ['control'],
    variations: ['control'],
    seeds_per_scenario: 2,
    max_turns: 80,
    timeout_ms: 900000,
    parallel_shards: 6,
    bot_modes: ['objective_seeker', 'explorer', 'economy_grinder']
  });

  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<RunResult[]>([]);
  const [baselineComparisons, setBaselineComparisons] = useState<BaselineComparison[]>([]);
  const [selectedResult, setSelectedResult] = useState<RunResult | null>(null);
  const [progress, setProgress] = useState(0);

  // Load existing results on mount
  useEffect(() => {
    loadRunResults();
  }, []);

  const loadRunResults = async () => {
    try {
      const response = await fetch('/api/admin/autoplay/runs');
      if (response.ok) {
        const results = await response.json();
        setRunResults(results.data || []);
      }
    } catch (error) {
    }
  };

  const startMatrixRun = async () => {
    setIsRunning(true);
    setCurrentRun('matrix-run-' + Date.now());
    setProgress(0);

    try {
      const response = await fetch('/api/admin/autoplay/run-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runConfig)
      });

      if (response.ok) {
        const result = await response.json();
        // Simulate progress updates
        const interval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setIsRunning(false);
              setCurrentRun(null);
              loadRunResults();
              return 100;
            }
            return prev + Math.random() * 10;
          });
        }, 1000);
      } else {
        throw new Error('Failed to start matrix run');
      }
    } catch (error) {
      setIsRunning(false);
      setCurrentRun(null);
    }
  };

  const stopCurrentRun = async () => {
    if (currentRun) {
      try {
        await fetch(`/api/admin/autoplay/runs/${currentRun}/stop`, {
          method: 'POST'
        });
        setIsRunning(false);
        setCurrentRun(null);
        setProgress(0);
      } catch (error) {
      }
    }
  };

  const downloadArtifact = async (runId: string, artifactPath: string) => {
    try {
      const response = await fetch(`/api/admin/autoplay/artifacts/${runId}/${artifactPath}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = artifactPath.split('/').pop() || 'artifact';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
    }
  };

  const compareWithBaseline = async (runId: string) => {
    try {
      const response = await fetch(`/api/admin/autoplay/runs/${runId}/compare-baseline`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const comparison = await response.json();
        setBaselineComparisons(prev => [...prev, comparison.data]);
      }
    } catch (error) {
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'timeout':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'pass':
        return <Badge variant="default" className="bg-green-500">PASS</Badge>;
      case 'fail':
        return <Badge variant="destructive">FAIL</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500">WARNING</Badge>;
      default:
        return <Badge variant="outline">UNKNOWN</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Test Lab</h1>
          <p className="text-muted-foreground">
            Autonomous playtesting bots and fuzz harness for content validation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={startMatrixRun}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Running...' : 'Start Matrix Run'}
          </Button>
          {isRunning && (
            <Button
              onClick={stopCurrentRun}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Stop Run
            </Button>
          )}
        </div>
      </div>

      {isRunning && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Matrix run in progress... {Math.round(progress)}% complete
            <Progress value={progress} className="mt-2" />
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="baselines">Baselines</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Run Configuration</CardTitle>
              <CardDescription>
                Configure the autoplay matrix run parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="worlds">Worlds</Label>
                  <Input
                    id="worlds"
                    value={runConfig.worlds.join(', ')}
                    onChange={(e) => setRunConfig(prev => ({
                      ...prev,
                      worlds: e.target.value.split(',').map(w => w.trim())
                    }))}
                    placeholder="world.forest_glade, world.desert_oasis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adventures">Adventures</Label>
                  <Input
                    id="adventures"
                    value={runConfig.adventures.join(', ')}
                    onChange={(e) => setRunConfig(prev => ({
                      ...prev,
                      adventures: e.target.value.split(',').map(a => a.trim())
                    }))}
                    placeholder="adventure.tutorial, adventure.main_quest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locales">Locales</Label>
                  <Input
                    id="locales"
                    value={runConfig.locales.join(', ')}
                    onChange={(e) => setRunConfig(prev => ({
                      ...prev,
                      locales: e.target.value.split(',').map(l => l.trim())
                    }))}
                    placeholder="en_US, es_ES, fr_FR"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seeds">Seeds per Scenario</Label>
                  <Input
                    id="seeds"
                    type="number"
                    value={runConfig.seeds_per_scenario}
                    onChange={(e) => setRunConfig(prev => ({
                      ...prev,
                      seeds_per_scenario: parseInt(e.target.value) || 2
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTurns">Max Turns</Label>
                  <Input
                    id="maxTurns"
                    type="number"
                    value={runConfig.max_turns}
                    onChange={(e) => setRunConfig(prev => ({
                      ...prev,
                      max_turns: parseInt(e.target.value) || 80
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={runConfig.timeout_ms}
                    onChange={(e) => setRunConfig(prev => ({
                      ...prev,
                      timeout_ms: parseInt(e.target.value) || 900000
                    }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bot Modes</Label>
                <div className="flex flex-wrap gap-2">
                  {['objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max'].map(mode => (
                    <Button
                      key={mode}
                      variant={runConfig.bot_modes.includes(mode) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRunConfig(prev => ({
                        ...prev,
                        bot_modes: prev.bot_modes.includes(mode)
                          ? prev.bot_modes.filter(m => m !== mode)
                          : [...prev.bot_modes, mode]
                      }))}
                    >
                      {mode.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <div className="grid gap-4">
            {runResults.map((result) => (
              <Card key={result.run_id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <h3 className="font-semibold">
                          {result.scenario?.world}/{result.scenario?.adventure} - {result.mode}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {result.turns_completed} turns • {Math.round(result.duration_ms / 1000)}s
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.pass ? (
                        <Badge variant="default" className="bg-green-500">PASS</Badge>
                      ) : (
                        <Badge variant="destructive">FAIL</Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedResult(result)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => compareWithBaseline(result.run_id)}
                      >
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {result.coverage && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>Quest Graph: {(result.coverage.quest_graph * 100).toFixed(1)}%</div>
                      <div>Dialogue: {(result.coverage.dialogue * 100).toFixed(1)}%</div>
                      <div>Economy: {(result.coverage.economy * 100).toFixed(1)}%</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="baselines" className="space-y-4">
          <div className="grid gap-4">
            {baselineComparisons.map((comparison, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{comparison.baseline_key}</h3>
                    {getVerdictBadge(comparison.verdict)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    {comparison.summary}
                  </p>
                  
                  {comparison.tolerance_exceeded.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium mb-1">Tolerance Exceeded:</h4>
                      <div className="flex flex-wrap gap-1">
                        {comparison.tolerance_exceeded.map((item, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {comparison.significant_changes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Significant Changes:</h4>
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {comparison.significant_changes.map((change, i) => (
                          <li key={i}>{change}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="artifacts" className="space-y-4">
          {selectedResult && (
            <Card>
              <CardHeader>
                <CardTitle>Artifacts for {selectedResult.run_id}</CardTitle>
                <CardDescription>
                  Download generated artifacts from this run
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {selectedResult.artifacts.map((artifact, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {artifact.kind === 'json' && <FileText className="h-4 w-4" />}
                        {artifact.kind === 'html' && <FileText className="h-4 w-4" />}
                        {artifact.kind === 'png' && <Image className="h-4 w-4" />}
                        {artifact.kind === 'svg' && <Image className="h-4 w-4" />}
                        {artifact.kind === 'zip' && <Archive className="h-4 w-4" />}
                        <div>
                          <p className="font-medium">{artifact.path.split('/').pop()}</p>
                          <p className="text-sm text-muted-foreground">
                            {artifact.kind.toUpperCase()} • {(artifact.bytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadArtifact(selectedResult.run_id, artifact.path)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
