/**
 * Media URL Builder Tests
 * Phase 2a: Unit tests for URL builder
 */

import { describe, it, expect } from 'vitest';
import { buildImageUrl } from '../url.js';

describe('buildImageUrl', () => {
  const deliveryUrl = 'https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw';
  const imageId = 'test-image-id-123';

  it('should build correct URL for thumb variant', () => {
    const url = buildImageUrl(deliveryUrl, imageId, 'thumb');
    expect(url).toBe(`${deliveryUrl}/${imageId}/thumb`);
  });

  it('should build correct URL for avatar variant', () => {
    const url = buildImageUrl(deliveryUrl, imageId, 'avatar');
    expect(url).toBe(`${deliveryUrl}/${imageId}/avatar`);
  });

  it('should build correct URL for card variant', () => {
    const url = buildImageUrl(deliveryUrl, imageId, 'card');
    expect(url).toBe(`${deliveryUrl}/${imageId}/card`);
  });

  it('should build correct URL for banner variant', () => {
    const url = buildImageUrl(deliveryUrl, imageId, 'banner');
    expect(url).toBe(`${deliveryUrl}/${imageId}/banner`);
  });

  it('should handle delivery URL with trailing slash', () => {
    const urlWithSlash = `${deliveryUrl}/`;
    const url = buildImageUrl(urlWithSlash, imageId, 'thumb');
    expect(url).toBe(`${deliveryUrl}/${imageId}/thumb`);
  });

  it('should throw error if delivery URL is empty', () => {
    expect(() => buildImageUrl('', imageId, 'thumb')).toThrow('Delivery URL is required');
  });

  it('should throw error if image ID is empty', () => {
    expect(() => buildImageUrl(deliveryUrl, '', 'thumb')).toThrow('Image ID is required');
  });
});



