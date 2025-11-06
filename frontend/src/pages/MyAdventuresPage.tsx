import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Play, RotateCcw } from 'lucide-react';
import { useMyAdventures } from '@/lib/queries/index';
import { useAccessStatusContext } from '@/providers/AccessStatusProvider';
import { useAuthStore } from '@/store/auth';

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
  const { user } = useAuthStore();
  const { hasApprovedAccess, isLoading: isLoadingAccess } = useAccessStatusContext();
  
  // Only fetch adventures if user has approved access
  const {
    data: adventures,
    isLoading,
    isError,
    error,
    refetch,
  } = useMyAdventures();

  const appError = isError ? (error as any) : null;
  const isUnauthorized = appError?.code === 'UNAUTHORIZED';
  const isEarlyAccessRequired = appError?.code === 'EARLY_ACCESS_REQUIRED';
  const items = adventures ?? [];
  const hasAdventures = items.length > 0;

  return (
    <div className="container max-w-screen-xl space-y-8 py-6" id="main-content">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Stories</h1>
          <p className="text-muted-foreground">
            Pick up where you left off or dive back into an unfinished story.
          </p>
        </div>
        <Button asChild>
          <Link to="/stories" aria-label="Start a new story">
            <Play className="mr-2 h-4 w-4" /> New Story
          </Link>
        </Button>
      </div>

      {(isLoading || isLoadingAccess) && <LoadingPlaceholder />}

      {!isLoading && !isLoadingAccess && isEarlyAccessRequired && (
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

      {!isLoading && !isLoadingAccess && !isEarlyAccessRequired && isUnauthorized && (
        <Alert data-testid="my-adventures-unauthorized">
          <AlertTitle>Sign in to see your stories</AlertTitle>
          <AlertDescription>
            We could not load your saved stories. Sign in to resume a story, or start a new one from the
            stories library.
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

      {!isLoading && !isLoadingAccess && !isEarlyAccessRequired && !isUnauthorized && !hasAdventures && (
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

      {!isLoading && !isLoadingAccess && !isEarlyAccessRequired && !isUnauthorized && hasAdventures && (
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


