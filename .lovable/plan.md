# Metadata Management System - COMPLETE

Implementation completed on 2026-02-02.

## Summary

Removed old backfill tools and implemented a comprehensive metadata management system with:

- **Prefill All Posts** tool that fetches TMDB data for all entries, skipping admin-edited ones
- **Auto-fetch on Save** - when saving links, automatically fetches and saves TMDB metadata including episode details
- **Editable Metadata Fields** - poster, backdrop, logo URLs, and overview can be manually edited
- **Episode Metadata Editor** - manage episode names, descriptions, and thumbnails
- **Admin Edited Flag** - mark entries to skip during bulk prefill
- **DB-First Episode Loading** - TVDetails page checks entry_metadata table first before TMDB

## Files Created

1. `src/hooks/useEntryMetadata.ts` - CRUD operations for entry_metadata table
2. `src/components/admin/MetadataPrefillTool.tsx` - Bulk prefill with skip logic
3. `src/components/admin/EpisodeMetadataEditor.tsx` - Episode-level editing component

## Files Modified

1. `src/components/admin/UpdateLinksPanel.tsx` - Added metadata section, episode editor, refresh TMDB button
2. `src/hooks/useEntries.ts` - Added overview, tagline, runtime, number_of_seasons, admin_edited fields
3. `src/pages/TVDetails.tsx` - Check entry_metadata table first for episodes

## Files Deleted

1. `src/components/admin/MetadataBackfillTool.tsx`
2. `src/components/admin/ArtworkBackfillTool.tsx`

## Database Requirements (already set up)

- `admin_edited` column on `entries` table
- `entry_metadata` table for episode details
- RLS policies with `has_role` function
- Index for faster lookups
