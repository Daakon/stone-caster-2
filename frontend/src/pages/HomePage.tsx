import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function HomePage() {
  const { user } = useAuthStore();

  return (
    <div className="home-page" role="main">
      <header className="hero">
        <h1>🎲 Stonecaster</h1>
        <p className="tagline">AI-Driven Role-Playing Adventures</p>
      </header>

      <section className="features" aria-label="Features">
        <div className="feature-grid">
          <div className="feature-card">
            <h2>📖 AI Storytelling</h2>
            <p>Experience dynamic narratives powered by advanced AI</p>
          </div>
          <div className="feature-card">
            <h2>⚔️ Character Creation</h2>
            <p>Create unique characters with rich backstories</p>
          </div>
          <div className="feature-card">
            <h2>🌍 World Templates</h2>
            <p>Explore diverse settings from fantasy to sci-fi</p>
          </div>
          <div className="feature-card">
            <h2>💾 Persistent Saves</h2>
            <p>Your adventures are always saved and ready</p>
          </div>
        </div>
      </section>

      <nav className="cta-section" aria-label="Main navigation">
        {user ? (
          <>
            <Link to="/characters" className="btn btn-primary">
              My Characters
            </Link>
            <Link to="/worlds" className="btn btn-secondary">
              Start Adventure
            </Link>
          </>
        ) : (
          <>
            <Link to="/auth" className="btn btn-primary">
              Get Started
            </Link>
            <Link to="/auth?mode=signin" className="btn btn-secondary">
              Sign In
            </Link>
          </>
        )}
      </nav>

      <footer className="home-footer">
        <p>
          Mobile-first design • Accessible • Powered by AI
        </p>
      </footer>
    </div>
  );
}
