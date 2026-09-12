import { useState, useRef, useEffect } from 'react';
import {
    ListPage,
    DetailPageButton,
    Button,
    useNavigate,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    CANCEL_PAYOUT_BATCH,
    PAYOUT_BATCH_COUNTS,
} from '../graphql-queries';
import { api } from '@vendure/dashboard';
import { BanknoteIcon } from 'lucide-react';

const payoutBatchListDocument = graphql(`
    query PayoutBatchList($options: PayoutBatchListOptions) {
        payoutBatchesList(options: $options) {
            items {
                id
                reference
                periodStart
                periodEnd
                totalAmount
                totalPlatformFee
                transactionCount
                successCount
                status
                paidAt
                createdAt
            }
            totalItems
        }
    }
`);

const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-700',
        csv_downloaded: 'bg-secondary text-secondary-foreground',
        paid: 'bg-green-100 text-green-700',
        cancelled: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
        pending: 'Pendiente', csv_downloaded: 'CSV Descargado',
        paid: 'Pagado', cancelled: 'Cancelado',
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[status] || 'bg-secondary text-secondary-foreground'}`}>
            {labels[status] || status}
        </span>
    );
};

const fmt = (v: number) => `$${(v / 100).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fdt = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-CO', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

type StatusFilter = 'pending' | 'paid' | 'cancelled' | undefined;

const FILTER_ORDER: StatusFilter[] = [undefined, 'pending', 'paid', 'cancelled'];
const FILTER_LABEL = (f: StatusFilter) =>
    f === undefined ? 'Todas' : f === 'pending' ? 'Pendientes' : f === 'paid' ? 'Pagadas' : 'Canceladas';

export function PayoutListPage({ route }: { route: any }) {
    const [filterStatus, setFilterStatus] = useState<StatusFilter>(undefined);
    const [refreshKey, setRefreshKey] = useState(0);
    const filterRef = useRef<{ status: StatusFilter }>({ status: undefined });
    const [totals, setTotals] = useState({ total: 0, pending: 0, paid: 0, cancelled: 0 });
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    useEffect(() => {
        api.query<{ payoutBatchCounts: typeof totals }>(PAYOUT_BATCH_COUNTS)
            .then(data => setTotals(data.payoutBatchCounts))
            .catch(() => {});
    }, [filterStatus]);

    const refreshCounts = () => {
        api.query<{ payoutBatchCounts: typeof totals }>(PAYOUT_BATCH_COUNTS)
            .then(data => setTotals(data.payoutBatchCounts))
            .catch(() => {});
    };

    const cancelMutation = useMutation({
        mutationFn: (id: string) => api.mutate(CANCEL_PAYOUT_BATCH, { id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payout-batch-list'] });
            setRefreshKey(k => k + 1);
            refreshCounts();
        },
    });

    const toggleFilter = () => {
        const current = filterRef.current.status;
        const idx = FILTER_ORDER.indexOf(current);
        const next = FILTER_ORDER[(idx + 1) % FILTER_ORDER.length];
        filterRef.current.status = next;
        setFilterStatus(next);
        setRefreshKey(k => k + 1);
    };

    return (
        <ListPage
            key={refreshKey}
            pageId="payout-list"
            title="Liquidaciones"
            listQuery={payoutBatchListDocument}
            route={route}
            transformVariables={(vars: any) => ({
                ...vars,
                options: {
                    ...vars.options,
                    filter: {
                        ...vars.options?.filter,
                        status: filterRef.current.status
                            ? { eq: filterRef.current.status }
                            : undefined,
                    },
                },
            })}
            customizeColumns={{
                reference: {
                    cell: ({ row }: any) => (
                        <DetailPageButton id={row.original.id} label={row.original.reference} />
                    ),
                },
                periodStart: {
                    header: 'Período',
                    cell: ({ row }: any) => (
                        <span className="text-muted-foreground">
                            {fdt(row.original.periodStart)} — {fdt(row.original.periodEnd)}
                        </span>
                    ),
                },
                totalAmount: {
                    cell: ({ row }: any) => <span className="font-medium">{fmt(row.original.totalAmount)}</span>,
                },
                totalPlatformFee: {
                    cell: ({ row }: any) => (
                        <span className="text-muted-foreground">-{fmt(row.original.totalPlatformFee)}</span>
                    ),
                },
                transactionCount: {
                    header: 'Transacciones',
                    cell: ({ row }: any) => (
                        <div className="text-center">{row.original.successCount}/{row.original.transactionCount}</div>
                    ),
                    enableSorting: false,
                },
                status: {
                    cell: ({ row }: any) => statusBadge(row.original.status),
                },
                paidAt: {
                    cell: ({ row }: any) => (
                        <span className="text-muted-foreground text-xs">{fdt(row.original.paidAt)}</span>
                    ),
                },
                createdAt: {
                    cell: ({ row }: any) => (
                        <span className="text-muted-foreground text-xs">{fdt(row.original.createdAt)}</span>
                    ),
                },
            }}
            defaultColumnOrder={['reference', 'periodStart', 'totalAmount', 'totalPlatformFee', 'transactionCount', 'status', 'paidAt', 'createdAt', 'actions']}
            defaultVisibility={{ paidAt: false, createdAt: false }}
            additionalColumns={{
                actions: {
                    header: 'Acciones',
                    cell: ({ row }: any) =>
                        row.original.status === 'pending' ? (
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => cancelMutation.mutate(row.original.id)}
                            >
                                Cancelar
                            </Button>
                        ) : null,
                },
            }}
        >
            <div className="flex items-center justify-between w-full gap-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <BanknoteIcon className="h-4 w-4" />
                        <strong className="text-foreground">{totals.total}</strong> total
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        <strong className="text-foreground">{totals.pending}</strong> pendientes
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        <strong className="text-foreground">{totals.paid}</strong> pagadas
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-red-400" />
                        <strong className="text-foreground">{totals.cancelled}</strong> canceladas
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filterStatus ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                        onClick={toggleFilter}
                    >
                        {FILTER_LABEL(filterStatus)}
                    </button>
                    <Button variant="default" onClick={() => navigate({ to: '/payouts/new' })}>
                        Nueva liquidación
                    </Button>
                </div>
            </div>
        </ListPage>
    );
}