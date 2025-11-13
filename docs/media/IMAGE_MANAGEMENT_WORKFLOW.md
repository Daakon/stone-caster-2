# Image Management Workflow

## Overview

Images can be uploaded and managed for **Worlds**, **Stories (Entry Points)**, and **NPCs** in the admin interface. Each entity type supports:
- **Cover Image**: The primary image displayed for the entity (required for publishing)
- **Gallery**: Additional images that can be displayed in galleries or carousels

## Image Upload Flow

### 1. Upload Image
- Navigate to the entity's edit page (World, Story, or NPC)
- Go to the **Images** tab (or Images section)
- Click **"Upload image"** button
- Select an image file from your computer
- The image is uploaded to Cloudflare Images and automatically:
  - Added to the entity's **Gallery**
  - Selected for use as **Cover Image** (enables "Set as Primary" button)

### 2. Set as Cover Image
- After uploading, the **"Set as Primary"** button becomes enabled
- Click **"Set as Primary"** to set the uploaded image as the cover image
- The cover image is stored in the entity's `cover_media_id` field

### 3. Manage Gallery
- **View Gallery**: All images in the gallery are displayed in a grid
- **Add More Images**: Click **"Add to Gallery"** to select from recent uploads
- **Remove Images**: Hover over a gallery image and click the **X** button
- **Reorder Images**: Drag and drop gallery images to reorder them

## Image Storage & Delivery

### Storage
- Images are stored in Cloudflare Images
- Metadata is stored in the `media_assets` table
- Gallery links are stored in the `media_links` table
- Cover image reference is stored in the entity's `cover_media_id` field

### Delivery URLs
Images are delivered via Cloudflare Images using the format:
```
https://imagedelivery.net/{accountHash}/{imageId}/public
```

The `public` variant is the default variant that exists for all Cloudflare Images accounts. To use optimized variants (like `thumb`, `card`, `banner`), create them in the Cloudflare Images dashboard first.

## Entity-Specific Paths

### Worlds
- **Edit Page**: `/admin/worlds/{id}/edit`
- **Images Tab**: Available when `FF_ADMIN_MEDIA` is enabled
- **API Endpoints**:
  - `PATCH /api/worlds/{id}/cover-media` - Set cover image
  - `GET /api/media/links?kind=world&id={id}` - Get gallery links

### Stories (Entry Points)
- **Edit Page**: `/admin/entry-points/{id}`
- **Images Tab**: Available in the tabs when `FF_ADMIN_MEDIA` is enabled
- **API Endpoints**:
  - `PATCH /api/stories/{id}/cover-media` - Set cover image
  - `GET /api/media/links?kind=story&id={id}` - Get gallery links

### NPCs
- **Edit Page**: `/admin/npcs/{id}/edit`
- **Images Section**: Available when `FF_ADMIN_MEDIA` is enabled
- **API Endpoints**:
  - `PATCH /api/npcs/{id}/cover-media` - Set cover image
  - `GET /api/media/links?kind=npc&id={id}` - Get gallery links

## Image States & Status

### Media Asset Status
- `pending`: Image uploaded but not yet finalized
- `ready`: Image finalized and ready to use
- `failed`: Image upload/finalization failed

### Review Status
- `pending`: Awaiting admin approval
- `approved`: Approved for use
- `rejected`: Rejected (with optional reason)

## Automatic Behaviors

1. **Auto-Add to Gallery**: When you upload an image, it's automatically added to the entity's gallery
2. **Auto-Select for Cover**: The uploaded image is automatically selected, enabling the "Set as Primary" button
3. **Query Invalidation**: After upload/set/remove operations, relevant queries are invalidated to refresh the UI

## Manual Operations

### Add Existing Image to Gallery
1. Click **"Add to Gallery"** button
2. A modal opens showing recent uploads for that entity type
3. Click on an image to add it to the gallery
4. Images already in the gallery are marked as "Already in gallery"

### Remove from Gallery
1. Hover over a gallery image
2. Click the **X** button in the top-right corner
3. The image is removed from the gallery (but not deleted from Cloudflare)

### Clear Cover Image
1. If a cover image is set, click **"Clear Primary"** button
2. The cover image is removed (set to `null`)

## Permissions & Locking

- **Draft Content**: Full image management (upload, set cover, add/remove gallery, reorder)
- **Published Content**: Images are locked for non-admin users
- **Admins**: Can always manage images regardless of publish status

## Troubleshooting

### Image Not Showing
1. Check that `VITE_CF_IMAGES_DELIVERY_URL` is set in frontend `.env`
2. Verify the image variant exists in Cloudflare Images (default: `public`)
3. Check browser console for errors
4. Verify the image was finalized successfully (status should be `ready`)

### "Set as Primary" Button Disabled
- The button is only enabled when an image is selected
- After uploading, the image is automatically selected
- After refresh, you need to manually add the image to gallery first, then it can be selected

### Gallery Image Broken
- Check that the variant name matches what's configured in Cloudflare Images
- Default variant is `public` - ensure this exists in your Cloudflare account
- Verify the `provider_key` is correct in the database

