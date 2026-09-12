import React, { useState } from 'react';
import {
    api,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Label,
    Page,
    PageBlock,
    PageLayout,
    PageTitle,
    useNavigate,
} from '@vendure/dashboard';
import { useMutation } from '@tanstack/react-query';
import { PENDING_PAYOUT_REPORT, CREATE_PAYOUT_BATCH } from '../graphql-queries';

const fmt = (v: number) => `$${(v / 100).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;

export function PayoutNewPage() {
    const navigate = useNavigate();
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [report, setReport] = useState<any>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const defaultPeriod = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 15);
        setPeriodStart(start.toISOString().slice(0, 10));
        setPeriodEnd(end.toISOString().slice(0, 10));
    };

    const handlePreview = async () => {
        if (!periodStart || !periodEnd) return;
        setPreviewLoading(true);
        setPreviewError(null);
        setReport(null);
        try {
            const data = await api.query<{ pendingPayoutReport: any }>(PENDING_PAYOUT_REPORT, {
                periodStart: new Date(periodStart).toISOString(),
                periodEnd: new Date(periodEnd).toISOString(),
            });
            setReport(data.pendingPayoutReport);
        } catch (err: any) {
            setPreviewError(err.message);
        } finally {
            setPreviewLoading(false);
        }
    };

    const createMutation = useMutation({
        mutationFn: () =>
            api.mutate(CREATE_PAYOUT_BATCH, {
                input: {
                    periodStart: new Date(periodStart).toISOString(),
                    periodEnd: new Date(periodEnd).toISOString(),
                },
            }),
        onSuccess: (data: any) => {
            const ref = data?.createPayoutBatch?.reference || '';
            navigate({ to: '/payouts' });
        },
        onError: (err: any) => {
            setPreviewError(err.message);
        },
    });

    return (
        <Page pageId="payout-new">
            <PageTitle>
                <span>Nueva liquidación</span>
            </PageTitle>
            <PageLayout>
                <PageBlock column="main">
                    <Card>
                        <CardHeader>
                            <CardTitle>Seleccionar período</CardTitle>
                            <Button variant="ghost" size="sm" onClick={defaultPeriod}>
                                Últimos 15 días
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4 items-end">
                                <div className="space-y-1">
                                    <Label>Fecha inicio</Label>
                                    <input
                                        type="date"
                                        value={periodStart}
                                        onChange={e => setPeriodStart(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Fecha fin</Label>
                                    <input
                                        type="date"
                                        value={periodEnd}
                                        onChange={e => setPeriodEnd(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                <Button
                                    variant="default"
                                    onClick={handlePreview}
                                    disabled={previewLoading || !periodStart || !periodEnd}
                                >
                                    {previewLoading ? 'Calculando...' : 'Previsualizar'}
                                </Button>
                            </div>

                            {previewError && <div className="text-red-500 text-sm">{previewError}</div>}
                        </CardContent>
                    </Card>

                    {report && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Resumen del período</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                        <p className="text-sm text-muted-foreground">Vendedores</p>
                                        <p className="text-2xl font-bold">{report.totalSellers}</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                        <p className="text-sm text-muted-foreground">Monto neto total</p>
                                        <p className="text-2xl font-bold">{fmt(report.totalAmount)}</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                        <p className="text-sm text-muted-foreground">Comisión total</p>
                                        <p className="text-2xl font-bold">{fmt(report.totalPlatformFee)}</p>
                                    </div>
                                </div>

                                {report.sellersWithoutBankInfo?.length > 0 && (
                                    <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                            ⚠️ {report.sellersWithoutBankInfo.length} vendedor(es) sin datos bancarios:
                                        </p>
                                        <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 list-disc list-inside">
                                            {report.sellersWithoutBankInfo.map((name: string, i: number) => (
                                                <li key={i}>{name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <Button
                                        variant="default"
                                        onClick={() => createMutation.mutate()}
                                        disabled={createMutation.isPending || report.totalSellers === 0}
                                    >
                                        {createMutation.isPending ? 'Creando...' : 'Crear liquidación'}
                                    </Button>
                                    <Button variant="outline" onClick={() => setReport(null)}>
                                        Cancelar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
