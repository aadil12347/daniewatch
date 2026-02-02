
## Fix Drag-and-Drop + Move Pin to Left Side + Make Whole Card Draggable

This plan fixes three issues:
1. Drag and arrange not working (cards stay rigid when dragging)
2. Move pin option to the left side of the poster (aligned with three-dots menu)
3. Remove separate drag handle - make entire card draggable in Edit Mode

---

### Root Cause Analysis

| Issue | Root Cause |
|-------|------------|
| **Cards don't move when dragging** | The `listeners` from `useSortable` are only applied to a small drag handle icon in `CurationCardOverlay`, not to the draggable wrapper. The handle is rendered separately and doesn't properly connect to the sortable system. |
| **Pin button position** | Currently at `bottom-[4.5rem] right-10` - needs to move to left side |
| **Separate drag handle** | User wants to remove the GripVertical icon and make the whole poster draggable |

---

### Solution

#### 1. Make Entire Card Draggable

**File:** `src/components/admin/SortableCard.tsx`

Apply `listeners` directly to the wrapper element instead of passing them to a separate drag handle:

```text
Current (broken):
- listeners passed to CurationCardOverlay → drag handle div
- Only small icon area is draggable

Fixed:
- listeners applied directly to the wrapper div
- Entire card becomes draggable
- Add visual feedback (cursor, ring) when hovering in edit mode
```

Key changes:
```typescript
return (
  <div 
    ref={setNodeRef} 
    style={style} 
    {...attributes} 
    {...listeners}  // Apply listeners to ENTIRE card
    className={cn(
      "relative flex-shrink-0",
      "cursor-grab active:cursor-grabbing",  // Visual feedback
      isDragging && "ring-2 ring-primary/60 rounded-xl"
    )}
  >
    <CurationCardOverlay ... />  // No more dragHandleProps
    <MovieCard ... />
  </div>
);
```

---

#### 2. Move Pin Button to Left Side

**File:** `src/components/admin/CurationCardOverlay.tsx`

```text
Current position: bottom-[4.5rem] right-10 (bottom-right)
New position: bottom-[4.5rem] left-2 (bottom-left, aligned with three-dots)

Also remove:
- GripVertical drag handle (no longer needed)
- dragHandleProps prop (no longer needed)
```

Visual layout after fix:
```
┌────────────────┐
│ [≡3dots]       │  ← Admin three-dots menu (top-left)
│                │
│    POSTER      │
│                │
│ [📌][×]   [🔖]│  ← Pin/Remove left, Watchlist right
└────────────────┘
```

---

#### 3. Update CurationCardOverlay Props

**File:** `src/components/admin/CurationCardOverlay.tsx`

Remove:
- `dragHandleProps` prop (no longer used)
- Drag handle div with `GripVertical` icon

Keep:
- Pinned badge at top-center
- Pin/Remove buttons (move to bottom-left)
- Curated indicator border

---

#### 4. Add Drag Visual Feedback to Card

**File:** `src/components/admin/SortableCard.tsx`

When in Edit Mode and hovering, show visual cues that the card is draggable:
- `cursor-grab` on hover
- `cursor-grabbing` while dragging
- Subtle ring/border highlight while dragging
- Scale up slightly when picked up

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/SortableCard.tsx` | Apply `listeners` to wrapper, add cursor/ring styles |
| `src/components/admin/CurationCardOverlay.tsx` | Remove drag handle, move buttons to bottom-left |

---

### Code Changes

#### SortableCard.tsx

```typescript
export function SortableCard({
  movie,
  index,
  sectionId,
  // ... other props
}: SortableCardProps) {
  const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
  const sortableId = `${movie.id}-${mediaType}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}  // ← APPLY LISTENERS TO ENTIRE CARD
      className={cn(
        "relative flex-shrink-0 touch-none",  // touch-none for mobile
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-90 scale-[1.02] ring-2 ring-primary/60 rounded-xl shadow-xl"
      )}
    >
      <CurationCardOverlay
        tmdbId={movie.id}
        mediaType={mediaType}
        sectionId={sectionId}
        title={movie.title || movie.name}
        posterPath={movie.poster_path}
        isDragging={isDragging}
        // No more dragHandleProps
      />

      <MovieCard
        movie={movie}
        // ... other props
      />
    </div>
  );
}
```

#### CurationCardOverlay.tsx

```typescript
interface CurationCardOverlayProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  sectionId: string;
  title?: string;
  posterPath?: string | null;
  className?: string;
  isDragging?: boolean;
  // REMOVED: dragHandleProps
}

export function CurationCardOverlay({
  tmdbId,
  mediaType,
  sectionId,
  title,
  posterPath,
  className,
  isDragging,
}: CurationCardOverlayProps) {
  // ... existing logic ...

  return (
    <>
      {/* Pinned badge - top center (unchanged) */}
      {isPinned && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 ...">
          <Pin className="w-3 h-3" />
          Pinned
        </div>
      )}

      {/* REMOVED: Drag handle div */}

      {/* Action buttons - MOVED to bottom LEFT */}
      <div
        className={cn(
          "absolute bottom-[4.5rem] left-2 z-40 flex items-center gap-1",
          "transition-opacity duration-200",
          className
        )}
      >
        {/* Pin/Unpin button */}
        <button onClick={handlePin} ...>
          {isPinned ? <PinOff /> : <Pin />}
        </button>

        {/* Remove button */}
        {isInSection && (
          <button onClick={handleRemove} ...>
            <X />
          </button>
        )}
      </div>

      {/* Curated indicator border (unchanged) */}
      {isInSection && (
        <div className="absolute inset-0 rounded-xl pointer-events-none z-30 ring-2 ring-inset ..." />
      )}
    </>
  );
}
```

---

### Visual Preview

**Before (drag handle icon, pin on right):**
```
┌────────────────┐
│ [⠿][3dots]    │  ← Drag handle next to three-dots
│                │
│    POSTER      │
│                │
│       [📌][×] │  ← Pin/Remove on right
│           [🔖]│  ← Watchlist bottom-right
└────────────────┘
```

**After (whole card draggable, pin on left):**
```
┌────────────────┐
│ [3dots] [⭐]   │  ← Three-dots left, rating right
│                │
│    POSTER      │  ← ENTIRE POSTER IS DRAGGABLE
│ cursor: grab   │
│                │
│ [📌][×]   [🔖]│  ← Pin/Remove left, Watchlist right
└────────────────┘
```

---

### Technical Notes

1. **`touch-none` class**: Prevents default touch scrolling when dragging on mobile
2. **`cursor-grab/grabbing`**: Visual feedback for draggable state
3. **`isDragging` styles**: Scale, ring, and shadow make the picked-up card visually distinct
4. **Listeners on wrapper**: The key fix - dnd-kit requires listeners on the element with `setNodeRef`
5. **No navigation conflict**: The card still navigates to details page on click because dnd-kit uses a distance threshold (8px) before activating drag
