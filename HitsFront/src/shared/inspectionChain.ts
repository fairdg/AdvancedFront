export function rootFromIcd(code: string | undefined | null) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const match = normalized.match(/^[A-Z]/);
  return match ? match[0] : null;
}

type ChainNode = {
  id: string;
  previousId?: string | null;
  date?: string;
  hasChain?: boolean;
};

export function buildNextByPrevious<T extends ChainNode>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!item.previousId) continue;
    const list = map.get(item.previousId) ?? [];
    list.push(item);
    map.set(item.previousId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }
  return map;
}

export type RenderedChainItem<T extends ChainNode> = {
  item: T;
  level: number;
  canExpand: boolean;
};

export function hasChainContinuation<T extends Pick<ChainNode, "id" | "hasChain">>(
  nextByPrev: Map<string, T[]>,
  item: T
) {
  return Boolean(nextByPrev.get(item.id)?.length) || item.hasChain === true;
}

export function toggleExpandedChainItem(prev: Set<string>, itemId: string) {
  const next = new Set(prev);
  if (next.has(itemId)) next.delete(itemId);
  else next.add(itemId);
  return next;
}

export function buildRenderedChainItems<T extends ChainNode>(
  items: T[],
  grouped: boolean,
  expanded: Set<string>,
  maxDepth = 50
): RenderedChainItem<T>[] {
  if (!grouped) {
    return items.map((item) => ({ item, level: 0, canExpand: false }));
  }

  const nextByPrev = buildNextByPrevious(items);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const rootItems = items
    .filter((item) => !item.previousId || !itemsById.has(item.previousId))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const renderedItems: RenderedChainItem<T>[] = [];

  for (const rootItem of rootItems) {
    renderedItems.push({
      item: rootItem,
      level: 0,
      canExpand: hasChainContinuation(nextByPrev, rootItem),
    });

    let currentItem = rootItem;
    let level = 1;

    while (expanded.has(currentItem.id)) {
      const nextItem = nextByPrev.get(currentItem.id)?.[0];
      if (!nextItem) break;

      renderedItems.push({
        item: nextItem,
        level,
        canExpand: hasChainContinuation(nextByPrev, nextItem),
      });

      currentItem = nextItem;
      level += 1;
      if (level > maxDepth) break;
    }
  }

  return renderedItems;
}
