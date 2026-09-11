export type PaginatedDocument<T> = {
  id: string;
  data: T;
};

export async function collectPaginatedRows<T>(
  loadPage: (cursor: string | null, limit: number) => Promise<ReadonlyArray<PaginatedDocument<T>>>,
  pageLimit = 450
): Promise<PaginatedDocument<T>[]> {
  if (!Number.isInteger(pageLimit) || pageLimit < 1) {
    throw new Error("Pagination page limit must be a positive integer.");
  }

  const rows: PaginatedDocument<T>[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  while (true) {
    const loadedPage: ReadonlyArray<PaginatedDocument<T>> = await loadPage(cursor, pageLimit);
    const page: PaginatedDocument<T>[] = [...loadedPage];
    if (page.length > pageLimit) {
      throw new Error(`Pagination loader returned ${page.length} rows for limit ${pageLimit}.`);
    }

    rows.push(...page);
    if (page.length < pageLimit) return rows;

    const nextCursor: string = page.at(-1)?.id ?? "";
    if (!nextCursor || nextCursor === cursor || seenCursors.has(nextCursor)) {
      throw new Error("Pagination cursor did not advance.");
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer.");
  }

  const output = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return output;
}

export async function collectNestedRows<Parent, Child, Result>(args: {
  parents: readonly Parent[];
  concurrency: number;
  loadChildren: (parent: Parent) => Promise<ReadonlyArray<Child>>;
  mapChild: (parent: Parent, child: Child) => Result;
}): Promise<Result[]> {
  const groups = await mapWithConcurrency(args.parents, args.concurrency, async (parent) => {
    const children = await args.loadChildren(parent);
    return children.map((child) => args.mapChild(parent, child));
  });

  return groups.flat();
}
