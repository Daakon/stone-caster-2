import React from 'react';
import { Alert, AlertDescription } from './alert';
import { Button } from './button';
import { Badge } from './badge';
import { AlertTriangle, Crown, ArrowRight } from 'lucide-react';

interface LimitBannerProps {
  type: 'games' | 'characters';
  current: number;
  limit: number;
  tier: 'guest' | 'free' | 'premium';
  onUpgrade?: () => void;
  className?: string;
}

const limitMessages = {
  games: {
    title: 'Adventure Limit Reached',
    description: 'You\'ve reached your maximum number of active adventures.',
    action: 'Upgrade to create more adventures'
  },
  characters: {
    title: 'Character Limit Reached',
    description: 'You\'ve reached your maximum number of characters.',
    action: 'Upgrade to create more characters'
  }
};

const tierInfo = {
  guest: { name: 'Guest', color: 'bg-gray-100 text-gray-800' },
  free: { name: 'Free', color: 'bg-blue-100 text-blue-800' },
  premium: { name: 'Premium', color: 'bg-purple-100 text-purple-800' }
};

export const LimitBanner: React.FC<LimitBannerProps> = ({
  type,
  current,
  limit,
  tier,
  onUpgrade,
  className
}) => {
  const message = limitMessages[type];
  const tierData = tierInfo[tier];
  const isAtLimit = current >= limit;
  const isUpgradeable = tier === 'guest' || tier === 'free';

  if (!isAtLimit) return null;

  return (
    <Alert className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{message.title}</span>
            <Badge className={tierData.color}>
              {tierData.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {message.description} ({current}/{limit})
          </p>
        </div>
        
        {isUpgradeable && onUpgrade && (
          <Button
            size="sm"
            onClick={onUpgrade}
            className="ml-4"
          >
            <Crown className="h-4 w-4 mr-1" />
            {tier === 'guest' ? 'Sign Up' : 'Upgrade'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

