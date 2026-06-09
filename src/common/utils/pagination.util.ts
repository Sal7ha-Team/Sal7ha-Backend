export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export function pagination(query: PaginationQuery) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 10)));
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}
