import React, { useEffect } from 'react';
import { useRulesetsQuery } from '@/lib/queries';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogSkeleton } from '@/components/catalog/CatalogSkeleton';
import { EmptyState } from '@/components/catalog/EmptyState';
import { RulesetsFilterBar } from '@/components/filters/RulesetsFilterBar';
import { trackCatalogView, trackCatalogCardClick } from '@/lib/analytics';
import { useURLFilters } from '@/lib/useURLFilters';
import type { FilterValue } from '@/lib/useURLFilters';
import { absoluteUrl, makeDescription, makeTitle, ogTags, twitterTags, upsertLink, upsertMeta, upsertProperty } from '@/lib/meta';

interface RulesetFilters {
  q: string;
  [key: string]: FilterValue;
}

export default function RulesetsPage() {
  const { filters, updateFilters, reset } = useURLFilters<RulesetFilters>({
    q: ''
  });

  // Load rulesets with current filters
  const rulesetsQ: any = useRulesetsQuery(filters.q || undefined);
  const isLoading = rulesetsQ.isLoading;
  const error = rulesetsQ.error;
  const rulesets = Array.isArray(rulesetsQ?.data)
    ? rulesetsQ.data
    : (rulesetsQ?.data?.data ?? []);

  // Track catalog view on mount
  useEffect(() => {
    trackCatalogView('rulesets');
  }, []);

  useEffect(() => {
    const title = makeTitle(['Browse Rulesets', 'StoneCaster']);
    const desc = makeDescription('Explore rulesets that power stories on StoneCaster.');
    const url = absoluteUrl('/rulesets');
    const image = absoluteUrl('/og/ruleset/browse');
    document.title = title;
    upsertMeta('description', desc);
    upsertLink('canonical', url);
    const og = ogTags({ title, description: desc, url, image });
    Object.entries(og).forEach(([k, v]) => upsertProperty(k, v));
    const tw = twitterTags({ title, description: desc, url, image });
    Object.entries(tw).forEach(([k, v]) => upsertMeta(k, v));
  }, []);

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
          
          <RulesetsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
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
          
          <RulesetsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
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
          
          <RulesetsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
          
          <EmptyState
            title="No rulesets found"
            description={
              filters.q
                ? "No rulesets match your search. Try adjusting your search terms."
                : "No rulesets are available at the moment. Check back later for new systems."
            }
            actionLabel="Clear filters"
            onAction={reset}
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
        
        <RulesetsFilterBar filters={filters} updateFilters={updateFilters} reset={reset} />
        
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
              idOrSlug={ruleset.slug || ruleset.id}
              title={ruleset.name}
              description={ruleset.description}
              href={`/rulesets/${ruleset.slug || ruleset.id}`}
              onCardClick={() => handleCardClick(ruleset.slug || ruleset.id)}
            />
          ))}
        </CatalogGrid>
      </div>
    </div>
  );
}