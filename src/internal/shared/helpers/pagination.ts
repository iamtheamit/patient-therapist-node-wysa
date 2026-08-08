export interface PaginationParams {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function parsePaginationParams(query: any): PaginationParams {
  const page = query.page ? parseInt(query.page as string, 10) : undefined;
  const limit = query.limit ? parseInt(query.limit as string, 10) : undefined;

  return {
    page,
    limit,
    skip: page && limit ? (page - 1) * limit : undefined,
    take: limit,
  };
}

export function formatPaginatedResult<T>(
  items: T[],
  total: number,
  page?: number,
  limit?: number
): T[] | PaginatedResult<T> {
  if (page === undefined && limit === undefined) {
    return items;
  }

  const activePage = page || 1;
  const activeLimit = limit || total || 10;
  
  return {
    items,
    pagination: {
      total,
      page: activePage,
      limit: activeLimit,
      totalPages: activeLimit > 0 ? Math.ceil(total / activeLimit) : 1,
    },
  };
}
