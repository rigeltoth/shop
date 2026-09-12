import gql from 'graphql-tag';

const sharedStoreTypes = gql`
    type Store implements Node {
        id: ID!
        storeName: String!
        channelCode: String!
        channelToken: String
        createdAt: DateTime!
        updatedAt: DateTime!
        isNew: Boolean!
        isDeleted: Boolean!
        deletedAt: DateTime
        adminId: Int
        adminName: String
        adminEmail: String
        adminLastLogin: DateTime
        productCount: Int
        storeDescription: String
        storeBannerUrl: String
        storePickupAddress: String
        storePickupNeighborhood: String
    }

    type StoreList implements PaginatedList {
        items: [Store!]!
        totalItems: Int!
    }

    type StoreSearchResult implements Node {
        id: ID!
        storeName: String!
        channelCode: String!
    }

    type StoreSearchResultList implements PaginatedList {
        items: [StoreSearchResult!]!
        totalItems: Int!
    }

    input StoreSearchInput {
        query: String!
        take: Int
        skip: Int
    }

    type AnalyticsDataPoint {
        date: String!
        totalOrders: Int!
        totalRevenue: Int!
        totalUnits: Int!
        avgOrderValue: Float!
        newCustomers: Int!
        productsSold: Int!
    }

    type AnalyticsSummaryMetric {
        current: Float!
        previous: Float!
        changePercent: Float!
        label: String!
        type: String!
    }

    type StoreAnalyticsSummary {
        totalRevenue: AnalyticsSummaryMetric!
        totalOrders: AnalyticsSummaryMetric!
        totalActiveStores: AnalyticsSummaryMetric!
        avgOrderValue: AnalyticsSummaryMetric!
        totalUnits: AnalyticsSummaryMetric!
        newCustomers: AnalyticsSummaryMetric!
    }

    type StoreRankingEntry {
        storeId: ID!
        storeName: String!
        channelCode: String!
        totalRevenue: Int!
        totalOrders: Int!
        totalUnits: Int!
    }

    type InvestorMetric {
        current: Float!
        label: String!
        type: String!
    }

    type InvestorMetrics {
        gmvTotal: InvestorMetric!
        monthlyGrowth: InvestorMetric!
        commissions: InvestorMetric!
        runRateAnnual: InvestorMetric!
        avgTicketMonthly: InvestorMetric!
        avgRevenuePerStore: InvestorMetric!
        newStoresPerMonth: InvestorMetric!
        uniqueCustomers: InvestorMetric!
    }

    input AnalyticsFilterInput {
        channelId: ID
        days: Int!
    }
`;

export const adminApiExtensions = gql`
    ${sharedStoreTypes}

    type StoreEdge {
        cursor: String!
        node: Store!
    }

    type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String
        endCursor: String
    }

    type StoreConnection {
        edges: [StoreEdge!]!
        pageInfo: PageInfo!
        totalItems: Int!
        totalActiveStores: Int!
    }

    input StoreFilterInput {
        search: String
        isNew: Boolean
        isDeleted: Boolean
    }

    input StoreSortParameter {
        storeName: SortOrder
        channelCode: SortOrder
        createdAt: SortOrder
    }

    input StoreListWithTotalsListOptions {
        skip: Int
        take: Int
        sort: StoreSortParameter
        filter: StoreFilterInput
    }

    type StoreListWithTotals implements PaginatedList {
        items: [Store!]!
        totalItems: Int!
        totalActiveStores: Int!
    }

    extend type Query {
        stores(first: Int! = 20, after: String, filter: StoreFilterInput): StoreConnection!
        store(id: ID!): Store
        storesList(options: StoreListWithTotalsListOptions): StoreListWithTotals!
        searchStores(input: StoreSearchInput!): StoreSearchResultList!
        storeAnalytics(filter: AnalyticsFilterInput!): [AnalyticsDataPoint!]!
        storeAnalyticsSummary(filter: AnalyticsFilterInput!): StoreAnalyticsSummary!
        storeRanking(channelId: ID, by: String, limit: Int): [StoreRankingEntry!]!
        storeAnalyticsStoreList: [StoreSearchResult!]!
        investorMetrics: InvestorMetrics!
    }

    extend type Mutation {
        backfillStoreAnalytics: Boolean!
    }
`;

export const shopApiExtensions = gql`
    ${sharedStoreTypes}

    extend type Query {
        searchStores(input: StoreSearchInput!): StoreSearchResultList!
    }
`;
