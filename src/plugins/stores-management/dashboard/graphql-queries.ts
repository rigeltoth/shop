export const STORES_LIST_QUERY = `
  query StoresList($options: StoreListWithTotalsListOptions) {
    storesList(options: $options) {
      items {
        id
        storeName
        channelCode
        createdAt
        updatedAt
        deletedAt
        isNew
        isDeleted
        adminId
        adminName
        adminEmail
        adminLastLogin
        productCount
        storeDescription
        storePickupAddress
        storePickupNeighborhood
      }
      totalItems
      totalActiveStores
    }
  }
`;

export const STORES_QUERY = `
  query Stores($first: Int!, $after: String, $filter: StoreFilterInput) {
    stores(first: $first, after: $after, filter: $filter) {
      edges {
        cursor
        node {
          id
          storeName
          channelCode
          createdAt
          updatedAt
          deletedAt
          isNew
          isDeleted
          adminName
          adminEmail
          adminLastLogin
          productCount
          storeDescription
          storeBannerUrl
          storePickupAddress
          storePickupNeighborhood
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalItems
      totalActiveStores
    }
  }
`;

export const STORE_QUERY = `
  query Store($id: ID!) {
    store(id: $id) {
      id
      storeName
      channelCode
      channelToken
      createdAt
      updatedAt
      deletedAt
      isNew
      isDeleted
      adminId
      adminName
      adminEmail
      adminLastLogin
      productCount
      storeDescription
      storeBannerUrl
      storePickupAddress
      storePickupNeighborhood
    }
  }
`;

export interface StoreNode {
  id: string;
  storeName: string;
  channelCode: string;
  channelToken?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  isNew: boolean;
  isDeleted: boolean;
  adminId?: number | null;
  adminName?: string | null;
  adminEmail?: string | null;
  adminLastLogin?: string | null;
  productCount?: number | null;
  storeDescription?: string | null;
  storeBannerUrl?: string | null;
  storePickupAddress?: string | null;
  storePickupNeighborhood?: string | null;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface StoreEdge {
  cursor: string;
  node: StoreNode;
}

export interface StoreConnection {
  edges: StoreEdge[];
  pageInfo: PageInfo;
  totalItems: number;
  totalActiveStores: number;
}

export interface StoreList {
  items: StoreNode[];
  totalItems: number;
}

export async function gql<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const res = await fetch('/admin-api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STORE_ANALYTICS_QUERY = `
  query StoreAnalytics($filter: AnalyticsFilterInput!) {
    storeAnalytics(filter: $filter) {
      date totalOrders totalRevenue totalUnits avgOrderValue newCustomers productsSold
    }
  }
`;

export const STORE_ANALYTICS_SUMMARY_QUERY = `
  query StoreAnalyticsSummary($filter: AnalyticsFilterInput!) {
    storeAnalyticsSummary(filter: $filter) {
      totalRevenue { current previous changePercent label type }
      totalOrders { current previous changePercent label type }
      totalActiveStores { current previous changePercent label type }
      avgOrderValue { current previous changePercent label type }
      totalUnits { current previous changePercent label type }
      newCustomers { current previous changePercent label type }
    }
  }
`;

export const STORE_RANKING_QUERY = `
  query StoreRanking($channelId: ID, $by: String, $limit: Int) {
    storeRanking(channelId: $channelId, by: $by, limit: $limit) {
      storeId storeName channelCode totalRevenue totalOrders totalUnits
    }
  }
`;

export const STORE_ANALYTICS_STORE_LIST_QUERY = `
  query StoreAnalyticsStoreList {
    storeAnalyticsStoreList {
      id storeName channelCode
    }
  }
`;

export interface AnalyticsDataPoint {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalUnits: number;
  avgOrderValue: number;
  newCustomers: number;
  productsSold: number;
}

export interface AnalyticsSummaryMetric {
  current: number;
  previous: number;
  changePercent: number;
  label: string;
  type: string;
}

export interface StoreAnalyticsSummary {
  totalRevenue: AnalyticsSummaryMetric;
  totalOrders: AnalyticsSummaryMetric;
  totalActiveStores: AnalyticsSummaryMetric;
  avgOrderValue: AnalyticsSummaryMetric;
  totalUnits: AnalyticsSummaryMetric;
  newCustomers: AnalyticsSummaryMetric;
}

export interface StoreRankingEntry {
  storeId: string;
  storeName: string;
  channelCode: string;
  totalRevenue: number;
  totalOrders: number;
  totalUnits: number;
}

export const INVESTOR_METRICS_QUERY = `
  query InvestorMetrics {
    investorMetrics {
      gmvTotal { current label type }
      monthlyGrowth { current label type }
      commissions { current label type }
      runRateAnnual { current label type }
      avgTicketMonthly { current label type }
      avgRevenuePerStore { current label type }
      newStoresPerMonth { current label type }
      uniqueCustomers { current label type }
    }
  }
`;

export interface InvestorMetric {
  current: number;
  label: string;
  type: string;
}

export interface InvestorMetricsResponse {
  gmvTotal: InvestorMetric;
  monthlyGrowth: InvestorMetric;
  commissions: InvestorMetric;
  runRateAnnual: InvestorMetric;
  avgTicketMonthly: InvestorMetric;
  avgRevenuePerStore: InvestorMetric;
  newStoresPerMonth: InvestorMetric;
  uniqueCustomers: InvestorMetric;
}

export const BACKFILL_MUTATION = `
  mutation BackfillStoreAnalytics {
    backfillStoreAnalytics
  }
`;

export const BIFROST_USAGES_QUERY = `
  query BifrostKeyUsages {
    bifrostKeyUsages {
      key {
        id
        value
        administratorId
        planName
        kind
        isActive
        expiresAt
      }
      usage {
        usagePercent
        budgetMax
        budgetUsed
        budgetResetAt
        tokenUsed
        tokenLimit
        requestUsed
        requestLimit
        isActive
      }
    }
  }
`;

export interface BifrostUsage {
  usagePercent: number;
  budgetMax: number;
  budgetUsed: number;
  budgetResetAt?: string | null;
  tokenUsed: number;
  tokenLimit: number;
  requestUsed: number;
  requestLimit: number;
  isActive: boolean;
}

export interface BifrostKeyUsage {
  key: {
    id: string;
    value: string;
    administratorId?: number | null;
    planName: string;
    kind: string;
    isActive: boolean;
    expiresAt?: string | null;
  };
  usage: BifrostUsage;
}
