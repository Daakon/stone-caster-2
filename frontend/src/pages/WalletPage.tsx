import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { StoneLedgerWidget } from '../components/gameplay/StoneLedgerWidget';
import { TierGate } from '../components/ui/tier-gate';
import { GatedRoute } from '../components/auth/GatedRoute';
import { mockDataService } from '../services/mockData';
import { 
  Gem, 
  Crown,
  CreditCard,
  Gift
} from 'lucide-react';

function WalletPageContent() {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const wallet = mockDataService.getWallet();
  const currentTier = mockDataService.getCurrentTier();
  const limits = mockDataService.getLimitsByTier(currentTier);
  
  const handleBuyStones = () => {
    // Navigate to payments or show purchase modal
    console.log('Buy stones clicked');
  };

  const handleUpgrade = () => {
    setShowUpgrade(true);
  };

  const tierBenefits = {
    free: [
      'Up to 3 characters',
      'Up to 2 active adventures',
      'Basic stone regeneration',
      'Community support'
    ],
    premium: [
      'Unlimited characters',
      'Unlimited adventures',
      'Faster stone regeneration',
      'Priority support',
      'Exclusive content',
      'Advanced world features'
    ]
  };

  const recentTransactions = [
    {
      id: '1',
      type: 'regen' as const,
      amount: 5,
      reason: 'Hourly regeneration',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      type: 'spent' as const,
      amount: 3,
      reason: 'Cast spell in adventure',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      type: 'earned' as const,
      amount: 10,
      reason: 'Welcome bonus',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Wallet</h1>
          <p className="text-muted-foreground">
            Manage your Casting Stones and account tier
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stone Balance */}
            <StoneLedgerWidget
              balance={wallet.balance}
              regenRate={wallet.regenRate}
              nextRegen={wallet.nextRegen}
              recentTransactions={recentTransactions}
              onBuyStones={handleBuyStones}
            />

            {/* Purchase Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Purchase Stones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { amount: 50, price: '$4.99', bonus: 0 },
                    { amount: 120, price: '$9.99', bonus: 20 },
                    { amount: 300, price: '$19.99', bonus: 100 }
                  ].map((pack, index) => (
                    <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center mb-2">
                          <Gem className="h-6 w-6 text-primary mr-2" />
                          <span className="text-2xl font-bold">{pack.amount}</span>
                        </div>
                        <div className="text-lg font-semibold mb-1">{pack.price}</div>
                        {pack.bonus > 0 && (
                          <Badge variant="secondary" className="mb-2">
                            +{pack.bonus} bonus
                          </Badge>
                        )}
                        <Button size="sm" className="w-full">
                          Buy Now
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Account Tier */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Account Tier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={currentTier === 'premium' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                        {currentTier === 'premium' ? 'Premium' : 'Free'}
                      </Badge>
                      {currentTier === 'premium' && (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {currentTier === 'premium' ? 'Premium benefits active' : 'Free tier limitations apply'}
                    </p>
                  </div>
                  {currentTier !== 'premium' && (
                    <Button onClick={handleUpgrade}>
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade
                    </Button>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <h4 className="font-medium">Current Benefits:</h4>
                  <ul className="space-y-2">
                    {tierBenefits[currentTier as keyof typeof tierBenefits].map((benefit, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-1 h-1 bg-primary rounded-full" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Characters</span>
                  <span className="font-medium">0/{limits.maxCharacters}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Adventures</span>
                  <span className="font-medium">0/{limits.maxGames}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Regen Rate</span>
                  <span className="font-medium">+{wallet.regenRate}/hour</span>
                </div>
              </CardContent>
            </Card>

            {/* Special Offers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Special Offers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-1">First Purchase Bonus</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Get 50% extra stones on your first purchase
                    </p>
                    <Button size="sm" variant="outline" className="w-full">
                      Claim Offer
                    </Button>
                  </div>
                  
                  {currentTier !== 'premium' && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <h4 className="font-medium mb-1">Premium Trial</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        7 days free, then $9.99/month
                      </p>
                      <Button size="sm" className="w-full">
                        Start Trial
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Upgrade Modal */}
        {showUpgrade && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-background rounded-lg max-w-md w-full p-6">
              <TierGate
                currentTier={currentTier}
                requiredTier="premium"
                feature="Premium Features"
                description="Unlock unlimited characters, adventures, and exclusive content"
                onUpgrade={() => {
                  setShowUpgrade(false);
                  // Handle upgrade logic
                }}
              />
              <Button
                variant="outline"
                onClick={() => setShowUpgrade(false)}
                className="w-full mt-4"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <GatedRoute requireAuth={true}>
      <WalletPageContent />
    </GatedRoute>
  );
}
