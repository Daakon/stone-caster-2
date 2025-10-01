import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Header } from '@/components/header';

export default function HomePage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main id="main-content" role="main" className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
          🎲 Stonecaster
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8">
          AI-Driven Role-Playing Adventures
        </p>
      </main>

      <section className="container mx-auto px-4 py-8" aria-label="Features">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-card-foreground mb-3">
              📖 AI Storytelling
            </h2>
            <p className="text-muted-foreground">
              Experience dynamic narratives powered by advanced AI
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-card-foreground mb-3">
              ⚔️ Character Creation
            </h2>
            <p className="text-muted-foreground">
              Create unique characters with rich backstories
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-card-foreground mb-3">
              🌍 World Templates
            </h2>
            <p className="text-muted-foreground">
              Explore diverse settings from fantasy to sci-fi
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-card-foreground mb-3">
              💾 Persistent Saves
            </h2>
            <p className="text-muted-foreground">
              Your adventures are always saved and ready
            </p>
          </div>
        </div>
      </section>

      <nav className="container mx-auto px-4 py-8 text-center" aria-label="Main navigation">
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {user ? (
            <>
              <Link 
                to="/characters" 
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                My Characters
              </Link>
              <Link 
                to="/worlds" 
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Start Adventure
              </Link>
            </>
          ) : (
            <>
              <Link 
                to="/auth" 
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Get Started
              </Link>
              <Link 
                to="/auth?mode=signin" 
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </nav>

      <footer id="footer" role="contentinfo" className="container mx-auto px-4 py-8 text-center border-t border-border">
        <p className="text-sm text-muted-foreground">
          Mobile-first design • Accessible • Powered by AI
        </p>
      </footer>
    </div>
  );
}
