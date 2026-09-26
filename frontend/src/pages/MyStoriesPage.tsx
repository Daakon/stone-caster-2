import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Play, RotateCcw } from 'lucide-react';
import type { GameListDTO } from '@shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getMyAdventures } from '@/lib/api';
import type { AppError } from '@/lib/errors';
import { makeTitle } from '@/lib/meta';
import { queryKeys } from '@/lib/queryKeys';

function LoadingPlaceholder() {
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="my-adventures-loading">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MyStoriesPage() {
  useEffect(() => {
    document.title = makeTitle(['My Stories', 'Stone Caster']);
  }, []);

  const {
    data: stories,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<GameListDTO[], AppError>({
    queryKey: queryKeys.myAdventures(),
    queryFn: async () => {
      const result = await getMyAdventures();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    retry: false,
  });

  const appError = isError ? error : null;
  const isUnauthorized = appError?.code === 'UNAUTHORIZED';
  const isEarlyAccessRequired = appError?.code === 'EARLY_ACCESS_REQUIRED';
  const items = stories ?? [];

  return (
    <div className="container max-w-screen-xl space-y-8 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Stories</h1>
          <p className="text-muted-foreground">
            Pick up where you left off or dive back into an unfinished story.
          </p>
        </div>
        <Button asChild>
          <Link to="/stories/compose" aria-label="Start a new story">
            <Play className="mr-2 h-4 w-4" /> New Story
          </Link>
        </Button>
      </div>

      {isLoading && <LoadingPlaceholder />}

      {!isLoading && isEarlyAccessRequired && (
        <Alert data-testid="my-adventures-early-access">
          <AlertTitle>Early Access Required</AlertTitle>
          <AlertDescription>
            StoneCaster is currently in Early Access. You need to request and receive approval to access your stories.
          </AlertDescription>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/request-access">Request Access</Link>
            </Button>
          </div>
        </Alert>
      )}

      {!isLoading && !isEarlyAccessRequired && isUnauthorized && (
        <Alert data-testid="my-adventures-unauthorized">
          <AlertTitle>Sign in to see your stories</AlertTitle>
          <AlertDescription>
            We could not load your saved stories. Sign in to resume a story, or start a new one from the stories library.
          </AlertDescription>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/auth/signin">Sign In</Link>
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Try again
            </Button>
          </div>
        </Alert>
      )}

      {!isLoading && !isEarlyAccessRequired && !isUnauthorized && isError && (
        <Alert variant="destructive">
          <AlertTitle>Stories could not be loaded</AlertTitle>
          <AlertDescription>
            Something went wrong while loading your stories. Please try again.
          </AlertDescription>
          <div className="mt-4">
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Try again
            </Button>
          </div>
        </Alert>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <Card data-testid="my-adventures-empty">
          <CardHeader>
            <CardTitle>No stories yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              When you start a story, it will appear here so you can resume it later.
            </p>
            <Button asChild>
              <Link to="/stories">Browse Stories</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2" data-testid="my-adventures-list">
          {items.map((story) => (
            <Card key={story.id} className="h-full">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xl font-semibold">
                    {story.adventureTitle}
                  </CardTitle>
                  <Badge variant="secondary" className="capitalize">
                    {story.status.toLowerCase()}
                  </Badge>
                </div>
                {story.characterName && (
                  <p className="text-sm text-muted-foreground">
                    Playing as {story.characterName}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  <span>Last played {new Date(story.lastPlayedAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Turn {story.turnCount}</span>
                  <span>{story.worldName}</span>
                </div>
                <Button asChild className="w-full">
                  <Link to={`/play/${story.id}`} aria-label={`Continue ${story.adventureTitle}`}>
                    Continue
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
