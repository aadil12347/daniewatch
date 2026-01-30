
## Fix Curation Controls Visibility + Add Drag-and-Drop Reordering

This plan addresses two issues:
1. Curation controls not visible when expected
2. Adding drag-and-drop reordering for curated items

---

### Root Cause Analysis

After investigation, I identified the following issues:

| Issue | Location | Problem |
|-------|----------|---------|
| **Card overlay hidden** | `CurationCardOverlay.tsx` | Pin/Remove buttons have `opacity-0 group-hover:opacity-100` - only visible on hover, not always visible in Edit Mode |
| **Section controls may render but not be noticeable** | `SectionCurationControls.tsx` | Controls are small and may blend with the UI |
| **No visual indicators on curated/pinned items** | `MovieCard.tsx` | No badge or highlight to show which items are pinned or curated |

---

### Part 1: Fix Curation Controls Visibility

#### 1.1 Make CurationCardOverlay Always Visible in Edit Mode

**File:** `src/components/admin/CurationCardOverlay.tsx`

**Current behavior:** Buttons have `opacity-0 group-hover:opacity-100` - only visible on hover

**Fixed behavior:** Remove hover-only opacity; buttons always visible in Edit Mode

```text
Change:
- className="opacity-0 group-hover:opacity-100"

To:
- className="" (always visible when rendered)

Also add a visual "PINNED" badge for pinned items.
```

#### 1.2 Make SectionCurationControls More Prominent

**File:** `src/components/admin/SectionCurationControls.tsx`

**Current behavior:** Small outline buttons that may not stand out

**Fixed behavior:** Add a visual indicator (badge/pill) showing "Curation Mode" active, with count of curated items

```text
Add:
- "Curation Mode" badge with primary color styling
- Show count of curated items in section
- More prominent button styling
```

#### 1.3 Add Visual Indicator for Pinned/Curated Items

**File:** `src/components/MovieCard.tsx`

**Add:** When in Edit Mode, show a small pin icon badge on cards that are pinned

```text
Add visual indicator when:
- movie._isPinned = true → Show "📌" badge
- movie._isCurated = true → Show subtle highlight border
```

---

### Part 2: Add Drag-and-Drop Reordering

#### 2.1 Install DnD Library

**Package:** `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`

This is a lightweight, accessible, and performant drag-and-drop library for React.

#### 2.2 Create Draggable Content Row Component

**New File:** `src/components/admin/DraggableContentRow.tsx`

This wrapper component enables reordering when in Edit Mode:

```text
- Wraps existing ContentRow content
- Uses @dnd-kit/sortable for reorder
- Only enables drag when isAdmin && isEditLinksMode
- On drop, calls reorderSection() from useSectionCuration
- Shows drag handles on cards
```

#### 2.3 Add Reorder Function to useSectionCuration Hook

**File:** `src/hooks/useSectionCuration.ts`

**Add:** `reorderSection(orderedItems)` function to persist new order:

```text
reorderSection(orderedItems: Array<{tmdbId, mediaType}>):
1. Update local state with new order
2. Batch update sort_order in section_curation table
3. Handle optimistic updates for instant feedback
```

#### 2.4 Integrate into ContentRow

**File:** `src/components/ContentRow.tsx`

**Modify:**
- When `isAdmin && isEditLinksMode && sectionId`, wrap cards in a sortable context
- Add drag handle icon on each card
- On drag end, call reorderSection

---

### Part 3: Enhance Edit Mode Indicator

**File:** `src/components/admin/EditLinksModeIndicator.tsx`

**Add:** More prominent styling and status info:

```text
- Show "Curation + Links Mode Active"
- Add subtle pulsing animation to draw attention
- Show quick stats: "X sections have curation"
```

---

### Implementation Order

1. **Fix CurationCardOverlay visibility** - Remove hover-only opacity
2. **Enhance SectionCurationControls styling** - Add prominent badge
3. **Add pinned item indicators** - Visual badges on MovieCard
4. **Install @dnd-kit packages** - For drag-and-drop
5. **Add reorderSection to hook** - Database persistence
6. **Create DraggableContentRow** - Sortable wrapper
7. **Integrate drag-and-drop into ContentRow** - Connect everything
8. **Test end-to-end** - Verify all controls visible and functional

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/CurationCardOverlay.tsx` | Remove hover-only opacity, always visible in edit mode |
| `src/components/admin/SectionCurationControls.tsx` | Add prominent "Curation Mode" badge |
| `src/components/MovieCard.tsx` | Add pinned/curated visual indicators |
| `src/hooks/useSectionCuration.ts` | Add `reorderSection()` function |
| `src/components/ContentRow.tsx` | Integrate drag-and-drop when in edit mode |
| `src/components/TabbedContentRow.tsx` | Same drag-and-drop integration |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/SortableCard.tsx` | Wrapper for draggable MovieCard |

### Dependencies to Install

| Package | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | ^6.0.0 | Core drag-and-drop engine |
| `@dnd-kit/sortable` | ^8.0.0 | Sortable list primitives |
| `@dnd-kit/utilities` | ^3.0.0 | CSS transform utilities |

---

### Visual Preview

**Section Header (Edit Mode ON):**
```text
┌────────────────────────────────────────────────────────────────────┐
│  Trending Now    🟣 Curation Mode (3 items)    [+ Add]  [Reset]   │
└────────────────────────────────────────────────────────────────────┘
```

**Card (Edit Mode ON - Always Visible Controls):**
```text
┌────────────────┐
│ ≡ DRAG        │  ← Drag handle (always visible)
│                │
│    POSTER      │
│      📌        │  ← Pin badge (if pinned)
│ [📌] [×]       │  ← Curation buttons (always visible, not hover)
└────────────────┘
```

**Edit Mode Indicator (Bottom Right):**
```text
┌─────────────────────────────────┐
│  🟣 EDIT MODE                   │
│  Ctrl+Shift+E to exit           │
│  [Exit Mode]                    │
└─────────────────────────────────┘
```

---

### Technical Notes

- Drag-and-drop only activates in Edit Mode
- Reorder persists immediately to Supabase
- Optimistic updates ensure instant visual feedback
- Pin badge uses a simple icon overlay, not an extra component
- All existing features (hover effects, click navigation) remain unchanged
