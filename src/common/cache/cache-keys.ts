export const CACHE_TTL_SECONDS = {
  dashboardSummary: 120,
  setupWarnings: 60,
  servicesCatalog: 86_400,
  inventoryCatalog: 86_400,
  banksCatalog: 86_400,
  paymentSummary: 120,
  applicationStats: 300,
  helpCenter: 3_600,
  geoSearch: 86_400,
  geoNearby: 3_600,
} as const;

export const cacheKeys = {
  dashboardSummary: (businessId: number) =>
    `business:${businessId}:dashboard:summary`,
  setupWarnings: (businessId: number) =>
    `business:${businessId}:setup-warnings`,
  paymentSummary: (businessId: number, startDate = 'all', endDate = 'all') =>
    `business:${businessId}:payments:summary:${startDate}:${endDate}`,
  applicationStats: (
    businessId: number,
    period: string,
    startDate = 'auto',
    endDate = 'auto',
  ) =>
    `business:${businessId}:reports:application-stats:${period}:${startDate}:${endDate}`,
  servicesCatalog: () => 'catalog:services:v1',
  inventoryCatalog: () => 'catalog:inventory:v1',
  banksCatalog: () => 'catalog:banks:v1',
  helpCenter: (locale: string) => `support:help-center:${locale}`,
  geoSearch: (query: string, limit: number) =>
    `geo:search:${query.toLowerCase().trim()}:${limit}`,
  geoNearby: (lat: number, lng: number, radiusMeters: number) =>
    `geo:nearby:${lat}:${lng}:${radiusMeters}`,
} as const;
