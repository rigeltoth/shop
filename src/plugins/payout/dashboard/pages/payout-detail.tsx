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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    GET_PAYOUT_BATCH,
    CONFIRM_PAYOUT_BATCH,
    DOWNLOAD_PAYOUT_CSV,
    DOWNLOAD_PAYOUT_PAB,
    DOWNLOAD_PAYOUT_FINANCIAL,
    GET_PAYOUT_FINANCIAL,
} from '../graphql-queries';

const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
        pending: 'warning', csv_downloaded: 'default',
        paid: 'success', cancelled: 'destructive', skipped: 'destructive',
    };
    const labels: Record<string, string> = {
        pending: 'Pendiente', csv_downloaded: 'CSV Descargado',
        paid: 'Pagado', cancelled: 'Cancelado', skipped: 'Saltado',
    };
    return <Badge variant={(variants[status] || 'default') as any}>{labels[status] || status}</Badge>;
};

const fmt = (v: number) => `$${(v / 100).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fd = (d: string) => new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

export function PayoutDetailPage({ route }: any) {
    const batchId = route?.match?.params?.id || route?.params?.id || window.location.pathname.split('/').pop();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['payoutBatch', batchId],
        queryFn: () => api.query<{ payoutBatch: any }>(GET_PAYOUT_BATCH, { id: batchId }),
        enabled: !!batchId,
    });

    const { data: financialData, isLoading: financialLoading } = useQuery({
        queryKey: ['payoutFinancial', batchId],
        queryFn: () => api.query<{ payoutBatchFinancial: any[] }>(GET_PAYOUT_FINANCIAL, { id: batchId }),
        enabled: !!batchId,
    });

    const confirmMutation = useMutation({
        mutationFn: () => api.mutate(CONFIRM_PAYOUT_BATCH, { id: batchId }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payoutBatch', batchId] }),
    });

    const csvMutation = useMutation({
        mutationFn: () => api.mutate(DOWNLOAD_PAYOUT_CSV, { id: batchId, format: 'csv' }),
        onSuccess: (result: any) => {
            const csv = result?.downloadPayoutCsv;
            if (csv) {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${batch?.reference || `payout-${batchId}`}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        },
    });

    const pabMutation = useMutation({
        mutationFn: () => api.mutate(DOWNLOAD_PAYOUT_PAB, { id: batchId, format: 'pab' }),
        onSuccess: (result: any) => {
            const txt = result?.downloadPayoutCsv;
            if (txt) {
                const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${batch?.reference || `payout-${batchId}`}.txt`;
                a.click();
                URL.revokeObjectURL(url);
            }
        },
    });

    const financialMutation = useMutation({
        mutationFn: () => api.mutate(DOWNLOAD_PAYOUT_FINANCIAL, { id: batchId, format: 'financial' }),
        onSuccess: (result: any) => {
            const base64 = result?.downloadPayoutCsv;
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
                a.download = `${batch?.reference || `payout-${batchId}`}-reporte-financiero.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
            }
        },
    });

    const batch = (data as any)?.payoutBatch as any;

    if (isLoading) {
        return <Page pageId="payout-detail"><PageTitle><span>Cargando...</span></PageTitle></Page>;
    }
    if (error || !batch) {
        return (
            <Page pageId="payout-detail">
                <PageTitle><span>Error</span></PageTitle>
                <PageLayout>
                    <PageBlock column="main">
                        <Card><CardContent>
                            <p className="text-red-500">{(error as Error)?.message || 'Lote no encontrado'}</p>
                            <Button variant="outline" onClick={() => navigate('/payouts')}>Volver</Button>
                        </CardContent></Card>
                    </PageBlock>
                </PageLayout>
            </Page>
        );
    }

    return (
        <Page pageId="payout-detail">
            <PageTitle>
                <span>{batch.reference}</span>
                <div className="flex items-center gap-2">{statusBadge(batch.status)}</div>
            </PageTitle>
            <PageLayout>
                <PageBlock column="main">
                    <Card>
                        <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Período</p>
                                    <p className="font-medium">{fd(batch.periodStart)} — {fd(batch.periodEnd)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Monto neto</p>
                                    <p className="font-medium">{fmt(batch.totalAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Comisión</p>
                                    <p className="font-medium">{fmt(batch.totalPlatformFee)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Transacciones</p>
                                    <p className="font-medium">{batch.successCount} exitosas / {batch.skippedCount} saltadas</p>
                                </div>
                                {batch.paidAt && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Pagado el</p>
                                        <p className="font-medium">{fd(batch.paidAt)}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 mt-6">
                                {(batch.status === 'pending' || batch.status === 'csv_downloaded') && (
                                    <>
                                        <Button variant="default" onClick={() => csvMutation.mutate()} disabled={csvMutation.isPending}>
                                            {csvMutation.isPending ? 'Generando...' : 'CSV LibreFormato'}
                                        </Button>
                                        <Button variant="default" onClick={() => pabMutation.mutate()} disabled={pabMutation.isPending}>
                                            {pabMutation.isPending ? 'Generando...' : 'TXT PAB Bancolombia'}
                                        </Button>
                                        <Button variant="outline" onClick={() => financialMutation.mutate()} disabled={financialMutation.isPending}>
                                            {financialMutation.isPending ? 'Generando...' : 'Reporte financiero (XLSX)'}
                                        </Button>
                                        <Button variant="default" onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
                                            {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar pago'}
                                        </Button>
                                    </>
                                )}
                            <Button variant="outline" onClick={() => navigate({ to: '/payouts' })}>Volver</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Transacciones ({batch.transactions?.length || 0})</CardTitle></CardHeader>
                        <CardContent>
                            {!batch.transactions?.length ? (
                                <p className="text-muted-foreground">Sin transacciones</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Vendedor</TableHead>
                                            <TableHead>Monto neto</TableHead>
                                            <TableHead>Comisión</TableHead>
                                            <TableHead>Órdenes</TableHead>
                                            <TableHead>Cuenta / BRE-B</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {batch.transactions.map((t: any) => (
                                            <TableRow key={t.id}>
                                                <TableCell className="font-medium">{t.sellerName}</TableCell>
                                                <TableCell>{fmt(t.amount)}</TableCell>
                                                <TableCell>{fmt(t.platformFee)}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{t.orderCodes}</TableCell>
                                                <TableCell className="text-sm">
                                                    {t.brebKey
                                                        ? <span title={t.brebKeyType}>🔑 {t.brebKey}</span>
                                                        : <span>{t.accountType} ••••{(t.accountNumber || '').slice(-4)}</span>
                                                    }
                                                </TableCell>
                                                <TableCell>{statusBadge(t.status)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Desglose financiero ({financialData?.payoutBatchFinancial?.length || 0})</CardTitle></CardHeader>
                        <CardContent>
                            {financialLoading ? (
                                <p className="text-muted-foreground">Cargando desglose...</p>
                            ) : !financialData?.payoutBatchFinancial?.length ? (
                                <p className="text-muted-foreground">Sin datos financieros</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Vendedor</TableHead>
                                            <TableHead>Ventas brutas</TableHead>
                                            <TableHead>Comisión plataforma</TableHead>
                                            <TableHead>Comisión Wompi</TableHead>
                                            <TableHead>Comisión Ecommer</TableHead>
                                            <TableHead>Neto</TableHead>
                                            <TableHead>Órdenes</TableHead>
                                            <TableHead>Sub-órdenes</TableHead>
                                            <TableHead>Ref. Wompi</TableHead>
                                            <TableHead>Celular</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {financialData.payoutBatchFinancial.map((r: any, i: number) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{r.sellerName}</TableCell>
                                                <TableCell>{fmt(r.ventasBrutas)}</TableCell>
                                                <TableCell>{fmt(r.comisionPlataforma)}</TableCell>
                                                <TableCell>{fmt(r.comisionWompi)}</TableCell>
                                                <TableCell>{fmt(r.comisionEcommer)}</TableCell>
                                                <TableCell className="font-medium">{fmt(r.neto)}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{r.orderCodes}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{r.subOrderCodes}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{r.wompiRefs}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{r.phone}</TableCell>
                                                <TableCell>{statusBadge(r.estado)}</TableCell>
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
