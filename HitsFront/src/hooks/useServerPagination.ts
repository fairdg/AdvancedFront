import { useEffect, useMemo } from "react";
import { buildSearch, clamp } from "../shared/urlSearch";

type PaginationLike = {
  count: number;
  current: number;
} | null | undefined;

type SetSearchParams = (nextInit: URLSearchParams, navigateOpts?: { replace?: boolean }) => void;

type UseServerPaginationParams = {
  pagination: PaginationLike;
  page: number;
  searchParams: URLSearchParams;
  setSearchParams: SetSearchParams;
  windowRadius?: number;
};

export function useServerPagination({
  pagination,
  page,
  searchParams,
  setSearchParams,
  windowRadius = 2,
}: UseServerPaginationParams) {
  const totalPages = useMemo(() => {
    if (!pagination) return 1;
    const n = Number(pagination.count);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }, [pagination]);

  const serverPage = useMemo(() => {
    if (!pagination) return null;
    const current = pagination.current;
    if (current >= 1 && current <= totalPages) return current;
    if (current >= 0 && current < totalPages) return current + 1;
    return null;
  }, [pagination, totalPages]);

  useEffect(() => {
    if (!pagination || serverPage == null || serverPage === page) return;
    setSearchParams(buildSearch(searchParams, { page: String(serverPage) }), { replace: true });
  }, [page, pagination, searchParams, serverPage, setSearchParams]);

  const safePage = clamp(serverPage ?? page, 1, totalPages);
  const pageLinks = useMemo(() => {
    const start = Math.max(1, safePage - windowRadius);
    const end = Math.min(totalPages, safePage + windowRadius);
    const pages: number[] = [];
    for (let p = start; p <= end; p += 1) pages.push(p);
    return pages;
  }, [safePage, totalPages, windowRadius]);

  return { totalPages, serverPage, safePage, pageLinks };
}
