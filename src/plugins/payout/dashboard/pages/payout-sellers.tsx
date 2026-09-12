import React from 'react';
import {
    api,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Page,
    PageBlock,
    PageLayout,
    PageTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    useNavigate,
} from '@vendure/dashboard';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
    SELLER_PAYOUT_SUMMARIES,
    DOWNLOAD_SELLER_PAYOUT_REPORT,
} from '../graphql-queries';

const fmt = (v: number) => `$${(v / 100).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fd = (d: string) => (d ? new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

function downloadXlsx(base64: string, filename: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function PayoutSellersPage() {
    const navigate = useNavigate();

    const { data, isLoading, error } = useQuery({
        queryKey: ['sellerPayoutSummaries'],
        queryFn: () => api.query<{ sellerPayoutSummaries: any[] }>(SELLER_PAYOUT_SUMMARIES),
    });

    const exportMutation = useMutation({
        mutationFn: () => api.mutate(DOWNLOAD_SELLER_PAYOUT_REPORT, {}),
        onSuccess: (result: any) => {
            const base64 = result?.downloadSellerPayoutReport;
            if (base64) {
                downloadXlsx(base64, 'historial-pagos-vendedores.xlsx');
            }
        },
    });

    const summaries = data?.sellerPayoutSummaries ?? [];

    return (
        <Page pageId="payout-sellers">
            <PageTitle>
                <span>Pagos por vendedor</span>
            </PageTitle>
            <PageLayout>
                <PageBlock column="main">
                    <Card>
                        <CardHeader>
                            <CardTitle>Historial de dinero por vendedor</CardTitle>
                            <Button variant="default" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
                                {exportMutation.isPending ? 'Generando...' : 'Exportar Excel'}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isLoading && <div className="text-center py-8 text-muted-foreground">Cargando...</div>}
                            {error && <div className="text-red-500 py-4">{(error as Error).message}</div>}
                            {!isLoading && summaries.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">No hay pagos registrados todavía.</div>
                            )}
                            {!isLoading && summaries.length > 0 && (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Vendedor</TableHead>
                                            <TableHead>Transferido</TableHead>
                                            <TableHead>Pendiente</TableHead>
                                            <TableHead>Comisionado</TableHead>
                                            <TableHead>Lotes</TableHead>
                                            <TableHead>Transacciones</TableHead>
                                            <TableHead>Último pago</TableHead>
                                            <TableHead>Cuenta / Banco</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {summaries.map((s: any) => (
                                            <TableRow key={s.sellerId} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate({ to: `/payout-sellers/${s.sellerId}` })}>
                                                <TableCell className="font-medium text-primary hover:underline">{s.sellerName}</TableCell>
                                                <TableCell>{fmt(s.totalPaid)}</TableCell>
                                                <TableCell>{fmt(s.totalPending)}</TableCell>
                                                <TableCell>{fmt(s.totalFee)}</TableCell>
                                                <TableCell>{s.batchCount}</TableCell>
                                                <TableCell>{s.transactionCount}</TableCell>
                                                <TableCell>{fd(s.lastPaidAt)}</TableCell>
                                                <TableCell className="text-sm">
                                                    {s.bankName || s.bankCode || '—'}
                                                    {s.accountType && <span className="ml-1 text-muted-foreground">• {s.accountType}</span>}
                                                    {s.accountNumber && <span className="ml-1 text-muted-foreground">••••{String(s.accountNumber).slice(-4)}</span>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
