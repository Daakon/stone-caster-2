import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Badge } from '../ui/badge';
import { 
  Menu, 
  Home, 
  Gamepad2, 
  User, 
  Wallet, 
  Settings,
  Gem,
  X
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useQuery } from '@tanstack/react-query';
import { getWallet } from '../../lib/api';

interface MobileDrawerNavProps {
  children: React.ReactNode;
}

export function MobileDrawerNav({ children }: MobileDrawerNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuthStore();

  // Load wallet data for stone balance display
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const result = await getWallet();
      if (!result.ok) {
        return null;
      }
      return result.data;
    },
    staleTime: 10 * 1000, // 10 seconds cache
  });

  const navigation = [
    { 
      name: 'Home', 
      href: '/', 
      icon: Home,
      show: true
    },
    { 
      name: 'Worlds', 
      href: '/worlds', 
      icon: Gamepad2,
      show: true
    },
    { 
      name: 'Stories', 
      href: '/adventures', 
      icon: Gamepad2,
      show: true
    },
    { 
      name: 'Wallet', 
      href: '/wallet', 
      icon: Wallet,
      show: true
    },
    { 
      name: 'Profile', 
      href: '/profile', 
      icon: User,
      show: !!user
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-bold">StoneCaster</span>
          </Link>

          {/* Right side - Stone balance and menu */}
          <div className="flex items-center gap-3">
            {/* Stone balance */}
            {wallet && (
              <div className="flex items-center gap-1 text-sm">
                <Gem className="h-4 w-4" />
                <span className="font-medium">{wallet.balance || 0}</span>
              </div>
            )}

            {/* Mobile menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Toggle menu"
                  className="h-9 w-9"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <Link 
                      to="/" 
                      className="flex items-center space-x-2 font-bold text-lg"
                      onClick={() => setIsOpen(false)}
                    >
                      StoneCaster
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsOpen(false)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Navigation */}
                  <nav className="flex-1 space-y-2">
                    {navigation.filter(item => item.show).map((item) => {
                      const Icon = item.icon;
                      const isActive = isActiveRoute(item.href);
                      
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-accent text-accent-foreground'
                              : 'text-foreground/60 hover:text-foreground hover:bg-accent'
                          }`}
                          onClick={() => setIsOpen(false)}
                        >
                          <Icon className="h-4 w-4" />
                          {item.name}
                          {item.name === 'Wallet' && wallet && (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {wallet.balance || 0}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </nav>

                  {/* Auth section */}
                  <div className="pt-4 border-t border-border">
                    {user ? (
                      <div className="space-y-3">
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Signed in as {user.email}
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleSignOut}
                          className="w-full justify-start"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Sign Out
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Link to="/auth/signin" onClick={() => setIsOpen(false)}>
                          <Button variant="outline" className="w-full">
                            Sign In
                          </Button>
                        </Link>
                        <Link to="/auth/signup" onClick={() => setIsOpen(false)}>
                          <Button className="w-full">
                            Sign Up
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <div className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-background">
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-14 items-center border-b border-border px-6">
              <Link to="/" className="flex items-center space-x-2">
                <span className="font-bold">StoneCaster</span>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2 p-4">
              {navigation.filter(item => item.show).map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground/60 hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                    {item.name === 'Wallet' && wallet && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {wallet.balance || 0}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Auth section */}
            <div className="border-t border-border p-4">
              {user ? (
                <div className="space-y-3">
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {user.email}
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="w-full justify-start"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link to="/auth/signin">
                    <Button variant="outline" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/auth/signup">
                    <Button className="w-full">
                      Sign Up
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content with sidebar offset */}
        <div className="md:pl-64">
          {children}
        </div>
      </div>

      {/* Mobile content */}
      <div className="md:hidden">
        {children}
      </div>
    </div>
  );
}


