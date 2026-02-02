
## Fix Drag-and-Drop, Instant Updates, and Pin Button Positioning

This plan addresses three issues:
1. Drag-and-drop reordering not working
2. Admin actions (pin, add, remove) not updating instantly
3. Pin button should be at bottom-right opposite the watchlist button

---

### Root Cause Analysis

| Issue | Root Cause |
|-------|------------|
| **Drag-and-drop not working** | `TabbedContentRow` renders plain `MovieCard` components without DnD context. `ContentRow` has DnD but may not be triggering correctly. |
| **Updates not instant** | Each component (ContentRow, TabbedContentRow, CurationCardOverlay, SectionCurationControls) calls `useSectionCuration(sectionId)` independently, creating separate local state instances. When one updates, others don't see changes. |
| **Pin button wrong position** | Currently in `CurationCardOverlay` at bottom-left (`bottom-2 left-2`). Should be at bottom-right to match watchlist button position on opposite side. |

---

### Solution Architecture

**Migrate curation state to React Query** for automatic cache synchronization across all components using the same query key.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        React Query Cache                           │
│  Key: ["section_curation", sectionId]                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Data: CuratedItem[]                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    useSectionCuration   useSectionCuration   useSectionCuration
         │                    │                    │
   ContentRow        CurationCardOverlay   SectionCurationControls
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    Instant sync via queryClient.setQueryData()
```

---

### Implementation Steps

#### Step 1: Refactor `useSectionCuration` to Use React Query

**File:** `src/hooks/useSectionCuration.ts`

**Current:** Uses `useState` for local state - changes don't propagate
**New:** Use `useQuery` for data fetching and `useMutation` with optimistic updates

```text
Changes:
1. Replace useState(curatedItems) with useQuery(["section_curation", sectionId])
2. Add mutations for addToSection, removeFromSection, pinToTop, unpinFromTop, reorderSection
3. Use queryClient.setQueryData for instant optimistic updates
4. Use queryClient.invalidateQueries to refetch after mutations
```

Key code pattern:
```typescript
const queryClient = useQueryClient();

const { data: curatedItems = [] } = useQuery({
  queryKey: ["section_curation", sectionId],
  queryFn: async () => {
    const { data } = await supabase
      .from("section_curation")
      .select("...")
      .eq("section_id", sectionId);
    return data || [];
  },
  enabled: !!sectionId,
  staleTime: Infinity, // Don't auto-refetch
});

const pinMutation = useMutation({
  mutationFn: async ({ tmdbId, mediaType, metadata }) => {
    // Supabase upsert
  },
  onMutate: async (vars) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(["section_curation", sectionId]);
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(["section_curation", sectionId]);
    
    // Optimistically update
    queryClient.setQueryData(["section_curation", sectionId], (old) => {
      // Update logic
    });
    
    return { previous };
  },
  onError: (err, vars, context) => {
    // Rollback on error
    queryClient.setQueryData(["section_curation", sectionId], context.previous);
  },
});
```

---

#### Step 2: Add Drag-and-Drop to TabbedContentRow

**File:** `src/components/TabbedContentRow.tsx`

**Current:** Renders plain `MovieCard` without DnD context
**New:** Wrap with DndContext and SortableContext when in edit mode

```text
Changes:
1. Import DndContext, SortableContext, useSensors from @dnd-kit
2. Add handleDragEnd callback that calls reorderSection
3. Conditionally render SortableCard wrapper when isDraggable
4. Generate sortable IDs from visible items
```

---

#### Step 3: Move Pin Button to Bottom-Right

**File:** `src/components/admin/CurationCardOverlay.tsx`

**Current position:** `bottom-2 left-2`
**New position:** `bottom-2 right-2`

```text
Changes:
1. Change action buttons container from "bottom-2 left-2" to "bottom-2 right-2"
2. Adjust positioning to not overlap with watchlist button
3. Keep drag handle at top-left for easy grabbing
```

---

#### Step 4: Remove Duplicate CurationCardOverlay from SortableCard

**File:** `src/components/admin/SortableCard.tsx`

**Issue:** SortableCard renders its own CurationCardOverlay, but MovieCard also renders one when sectionId is provided. This causes duplicate overlays.

**Fix:** Only render CurationCardOverlay in SortableCard (with drag handle props), and pass a prop to MovieCard to skip its own overlay.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useSectionCuration.ts` | Refactor to use React Query with optimistic updates |
| `src/components/TabbedContentRow.tsx` | Add DnD context and SortableCard rendering |
| `src/components/admin/CurationCardOverlay.tsx` | Move buttons to bottom-right |
| `src/components/admin/SortableCard.tsx` | Remove duplicate overlay, pass skipOverlay to MovieCard |
| `src/components/MovieCard.tsx` | Add skipCurationOverlay prop to prevent duplicate |

---

### Visual Preview

**Before (Pin at bottom-left):**
```text
┌────────────────┐
│ [Block] [⭐]   │  ← Admin controls top-right
│                │
│    POSTER      │
│                │
│ [📌] [×]       │  ← Curation at bottom-left (WRONG)
│                │
│    [🔖]        │  ← Watchlist at bottom-right
└────────────────┘
```

**After (Pin at bottom-right, opposite watchlist):**
```text
┌────────────────┐
│ [⠿] [Block]   │  ← Drag handle + Block at top-left
│                │
│    POSTER      │
│                │
│                │
│ [🔖]    [📌][×]│  ← Watchlist left, Curation right
└────────────────┘
```

---

### Technical Notes

1. **React Query Cache Key**: `["section_curation", sectionId]` ensures all components watching the same section share identical data
2. **Optimistic Updates**: UI updates instantly before server confirms, rollback on error
3. **Drag-and-Drop Sensors**: PointerSensor with 8px distance constraint prevents accidental drags during clicks
4. **No Page Refresh**: All changes propagate automatically through React Query's cache invalidation
