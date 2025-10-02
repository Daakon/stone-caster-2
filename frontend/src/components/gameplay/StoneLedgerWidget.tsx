import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Gem, Plus, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface StoneTransaction {
  id: string;
  type: 'earned' | 'spent' | 'regen';
  amount: number;
  reason: string;
  timestamp: string;
}

interface StoneLedgerWidgetProps {
  balance: number;
  regenRate: number;
  nextRegen?: string;
  recentTransactions: StoneTransaction[];
  onBuyStones?: () => void;
  className?: string;
}

export const StoneLedgerWidget: React.FC<StoneLedgerWidgetProps> = ({
  balance,
  regenRate,
  nextRegen,
  recentTransactions,
  onBuyStones,
  className
}) => {
  const getTransactionIcon = (type: StoneTransaction['type']) => {
    switch (type) {
      case 'earned':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'spent':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'regen':
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTransactionColor = (type: StoneTransaction['type']) => {
    switch (type) {
      case 'earned':
        return 'text-green-600';
      case 'spent':
        return 'text-red-600';
      case 'regen':
        return 'text-blue-600';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gem className="h-5 w-5 text-primary" />
            Casting Stones
          </CardTitle>
          {onBuyStones && (
            <Button size="sm" variant="outline" onClick={onBuyStones}>
              <Plus className="h-4 w-4 mr-1" />
              Buy
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Balance */}
        <div className="text-center">
          <div className="text-3xl font-bold text-primary mb-1">
            {balance}
          </div>
          <p className="text-sm text-muted-foreground">Available Stones</p>
        </div>

        {/* Regen Info */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Regen Rate</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">+{regenRate}/hour</div>
            {nextRegen && (
              <div className="text-xs text-muted-foreground">
                Next: {nextRegen}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Activity</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No recent activity
              </p>
            ) : (
              recentTransactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded"
                >
                  <div className="flex items-center gap-2">
                    {getTransactionIcon(transaction.type)}
                    <div>
                      <p className="text-sm font-medium">{transaction.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(transaction.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${getTransactionColor(transaction.type)}`}>
                    {transaction.type === 'spent' ? '-' : '+'}{transaction.amount}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
