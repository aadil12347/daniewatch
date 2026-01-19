export const groupDbLinkedFirst = <T,>(
  items: T[],
  isDbLinked: (item: T) => boolean
): T[] => {
  const linked: T[] = [];
  const unlinked: T[] = [];

  for (const item of items) {
    (isDbLinked(item) ? linked : unlinked).push(item);
  }

  return [...linked, ...unlinked];
};
