import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Play, RotateCcw } from 'lucide-react';
import { getMyAdventures } from '@/lib/api';
import type { AppError } from '@/lib/errors';
import type { GameListDTO } from '@shared';

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

export default function MyAdventuresPage() {
  const {
    data: adventures,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<GameListDTO[], AppError>({
    queryKey: ['my-adventures'],
    queryFn: async () => {
      const result = await getMyAdventures();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    retry: (failureCount, fetchError) => {
      if (fetchError?.code === 'UNAUTHORIZED') {
        return false;
      }
      return failureCount < 2;
    },
  });

  const appError = isError ? error : null;
  const isUnauthorized = appError?.code === 'UNAUTHORIZED';
  const items = adventures ?? [];
  const hasAdventures = items.length > 0;

  return (
    <div className="container max-w-screen-xl space-y-8 py-6" id="main-content">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Adventures</h1>
          <p className="text-muted-foreground">
            Pick up where you left off or dive back into an unfinished story.
          </p>
        </div>
        <Button asChild>
          <Link to="/adventures" aria-label="Start a new adventure">
            <Play className="mr-2 h-4 w-4" /> New Adventure
          </Link>
        </Button>
      </div>

      {isLoading && <LoadingPlaceholder />}

      {!isLoading && isUnauthorized && (
        <Alert data-testid="my-adventures-unauthorized">
          <AlertTitle>Sign in to see your adventures</AlertTitle>
          <AlertDescription>
            We could not load your saved adventures. Sign in to resume a story, or start a new one from the
            adventures library.
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

      {!isLoading && !isUnauthorized && !hasAdventures && (
        <Card data-testid="my-adventures-empty">
          <CardHeader>
            <CardTitle>No adventures yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              When you start an adventure, it will appear here so you can resume it later.
            </p>
            <Button asChild>
              <Link to="/adventures">Browse Adventures</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isUnauthorized && hasAdventures && (
        <div className="grid gap-4 md:grid-cols-2" data-testid="my-adventures-list">
          {adventures!.map((adventure) => (
            <Card key={adventure.id} className="h-full">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xl font-semibold">
                    {adventure.adventureTitle}
                  </CardTitle>
                  <Badge variant="secondary" className="capitalize">
                    {adventure.status.toLowerCase()}
                  </Badge>
                </div>
                {adventure.characterName && (
                  <p className="text-sm text-muted-foreground">
                    Playing as {adventure.characterName}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  <span>Last played {new Date(adventure.lastPlayedAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Turn {adventure.turnCount}</span>
                  <span>{adventure.worldName}</span>
                </div>
                <Button asChild className="w-full">
                  <Link to={`/play/${adventure.id}`} aria-label={`Continue ${adventure.adventureTitle}`}>
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


