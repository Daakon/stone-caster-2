import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Crown, Lock, ArrowRight } from 'lucide-react';

interface TierGateProps {
  currentTier: 'guest' | 'free' | 'premium';
  requiredTier: 'free' | 'premium';
  feature: string;
  description: string;
  onUpgrade: () => void;
  className?: string;
}

const tierInfo = {
  guest: {
    name: 'Guest',
    color: 'bg-gray-100 text-gray-800',
    icon: Lock
  },
  free: {
    name: 'Free',
    color: 'bg-blue-100 text-blue-800',
    icon: Crown
  },
  premium: {
    name: 'Premium',
    color: 'bg-purple-100 text-purple-800',
    icon: Crown
  }
};

const tierBenefits = {
  free: [
    'Create up to 3 characters',
    'Start up to 2 adventures',
    'Basic world exploration'
  ],
  premium: [
    'Unlimited characters',
    'Unlimited adventures',
    'Advanced world features',
    'Priority support',
    'Exclusive content'
  ]
};

export const TierGate: React.FC<TierGateProps> = ({
  currentTier,
  requiredTier,
  feature,
  description,
  onUpgrade,
  className
}) => {
  const currentTierInfo = tierInfo[currentTier];
  const requiredTierInfo = tierInfo[requiredTier];
  const CurrentIcon = currentTierInfo.icon;
  const RequiredIcon = requiredTierInfo.icon;

  const isUpgradeable = currentTier === 'guest' || 
    (currentTier === 'free' && requiredTier === 'premium');

  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg">{feature}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current vs Required Tier */}
        <div className="flex items-center justify-center space-x-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <CurrentIcon className="h-4 w-4 mr-1" />
              <Badge className={currentTierInfo.color}>
                {currentTierInfo.name}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Current</p>
          </div>
          
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <RequiredIcon className="h-4 w-4 mr-1" />
              <Badge className={requiredTierInfo.color}>
                {requiredTierInfo.name}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Required</p>
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-center">
            {requiredTier === 'free' ? 'Free Tier Benefits:' : 'Premium Tier Benefits:'}
          </h4>
          <ul className="space-y-1">
            {tierBenefits[requiredTier].map((benefit, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-center">
                <div className="w-1 h-1 bg-primary rounded-full mr-2" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Upgrade Button */}
        {isUpgradeable && (
          <Button onClick={onUpgrade} className="w-full">
            {currentTier === 'guest' ? 'Sign Up for Free' : 'Upgrade to Premium'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}

        {!isUpgradeable && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              You already have access to this feature!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
