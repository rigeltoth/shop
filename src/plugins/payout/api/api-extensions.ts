import gql from 'graphql-tag';

export const adminApiExtensions = gql`
    type PayoutBatch implements Node {
        id: ID!
        reference: String!
        periodStart: DateTime!
        periodEnd: DateTime!
        totalAmount: Int!
        totalPlatformFee: Int!
        transactionCount: Int!
        successCount: Int!
        skippedCount: Int!
        status: String!
        csvFileName: String
        paidAt: DateTime
        createdAt: DateTime!
        updatedAt: DateTime!
        transactions: [PayoutTransaction!]
    }

    type PayoutTransaction {
        id: ID!
        sellerId: Int!
        sellerName: String!
        channelToken: String!
        amount: Int!
        platformFee: Int!
        orderCodes: String!
        legalIdType: String
        legalId: String
        accountType: String
        accountNumber: String
        bankCode: String
        brebKey: String
        brebKeyType: String
        status: String!
        notes: String
        createdAt: DateTime!
        batch: PayoutBatch
    }

    type PayoutFinancialRow {
        sellerName: String!
        docTypeCode: String!
        docTypeLabel: String!
        docNumber: String!
        bankCode: String!
        bankName: String!
        accountType: String!
        accountTypeCode: String!
        transactionType: String!
        accountNumber: String!
        phone: String!
        email: String!
        fecha: String!
        ventasBrutas: Int!
        comisionPlataforma: Int!
        comisionWompi: Int!
        comisionEcommer: Int!
        neto: Int!
        orderCodes: String!
        subOrderCodes: String!
        wompiRefs: String!
        pabRef: String!
        oficina: String!
        estado: String!
    }

    type SellerPayoutSummary {
        sellerId: Int!
        sellerName: String!
        channelToken: String!
        totalPaid: Int!
        totalPending: Int!
        totalFee: Int!
        batchCount: Int!
        transactionCount: Int!
        lastPaidAt: DateTime
        bankCode: String
        bankName: String
        accountType: String
        accountNumber: String
    }

    type PendingPayoutReport {
        totalSellers: Int!
        totalAmount: Int!
        totalPlatformFee: Int!
        sellersWithoutBankInfo: [String!]!
    }

    input PayoutBatchListSortParameter {
        reference: SortOrder
        periodStart: SortOrder
        createdAt: SortOrder
    }

    input PayoutBatchListFilter {
        reference: StringOperators
        status: StringOperators
    }

    input PayoutBatchListOptions {
        skip: Int
        take: Int
        sort: PayoutBatchListSortParameter
        filter: PayoutBatchListFilter
    }

    type PayoutBatchList implements PaginatedList {
        items: [PayoutBatch!]!
        totalItems: Int!
    }

    type PayoutBatchCounts {
        total: Int!
        pending: Int!
        paid: Int!
        cancelled: Int!
    }

    input CreatePayoutBatchInput {
        periodStart: DateTime!
        periodEnd: DateTime!
    }

    input SavePayoutInfoInput {
        legalIdType: String
        legalId: String
        accountType: String
        accountNumber: String
        bankCode: String
        brebKey: String
        brebKeyType: String
    }

    type SellerPayoutInfo {
        legalIdType: String
        legalId: String
        accountType: String
        accountNumber: String
        bankCode: String
        brebKey: String
        brebKeyType: String
        brebVerified: Boolean!
    }

    extend type Query {
        payoutBatches: [PayoutBatch!]!
        payoutBatchesList(options: PayoutBatchListOptions): PayoutBatchList!
        payoutBatchCounts: PayoutBatchCounts!
        payoutBatch(id: ID!): PayoutBatch
        payoutBatchFinancial(id: ID!): [PayoutFinancialRow!]!
        pendingPayoutReport(periodStart: DateTime!, periodEnd: DateTime!): PendingPayoutReport!
        sellerPayoutSummaries: [SellerPayoutSummary!]!
        sellerPayoutTransactions(sellerId: ID!): [PayoutTransaction!]!
        myPayoutInfo: SellerPayoutInfo!
        myPayoutBatches: [PayoutBatch!]!
    }

    extend type Mutation {
        createPayoutBatch(input: CreatePayoutBatchInput!): PayoutBatch!
        confirmPayoutBatch(id: ID!): PayoutBatch!
        cancelPayoutBatch(id: ID!): PayoutBatch!
        downloadPayoutCsv(id: ID!, format: String): String!
        downloadSellerPayoutReport(sellerId: ID): String!
        saveMyPayoutInfo(input: SavePayoutInfoInput!): SellerPayoutInfo!
    }
`;
