import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/store/auth';

interface GlobalHeaderProps {
  variant?: 'full' | 'compact';
  showSearch?: boolean;
}

export function GlobalHeader({ variant = 'full', showSearch = false }: GlobalHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const location = useLocation();

  const navigation = [
    { name: 'Adventures', href: '/adventures' },
    { name: 'My Games', href: '/adventures' }, // TODO: Update to actual my games route
    { name: 'Wallet', href: '/wallet' },
    { name: 'Profile', href: '/profile' },
  ];

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  const isCompact = variant === 'compact';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div id="navigation" className="container flex h-14 max-w-screen-2xl items-center">
        {/* Logo */}
        <div className="mr-4 hidden md:flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">🎲 StoneCaster</span>
          </Link>
        </div>

        {/* Desktop Navigation - only show if not compact */}
        {!isCompact && (
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`transition-colors hover:text-foreground/80 ${
                  location.pathname === item.href
                    ? 'text-foreground'
                    : 'text-foreground/60'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side */}
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Mobile logo */}
            <Link to="/" className="md:hidden flex items-center space-x-2">
              <span className="font-bold">🎲 StoneCaster</span>
            </Link>
          </div>
          
          <nav className="flex items-center space-x-2">
            {/* Search - only show on explore pages */}
            {showSearch && (
              <Button variant="ghost" size="sm" className="hidden md:inline-flex">
                <Search className="h-4 w-4" />
              </Button>
            )}
            
            <ThemeToggle />
            
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="hidden md:inline-flex"
              >
                Sign Out
              </Button>
            ) : (
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link to="/auth/signin">Sign In</Link>
              </Button>
            )}

            {/* Mobile menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  className="md:hidden"
                  size="icon"
                  aria-label="Toggle menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col space-y-4 mt-4">
                  {/* Mobile logo */}
                  <Link 
                    to="/" 
                    className="flex items-center space-x-2 font-bold text-lg"
                    onClick={() => setIsOpen(false)}
                  >
                    🎲 StoneCaster
                  </Link>
                  
                  {/* Mobile navigation */}
                  <nav className="flex flex-col space-y-2">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          location.pathname === item.href
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground/60 hover:text-foreground hover:bg-accent'
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </nav>

                  {/* Mobile auth */}
                  <div className="pt-4 border-t border-border">
                    {user ? (
                      <Button
                        variant="ghost"
                        onClick={handleSignOut}
                        className="w-full justify-start"
                      >
                        Sign Out
                      </Button>
                    ) : (
                      <Button asChild className="w-full">
                        <Link to="/auth/signin" onClick={() => setIsOpen(false)}>
                          Sign In
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </nav>
        </div>
      </div>
    </header>
  );
}




