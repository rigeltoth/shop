export const GET_PAYOUT_BATCHES = `
    query GetPayoutBatches {
        payoutBatches {
            id reference periodStart periodEnd totalAmount totalPlatformFee
            transactionCount successCount skippedCount status csvFileName paidAt createdAt
        }
    }
`;

export const GET_PAYOUT_BATCH = `
    query GetPayoutBatch($id: ID!) {
        payoutBatch(id: $id) {
            id reference periodStart periodEnd totalAmount totalPlatformFee
            transactionCount successCount skippedCount status csvFileName paidAt createdAt
            transactions {
                id sellerId sellerName amount platformFee orderCodes
                legalIdType legalId accountType accountNumber brebKey status notes createdAt
            }
        }
    }
`;

export const GET_PAYOUT_FINANCIAL = `
    query GetPayoutFinancial($id: ID!) {
        payoutBatchFinancial(id: $id) {
            sellerName docTypeCode docTypeLabel docNumber bankCode bankName
            accountType accountTypeCode transactionType accountNumber phone email fecha
            ventasBrutas comisionPlataforma comisionWompi comisionEcommer neto
            orderCodes subOrderCodes wompiRefs pabRef oficina estado
        }
    }
`;

export const PENDING_PAYOUT_REPORT = `
    query PendingPayoutReport($periodStart: DateTime!, $periodEnd: DateTime!) {
        pendingPayoutReport(periodStart: $periodStart, periodEnd: $periodEnd) {
            totalSellers totalAmount totalPlatformFee sellersWithoutBankInfo
        }
    }
`;

export const GET_MY_PAYOUT_INFO = `
    query GetMyPayoutInfo {
        myPayoutInfo {
            legalIdType legalId accountType accountNumber bankCode brebKey brebKeyType brebVerified
        }
    }
`;

export const GET_MY_PAYOUT_BATCHES = `
    query GetMyPayoutBatches {
        myPayoutBatches {
            id reference periodStart periodEnd totalAmount status paidAt createdAt
        }
    }
`;

export const CREATE_PAYOUT_BATCH = `
    mutation CreatePayoutBatch($input: CreatePayoutBatchInput!) {
        createPayoutBatch(input: $input) {
            id reference status totalAmount totalPlatformFee
            transactionCount successCount skippedCount csvFileName createdAt
        }
    }
`;

export const PAYOUT_BATCH_COUNTS = `
    query PayoutBatchCounts {
        payoutBatchCounts {
            total pending paid cancelled
        }
    }
`;

export const CONFIRM_PAYOUT_BATCH = `
    mutation ConfirmPayoutBatch($id: ID!) {
        confirmPayoutBatch(id: $id) { id status paidAt }
    }
`;

export const CANCEL_PAYOUT_BATCH = `
    mutation CancelPayoutBatch($id: ID!) {
        cancelPayoutBatch(id: $id) { id status }
    }
`;

export const DOWNLOAD_PAYOUT_CSV = `
    mutation DownloadPayoutCsv($id: ID!, $format: String) {
        downloadPayoutCsv(id: $id, format: $format)
    }
`;

export const DOWNLOAD_PAYOUT_PAB = `
    mutation DownloadPayoutPab($id: ID!, $format: String) {
        downloadPayoutCsv(id: $id, format: $format)
    }
`;

export const SAVE_MY_PAYOUT_INFO = `
    mutation SaveMyPayoutInfo($input: SavePayoutInfoInput!) {
        saveMyPayoutInfo(input: $input) {
            legalIdType legalId accountType accountNumber bankCode brebKey brebKeyType brebVerified
        }
    }
`;

export const SELLER_PAYOUT_SUMMARIES = `
    query SellerPayoutSummaries {
        sellerPayoutSummaries {
            sellerId sellerName channelToken totalPaid totalPending totalFee
            batchCount transactionCount lastPaidAt bankCode bankName accountType accountNumber
        }
    }
`;

export const SELLER_PAYOUT_TRANSACTIONS = `
    query SellerPayoutTransactions($sellerId: ID!) {
        sellerPayoutTransactions(sellerId: $sellerId) {
            id sellerName amount platformFee orderCodes status notes createdAt
            batch { id reference periodStart periodEnd }
        }
    }
`;

export const DOWNLOAD_SELLER_PAYOUT_REPORT = `
    mutation DownloadSellerPayoutReport($sellerId: ID) {
        downloadSellerPayoutReport(sellerId: $sellerId)
    }
`;

export const DOWNLOAD_PAYOUT_FINANCIAL = `
    mutation DownloadPayoutFinancial($id: ID!, $format: String) {
        downloadPayoutCsv(id: $id, format: $format)
    }
`;
