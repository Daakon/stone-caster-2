import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Client-side redirect component for /adventures routes to /stories
 * This provides a fallback for any missed redirects
 */
export function AdventureToStoryRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirect /adventures to /stories
    if (location.pathname.startsWith('/adventures')) {
      const newPath = location.pathname.replace('/adventures', '/stories');
      navigate(newPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}
