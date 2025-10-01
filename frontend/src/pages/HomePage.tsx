import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function HomePage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-background text-foreground" role="main">
      <header className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">🎲 Stonecaster</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8">AI-Driven Role-Playing Adventures</p>
      </header>

      <section className="container mx-auto px-4 py-8" aria-label="Features">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card text-card-foreground p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-2">📖 AI Storytelling</h2>
            <p className="text-muted-foreground">Experience dynamic narratives powered by advanced AI</p>
          </div>
          <div className="bg-card text-card-foreground p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-2">⚔️ Character Creation</h2>
            <p className="text-muted-foreground">Create unique characters with rich backstories</p>
          </div>
          <div className="bg-card text-card-foreground p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-2">🌍 World Templates</h2>
            <p className="text-muted-foreground">Explore diverse settings from fantasy to sci-fi</p>
          </div>
          <div className="bg-card text-card-foreground p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-2">💾 Persistent Saves</h2>
            <p className="text-muted-foreground">Your adventures are always saved and ready</p>
          </div>
        </div>
      </section>

      <nav className="container mx-auto px-4 py-8 text-center" aria-label="Main navigation">
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {user ? (
            <>
              <Link 
                to="/characters" 
                className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                My Characters
              </Link>
              <Link 
                to="/worlds" 
                className="bg-secondary text-secondary-foreground px-6 py-3 rounded-md font-medium hover:bg-secondary/90 transition-colors"
              >
                Start Adventure
              </Link>
            </>
          ) : (
            <>
              <Link 
                to="/auth" 
                className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
              <Link 
                to="/auth?mode=signin" 
                className="bg-secondary text-secondary-foreground px-6 py-3 rounded-md font-medium hover:bg-secondary/90 transition-colors"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </nav>

      <footer className="container mx-auto px-4 py-8 text-center text-muted-foreground">
        <p>
          Mobile-first design • Accessible • Powered by AI
        </p>
      </footer>
    </div>
  );
}
