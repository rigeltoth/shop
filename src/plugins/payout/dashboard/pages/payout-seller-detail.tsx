import React from 'react';
import {
    api,
    Badge,
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
    SELLER_PAYOUT_TRANSACTIONS,
    DOWNLOAD_SELLER_PAYOUT_REPORT,
} from '../graphql-queries';

const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
        pending: 'warning', paid: 'success', skipped: 'destructive',
    };
    const labels: Record<string, string> = {
        pending: 'Pendiente', paid: 'Pagado', skipped: 'Saltado',
    };
    return <Badge variant={(variants[status] || 'default') as any}>{labels[status] || status}</Badge>;
};

const fmt = (v: number) => `$${(v / 100).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fd = (d: string) => new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

export function PayoutSellerDetailPage({ route }: any) {
    const sellerId = route?.match?.params?.sellerId || route?.params?.sellerId || window.location.pathname.split('/').pop();
    const navigate = useNavigate();

    const { data, isLoading, error } = useQuery({
        queryKey: ['sellerPayoutTransactions', sellerId],
        queryFn: () => api.query<{ sellerPayoutTransactions: any[] }>(SELLER_PAYOUT_TRANSACTIONS, { sellerId }),
        enabled: !!sellerId,
    });

    const exportMutation = useMutation({
        mutationFn: () => api.mutate(DOWNLOAD_SELLER_PAYOUT_REPORT, { sellerId }),
        onSuccess: (result: any) => {
            const base64 = result?.downloadSellerPayoutReport;
            if (base64) {
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `historial-vendedor-${sellerId}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
            }
        },
    });

    const transactions = data?.sellerPayoutTransactions ?? [];
    const sellerName = transactions[0]?.sellerName || '';

    return (
        <Page pageId="payout-seller-detail">
            <PageTitle>
                <span>{sellerName || `Vendedor #${sellerId}`}</span>
            </PageTitle>
            <PageLayout>
                <PageBlock column="main">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transacciones ({transactions.length})</CardTitle>
                            <Button variant="default" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
                                {exportMutation.isPending ? 'Generando...' : 'Exportar Excel'}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isLoading && <div className="text-center py-8 text-muted-foreground">Cargando...</div>}
                            {error && <div className="text-red-500 py-4">{(error as Error).message}</div>}
                            {!isLoading && transactions.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">Sin transacciones para este vendedor.</div>
                            )}
                            {!isLoading && transactions.length > 0 && (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Lote</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Monto neto</TableHead>
                                            <TableHead>Comisión</TableHead>
                                            <TableHead>Órdenes</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.map((t: any) => (
                                            <TableRow key={t.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate({ to: `/payouts/${t.batch?.id}` })}>
                                                <TableCell className="font-medium text-primary hover:underline">
                                                    {t.batch?.reference || `Lote ${t.batch?.id || ''}`}
                                                </TableCell>
                                                <TableCell>{fd(t.createdAt)}</TableCell>
                                                <TableCell>{fmt(t.amount)}</TableCell>
                                                <TableCell>{fmt(t.platformFee)}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{t.orderCodes}</TableCell>
                                                <TableCell>{statusBadge(t.status)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            <div className="mt-4">
                                <Button variant="outline" onClick={() => navigate({ to: '/payout-sellers' })}>Volver</Button>
                            </div>
                        </CardContent>
                    </Card>
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
