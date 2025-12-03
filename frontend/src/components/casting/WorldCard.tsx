/**
 * WorldCard Component for Casting Circle
 * Displays a world card with banner image priority logic
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorldDefinition } from '@shared/types/chimera-authoring';
import type { ChimeraAssetRef } from '@shared/types/chimera-assets';

interface WorldCardProps {
  world: WorldDefinition;
  isSelected?: boolean;
  onClick?: () => void;
}

export const WorldCard: React.FC<WorldCardProps> = ({
  world,
  isSelected = false,
  onClick,
}) => {
  // Debug logging to see what data we're receiving
  if (process.env.NODE_ENV === 'development') {
    console.log(`[WorldCard] Rendering world: ${world.name}`, {
      images: world.images,
      imagesType: typeof world.images,
      imagesIsArray: Array.isArray(world.images),
    });
  }

  // Defensive coding: Ensure images is always an array (handle null/undefined from DB)
  const imagesArray: ChimeraAssetRef[] = Array.isArray(world.images) ? world.images : [];
  
  // Prioritize explicit banner, fall back to first index, fall back to placeholder
  const bannerImage: ChimeraAssetRef | undefined = imagesArray.find(
    (img: ChimeraAssetRef) => img.role === 'banner'
  ) || imagesArray[0];

  // Use placeholder if no images available (fallback to CSS gradient if file doesn't exist)
  const displayUrl = bannerImage?.url || 'https://placehold.co/400x225/6366f1/ffffff?text=No+Image';

  if (process.env.NODE_ENV === 'development') {
    console.log(`[WorldCard] Selected image URL for ${world.name}:`, displayUrl);
  }

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-purple-500 ring-offset-2' : ''
      }`}
      onClick={onClick}
    >
      <div className="aspect-video bg-muted relative">
        <img
          src={displayUrl}
          alt={world.name}
          className="w-full h-full object-cover"
        />
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-1">{world.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {world.description || 'No description'}
        </CardDescription>
      </CardHeader>
    </Card>
  );
};

