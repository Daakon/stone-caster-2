import React, { useState, useEffect } from 'react';
import { useRulesetsQuery } from '@/lib/queries';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { RulesetsFilterBar } from '@/components/filters/RulesetsFilterBar';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';

interface RulesetFilters {
  q: string;
}

export default function RulesetsPage() {
  const [filters, setFilters] = useState<RulesetFilters>({
    q: ''
  });

  // Load rulesets with current filters
  const { data: rulesetsData, isLoading, error } = useRulesetsQuery(filters.q || undefined);

  const rulesets = rulesetsData || [];

  // Track catalog view on mount
  useEffect(() => {
    trackCatalogView('rulesets');
  }, []);

  const handleFiltersChange = (newFilters: RulesetFilters) => {
    setFilters(newFilters);
  };

  const handleCardClick = (rulesetId: string) => {
    trackCatalogCardClick('rulesets', rulesetId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Rulesets</h1>
            <p className="text-muted-foreground mt-2">
              Discover the game systems that power your adventures
            </p>
          </div>
          
          <RulesetsFilterBar onFiltersChange={handleFiltersChange} />
          
          <CatalogGrid>
            {Array.from({ length: 6 }).map((_, index) => (
              <CatalogSkeleton key={index} />
            ))}
          </CatalogGrid>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Rulesets</h1>
            <p className="text-muted-foreground mt-2">
              Discover the game systems that power your adventures
            </p>
          </div>
          
          <RulesetsFilterBar onFiltersChange={handleFiltersChange} />
          
          <EmptyState
            title="Error loading rulesets"
            description="There was a problem loading the rulesets. Please try again."
            actionLabel="Refresh page"
            onAction={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (rulesets.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Rulesets</h1>
            <p className="text-muted-foreground mt-2">
              Discover the game systems that power your adventures
            </p>
          </div>
          
          <RulesetsFilterBar onFiltersChange={handleFiltersChange} />
          
          <EmptyState
            title="No rulesets found"
            description={
              filters.q
                ? "No rulesets match your search. Try adjusting your search terms."
                : "No rulesets are available at the moment. Check back later for new systems."
            }
            actionLabel="Clear filters"
            onAction={() => setFilters({ q: '' })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Rulesets</h1>
          <p className="text-muted-foreground mt-2">
            Discover the game systems that power your adventures
          </p>
        </div>
        
        <RulesetsFilterBar onFiltersChange={handleFiltersChange} />
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {rulesets.length} {rulesets.length === 1 ? 'ruleset' : 'rulesets'} found
          </p>
        </div>
        
        <CatalogGrid>
          {rulesets.map((ruleset) => (
            <CatalogCard
              key={ruleset.id}
              entity="ruleset"
              title={ruleset.name}
              description={ruleset.description}
              href={`/rulesets/${ruleset.id}`}
              onClick={() => handleCardClick(ruleset.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}