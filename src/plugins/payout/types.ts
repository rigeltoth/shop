export interface PluginInitOptions {
    platformFeePercent?: number;
    wompiFeePercent?: number;
    ecommerFeePercent?: number;
    companyNit: string;
    companyAccount: string;
    companyAccountType: 'AHORROS' | 'CORRIENTE';
}
