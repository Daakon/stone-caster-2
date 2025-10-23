import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, AlertTriangle, CheckCircle } from 'lucide-react';

interface TokenMeterProps {
  current: number;
  max: number;
  showDetails?: boolean;
  className?: string;
}

export function TokenMeter({ 
  current, 
  max, 
  showDetails = false, 
  className = '' 
}: TokenMeterProps) {
  const percentage = Math.min((current / max) * 100, 100);
  const remaining = Math.max(max - current, 0);
  
  let status: 'safe' | 'warning' | 'critical';
  let statusColor: string;
  let statusIcon: React.ReactNode;
  
  if (percentage < 70) {
    status = 'safe';
    statusColor = 'text-green-600';
    statusIcon = <CheckCircle className="h-4 w-4" />;
  } else if (percentage < 90) {
    status = 'warning';
    statusColor = 'text-yellow-600';
    statusIcon = <AlertTriangle className="h-4 w-4" />;
  } else {
    status = 'critical';
    statusColor = 'text-red-600';
    statusIcon = <AlertTriangle className="h-4 w-4" />;
  }
  
  const getProgressColor = () => {
    switch (status) {
      case 'safe': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  if (showDetails) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            Token Usage
          </CardTitle>
          <CardDescription>
            Monitor your prompt's token consumption
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Usage</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {current.toLocaleString()} / {max.toLocaleString()}
                </span>
                <Badge variant={status === 'critical' ? 'destructive' : 'default'}>
                  {percentage.toFixed(1)}%
                </Badge>
              </div>
            </div>
            <Progress 
              value={percentage} 
              className="h-2"
              style={{
                '--progress-background': getProgressColor(),
              } as React.CSSProperties}
            />
          </div>
          
          {/* Status */}
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className={`text-sm font-medium ${statusColor}`}>
              {status === 'safe' && 'Within budget'}
              {status === 'warning' && 'Approaching limit'}
              {status === 'critical' && 'Over budget'}
            </span>
          </div>
          
          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Remaining:</span>
              <span className="ml-2 font-medium">
                {remaining.toLocaleString()} tokens
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <span className={`ml-2 font-medium ${statusColor}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          </div>
          
          {/* Recommendations */}
          {status === 'warning' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> You're approaching the token limit. Consider reducing content or increasing the limit.
              </p>
            </div>
          )}
          
          {status === 'critical' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                <strong>Critical:</strong> You've exceeded the token limit. The prompt will be truncated or rejected.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Simple version
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Tokens</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {current.toLocaleString()} / {max.toLocaleString()}
          </span>
          <Badge variant={status === 'critical' ? 'destructive' : 'default'}>
            {percentage.toFixed(1)}%
          </Badge>
        </div>
      </div>
      <Progress 
        value={percentage} 
        className="h-2"
        style={{
          '--progress-background': getProgressColor(),
        } as React.CSSProperties}
      />
      <div className="flex items-center gap-2">
        {statusIcon}
        <span className={`text-xs ${statusColor}`}>
          {status === 'safe' && 'Within budget'}
          {status === 'warning' && 'Approaching limit'}
          {status === 'critical' && 'Over budget'}
        </span>
      </div>
    </div>
  );
}
