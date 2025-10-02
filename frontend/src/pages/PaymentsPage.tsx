import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { mockDataService } from '../services/mockData';
import { 
  Crown, 
  Check, 
  Gem, 
  ArrowRight
} from 'lucide-react';

export default function PaymentsPage() {
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'premium'>('free');
  const currentTier = mockDataService.getCurrentTier();
  
  const plans = {
    free: {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out Stone Caster',
      features: [
        'Up to 3 characters',
        'Up to 2 active adventures',
        'Basic stone regeneration (5/hour)',
        'Community support',
        'Access to all worlds'
      ],
      limitations: [
        'Limited character slots',
        'Limited adventure slots',
        'Standard regeneration rate'
      ]
    },
    premium: {
      name: 'Premium',
      price: '$9.99',
      period: 'per month',
      description: 'Unlock the full Stone Caster experience',
      features: [
        'Unlimited characters',
        'Unlimited adventures',
        'Faster stone regeneration (10/hour)',
        'Priority support',
        'Exclusive content and worlds',
        'Advanced world features',
        'Early access to new content'
      ],
      limitations: []
    }
  };

  const stonePacks = [
    { amount: 50, price: '$4.99', bonus: 0, popular: false },
    { amount: 120, price: '$9.99', bonus: 20, popular: true },
    { amount: 300, price: '$19.99', bonus: 100, popular: false },
    { amount: 750, price: '$39.99', bonus: 250, popular: false }
  ];

  const handleUpgrade = () => {
    // Handle subscription upgrade
    console.log('Upgrade to premium');
  };

  const handleBuyStones = (pack: typeof stonePacks[0]) => {
    // Handle stone purchase
    console.log('Buy stone pack:', pack);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Unlock the full potential of Stone Caster with our flexible pricing options
          </p>
        </div>

        {/* Current Status */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-semibold">Current Plan: {plans[currentTier as keyof typeof plans].name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {currentTier === 'premium' ? 'Premium benefits active' : 'Free tier limitations apply'}
                  </p>
                </div>
              </div>
              {currentTier !== 'premium' && (
                <Button onClick={handleUpgrade}>
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Premium
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Subscription Plans */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Subscription Plans</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(plans).map(([key, plan]) => {
                const isSelected = selectedPlan === key;
                const isCurrent = currentTier === key;
                const isPremium = key === 'premium';
                
                return (
                  <Card 
                    key={key} 
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
                    } ${isCurrent ? 'bg-primary/5' : ''}`}
                    onClick={() => setSelectedPlan(key as 'free' | 'premium')}
                  >
                    <CardHeader className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Crown className={`h-6 w-6 ${isPremium ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <div className="text-3xl font-bold text-primary">{plan.price}</div>
                      <div className="text-sm text-muted-foreground">{plan.period}</div>
                      <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                      
                      {plan.limitations.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">Limitations:</h4>
                          {plan.limitations.map((limitation, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                                <div className="h-1 w-1 bg-muted-foreground rounded-full" />
                              </div>
                              <span className="text-sm text-muted-foreground">{limitation}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <Separator />
                      
                      <div className="text-center">
                        {isCurrent ? (
                          <Badge variant="secondary" className="w-full justify-center">
                            Current Plan
                          </Badge>
                        ) : (
                          <Button 
                            className="w-full" 
                            variant={isPremium ? 'default' : 'outline'}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isPremium) handleUpgrade();
                            }}
                          >
                            {isPremium ? 'Upgrade to Premium' : 'Downgrade to Free'}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Stone Packs */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Casting Stone Packs</h2>
            <p className="text-muted-foreground">
              Need more stones for your adventures? Purchase additional Casting Stones to continue your journey.
            </p>
            
            <div className="grid grid-cols-1 gap-4">
              {stonePacks.map((pack, index) => (
                <Card key={index} className={`cursor-pointer hover:shadow-md transition-shadow ${
                  pack.popular ? 'ring-2 ring-primary' : ''
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Gem className="h-5 w-5 text-primary" />
                          <span className="text-xl font-bold">{pack.amount}</span>
                        </div>
                        <div>
                          <div className="font-semibold">{pack.price}</div>
                          {pack.bonus > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              +{pack.bonus} bonus
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {pack.popular && (
                          <Badge className="mb-2">Most Popular</Badge>
                        )}
                        <Button 
                          size="sm"
                          onClick={() => handleBuyStones(pack)}
                        >
                          Buy Now
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Features Comparison */}
        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="text-center">Feature Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">Features</th>
                    <th className="text-center p-4">Free</th>
                    <th className="text-center p-4">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Characters', free: '3', premium: 'Unlimited' },
                    { feature: 'Active Adventures', free: '2', premium: 'Unlimited' },
                    { feature: 'Stone Regeneration', free: '5/hour', premium: '10/hour' },
                    { feature: 'Support', free: 'Community', premium: 'Priority' },
                    { feature: 'Exclusive Content', free: 'No', premium: 'Yes' },
                    { feature: 'Advanced Features', free: 'No', premium: 'Yes' }
                  ].map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-4 font-medium">{row.feature}</td>
                      <td className="p-4 text-center">{row.free}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Check className="h-4 w-4 text-green-500" />
                          {row.premium}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
