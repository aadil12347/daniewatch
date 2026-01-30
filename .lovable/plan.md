
## Fix: Update Data Tool Only Fetching 1000 Entries

### Problem
The "Update Data" button in the Tools tab only exports 1000 entries to the manifest file. This is because **Supabase has a default row limit of 1000** for queries, and the current code doesn't handle pagination.

### Solution
Implement paginated fetching that retrieves entries in batches of 1000 until all entries are fetched, then combines them for the manifest.

---

## Technical Implementation

### File: `src/components/admin/ManifestUpdateTool.tsx`

**Changes:**

1. **Replace the single query with a paginated fetch loop**
   - Fetch entries in batches of 1000 using `.range(from, to)`
   - Continue fetching until fewer than 1000 entries are returned (indicating end of data)
   - Combine all batches into a single array

2. **Add progress indicator during fetch**
   - Show how many entries have been fetched so far
   - Update the button text to show progress (e.g., "Fetching 2000...")

**Code approach:**
```text
Current (line 60-64):
  const { data: entries, error } = await supabase
    .from("entries")
    .select("...")
  // Only gets first 1000 rows

New approach:
  const BATCH_SIZE = 1000;
  let allEntries = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("entries")
      .select("...")
      .range(from, from + BATCH_SIZE - 1);
    
    if (error) throw error;
    
    allEntries.push(...data);
    hasMore = data.length === BATCH_SIZE;
    from += BATCH_SIZE;
  }
```

3. **Add a fetching state for UI feedback**
   - New state: `fetchedCount` to show progress
   - Update button text during fetch phase vs. processing phase

---

## Expected Result

- All entries (1000+) will be included in the manifest
- Progress feedback shows how many entries have been fetched
- Toast message confirms the total count exported

---

## Files Changed
| File | Change |
|------|--------|
| `src/components/admin/ManifestUpdateTool.tsx` | Add paginated fetch loop with `.range()` to fetch all entries beyond 1000 limit |
