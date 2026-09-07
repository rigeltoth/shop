import {
    api,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Input,
    Label,
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
} from '@vendure/dashboard';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AlertCircle, Info, Mail, RefreshCw, Search } from 'lucide-react';
import { optionalPublicGraphQlDetail, userFacingDashboardError } from './format-graphql-error';
import { humanizeInvoiceEmissionError } from '../services/format-invoice-emission-error';
import { formatColombiaDateTime } from './format-colombia-datetime';
import { InvoiceQuotaStatusCard } from './invoice-quota-status-card';
import { useCurrentInvoiceQuotaStatus } from './use-current-invoice-quota-status';

function buildInvoiceListVariables(
    filter: Record<string, string> | undefined,
    take: number,
    skip: number,
) {
    const options: {
        take: number;
        skip: number;
        filter?: Record<string, string>;
    } = { take, skip };
    if (filter && Object.keys(filter).length > 0) {
        options.filter = filter;
    }
    return { options };
}

const INVOICES_QUERY = `
  query InvoicesDashboard(
    $options: InvoiceListOptionsInput
  ) {
    invoices(options: $options) {
      total
      items {
        id
        orderCode
        prefix
        documentNumber
        status
        statusMessage
        customerName
        customerDni
        total
        currencyCode
        pdfUrl
        createdAt
      }
    }
  }
`;

const FAILURES_QUERY = `
  query InvoiceCreationFailures($take: Int, $skip: Int) {
    invoiceCreationFailures(take: $take, skip: $skip) {
      total
      items {
        orderId
        orderCode
        error
        failedAt
      }
    }
  }
`;

const QUEUE_STATUS_QUERY = `
  query InvoiceEmissionQueueStatus {
    invoiceEmissionQueueStatus {
      pendingCount
      runningCount
      retryingCount
      activeTotal
    }
  }
`;

const SYNC_INVOICE_FROM_MATIAS_MUTATION = `
  mutation SyncInvoiceFromMatias($invoiceId: ID!, $orderCode: String!) {
    syncInvoiceFromMatias(invoiceId: $invoiceId, orderCode: $orderCode) {
      success
      message
      status
      matiasInvoiceId
      error
      pdfUrl
      xmlUrl
    }
  }
`;

const RESEND_INVOICE_MATIAS_MUTATION = `
  mutation ResendInvoiceMatiasEmail($invoiceId: ID!, $orderCode: String!, $email: String) {
    resendInvoiceMatiasEmail(invoiceId: $invoiceId, orderCode: $orderCode, email: $email) {
      success
      message
      error
    }
  }
`;

type InvoiceMatiasActionGql = {
    success: boolean;
    message?: string | null;
    status?: string | null;
    matiasInvoiceId?: string | null;
    error?: string | null;
    pdfUrl?: string | null;
    xmlUrl?: string | null;
};

interface InvoiceRow {
    id: string;
    orderCode: string;
    prefix: string;
    documentNumber: string;
    status: string;
    statusMessage: string | null;
    customerName: string;
    customerDni: string;
    total: string;
    currencyCode: string;
    pdfUrl: string | null;
    createdAt: string;
}

export function InvoicesPage() {
    const [useOrderCode, setUseOrderCode] = useState(false);
    const [useCustomerDni, setUseCustomerDni] = useState(false);
    const [useStatus, setUseStatus] = useState(false);
    const [useDateFrom, setUseDateFrom] = useState(false);
    const [useDateTo, setUseDateTo] = useState(false);

    const [orderCode, setOrderCode] = useState('');
    const [customerDni, setCustomerDni] = useState('');
    const [status, setStatus] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [skip, setSkip] = useState(0);
    /** Snapshot del filtro solo al pulsar «Buscar» (evita refetch al escribir y error al abrir la página). */
    const [committedSearch, setCommittedSearch] = useState<{ filter?: Record<string, string> } | null>(
        null,
    );
    const [filterValidationMsg, setFilterValidationMsg] = useState<string | null>(null);
    const pageSize = 25;

    const filter = useMemo(() => {
        const f: Record<string, string> = {};
        if (useOrderCode && orderCode.trim()) f.orderCode = orderCode.trim();
        if (useCustomerDni && customerDni.trim()) f.customerDni = customerDni.trim();
        if (useStatus && status.trim()) f.status = status.trim();
        if (useDateFrom && dateFrom)
            f.dateFrom = new Date(dateFrom + 'T00:00:00.000Z').toISOString();
        if (useDateTo && dateTo) f.dateTo = new Date(dateTo + 'T23:59:59.999Z').toISOString();
        return Object.keys(f).length ? f : undefined;
    }, [
        useOrderCode,
        useCustomerDni,
        useStatus,
        useDateFrom,
        useDateTo,
        orderCode,
        customerDni,
        status,
        dateFrom,
        dateTo,
    ]);

    const validateActiveFilters = (): string | null => {
        if (useOrderCode && !orderCode.trim()) {
            return 'Tienes activado el filtro por código de pedido: escribe un valor o desmárcalo.';
        }
        if (useCustomerDni && !customerDni.trim()) {
            return 'Tienes activado el filtro por NIT/documento: escribe un valor o desmárcalo.';
        }
        if (useStatus && !status.trim()) {
            return 'Tienes activado el filtro por estado: escribe un valor o desmárcalo.';
        }
        if (useDateFrom && !dateFrom) {
            return 'Tienes activado «desde» en fechas: elige una fecha o desmarca esa opción.';
        }
        if (useDateTo && !dateTo) {
            return 'Tienes activado «hasta» en fechas: elige una fecha o desmarca esa opción.';
        }
        return null;
    };

    const committedSignature = committedSearch
        ? JSON.stringify(committedSearch.filter ?? null)
        : null;

    const runInvoiceSearch = () => {
        const v = validateActiveFilters();
        if (v) {
            setFilterValidationMsg(v);
            return;
        }
        setFilterValidationMsg(null);
        setSkip(0);
        setCommittedSearch({ filter });
    };

    const {
        data: invData,
        isLoading: invLoading,
        error: invError,
        refetch: refetchInv,
        isRefetching: invRefetching,
    } = useQuery({
        queryKey: ['invoices-dashboard', committedSignature, skip, pageSize],
        enabled: committedSearch !== null,
        queryFn: async () => {
            try {
                return await api.query<{
                    invoices: { total: number; items: InvoiceRow[] };
                }>(
                    INVOICES_QUERY,
                    buildInvoiceListVariables(committedSearch!.filter, pageSize, skip),
                );
            } catch (e) {
                throw userFacingDashboardError(e, 'Error al obtener facturas.');
            }
        },
    });

    const {
        data: failData,
        isLoading: failLoading,
        error: failError,
        refetch: refetchFail,
    } = useQuery({
        queryKey: ['invoice-creation-failures'],
        queryFn: async () => {
            try {
                return await api.query<{
                    invoiceCreationFailures: {
                        total: number;
                        items: Array<{
                            orderId: string;
                            orderCode: string;
                            error: string;
                            failedAt: string;
                        }>;
                    };
                }>(FAILURES_QUERY, { take: 20, skip: 0 });
            } catch (e) {
                throw userFacingDashboardError(e, 'No se pudieron cargar los avisos de facturación.');
            }
        },
    });

    const { data: queueData, refetch: refetchQueue } = useQuery({
        queryKey: ['invoice-emission-queue-status'],
        queryFn: async () => {
            try {
                return await api.query<{
                    invoiceEmissionQueueStatus: {
                        pendingCount: number;
                        runningCount: number;
                        retryingCount: number;
                        activeTotal: number;
                    };
                }>(QUEUE_STATUS_QUERY);
            } catch {
                return {
                    invoiceEmissionQueueStatus: {
                        pendingCount: 0,
                        runningCount: 0,
                        retryingCount: 0,
                        activeTotal: 0,
                    },
                };
            }
        },
    });

    const [matiasActionFeedback, setMatiasActionFeedback] = useState<string | null>(null);
    const [actingInvoiceId, setActingInvoiceId] = useState<string | null>(null);

    const syncInvoiceFromMatiasMut = useMutation({
        mutationFn: (row: InvoiceRow) =>
            api.mutate<{ syncInvoiceFromMatias: InvoiceMatiasActionGql }>(SYNC_INVOICE_FROM_MATIAS_MUTATION, {
                invoiceId: row.id,
                orderCode: row.orderCode,
            }),
        onMutate: (row) => {
            setActingInvoiceId(row.id);
            setMatiasActionFeedback(null);
        },
        onSuccess: (data) => {
            const r = data.syncInvoiceFromMatias;
            const msg =
                r.message ||
                (r.status ? `Estado Matias: ${r.status}` : null) ||
                (r.error ? `Aviso: ${r.error}` : 'Sincronizado.');
            setMatiasActionFeedback(msg);
            void refetchInv();
        },
        onError: (e) => {
            setMatiasActionFeedback(
                userFacingDashboardError(e, 'No se pudo sincronizar con Matias.').message,
            );
        },
        onSettled: () => setActingInvoiceId(null),
    });

    const resendInvoiceMatiasMut = useMutation({
        mutationFn: (vars: { row: InvoiceRow; email: string }) =>
            api.mutate<{ resendInvoiceMatiasEmail: InvoiceMatiasActionGql }>(RESEND_INVOICE_MATIAS_MUTATION, {
                invoiceId: vars.row.id,
                orderCode: vars.row.orderCode,
                email: vars.email,
            }),
        onMutate: (vars) => {
            setActingInvoiceId(vars.row.id);
            setMatiasActionFeedback(null);
        },
        onSuccess: (data) => {
            const r = data.resendInvoiceMatiasEmail;
            setMatiasActionFeedback(r.message ?? r.error ?? 'Reenvío solicitado.');
            void refetchInv();
        },
        onError: (e) => {
            setMatiasActionFeedback(
                userFacingDashboardError(e, 'No se pudo reenviar el correo.').message,
            );
        },
        onSettled: () => setActingInvoiceId(null),
    });

    // El hook ya selecciona currentInvoiceQuotaStatus; data ES el cupo (no un wrapper).
    const {
        data: quotaStatus,
        refetch: refetchQuota,
        isLoading: quotaLoading,
        isError: quotaError,
    } = useCurrentInvoiceQuotaStatus();

    const items = invData?.invoices.items ?? [];
    const total = invData?.invoices.total ?? 0;
    const maxSkip = Math.max(0, total - pageSize);
    const failures = failData?.invoiceCreationFailures.items ?? [];

    const invErrMsg = invError ? invError.message : null;
    const failErrMsg = failError ? failError.message : null;
    const invErrDetail = invError ? optionalPublicGraphQlDetail(invError) : null;
    const failErrDetail = failError ? optionalPublicGraphQlDetail(failError) : null;
    const queueStatus = queueData?.invoiceEmissionQueueStatus;
    const failuresCardTone = failErrMsg
        ? 'border-destructive/40'
        : queueStatus && queueStatus.activeTotal > 0
          ? 'border-sky-500/35'
          : '';

    const refreshFailuresSection = () => {
        void refetchFail();
        void refetchQueue();
        void refetchQuota();
    };

    return (
        <Page pageId="invoices-matias">
            <PageTitle>Facturas</PageTitle>
            <PageLayout>
                <PageBlock column="main" blockId="intro">
                    <p className="text-muted-foreground text-sm max-w-3xl">
                        Busca facturas y comprobantes emitidos por el sistema. Puedes dejar todas las
                        casillas desmarcadas y pulsar «Buscar facturas» para listar
                        resultados paginados, o marcar solo el criterio que necesites. Los errores de
                        emisión quedan en la orden y se muestran abajo.
                    </p>
                </PageBlock>

                <PageBlock column="main" blockId="quota-status">
                    {quotaError && !quotaStatus ? (
                        <InvoiceQuotaStatusCard quotaStatus={undefined} isLoading={false} variant="default" />
                    ) : (
                        <InvoiceQuotaStatusCard
                            quotaStatus={quotaStatus}
                            isLoading={quotaLoading}
                            variant="default"
                        />
                    )}
                </PageBlock>

                <PageBlock column="main" blockId="failures">
                    <Card className={failuresCardTone ? `border ${failuresCardTone}` : ''}>
                        <CardHeader className="flex flex-row items-start gap-2">
                            {failErrMsg ? (
                                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            ) : queueStatus && queueStatus.activeTotal > 0 ? (
                                <Info className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                                <CardTitle>Emisión de facturas — avisos</CardTitle>
                                <CardDescription>
                                    Si la factura automática falla, verás el pedido y el mensaje. Los reintentos
                                    automáticos se indican abajo; cuando la factura se emite bien, el aviso
                                    desaparece.
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                onClick={() => refreshFailuresSection()}
                            >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Actualizar
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {failErrMsg && (
                                <div>
                                    <p className="text-sm text-destructive font-medium">{failErrMsg}</p>
                                    {failErrDetail ? (
                                        <p className="text-sm text-muted-foreground mt-1.5">{failErrDetail}</p>
                                    ) : null}
                                </div>
                            )}
                            {!failErrMsg &&
                                queueStatus &&
                                queueStatus.activeTotal > 0 && (
                                    <p className="text-sm text-sky-600 dark:text-sky-400">
                                        Ahora mismo hay {queueStatus.activeTotal}{' '}
                                        {queueStatus.activeTotal === 1
                                            ? 'emisión de factura en cola o en curso'
                                            : 'emisiones de factura en cola o en curso'}
                                        {queueStatus.retryingCount > 0
                                            ? ` (${queueStatus.retryingCount} reintentándose automáticamente)`
                                            : ''}
                                        .
                                    </p>
                                )}
                            {failLoading ? (
                                <p className="text-sm text-muted-foreground">Cargando avisos…</p>
                            ) : failError ? null : failures.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {queueStatus && queueStatus.activeTotal > 0
                                        ? 'No hay pedidos con error guardado; el sistema sigue procesando la cola.'
                                        : 'No hay pedidos con error de emisión registrado en este momento.'}
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Pedido</TableHead>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Qué ocurrió</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {failures.map((f) => (
                                                <TableRow key={f.orderId}>
                                                    <TableCell className="font-mono">{f.orderCode}</TableCell>
                                                    <TableCell className="whitespace-nowrap text-sm">
                                                        {formatColombiaDateTime(f.failedAt)}
                                                    </TableCell>
                                                    <TableCell className="max-w-xl text-sm text-destructive">
                                                        {humanizeInvoiceEmissionError(f.error)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </PageBlock>

                <PageBlock column="main" blockId="filters">
                    <Card>
                        <CardHeader>
                            <CardTitle>Filtros</CardTitle>
                            <CardDescription>
                                Marca solo los criterios que quieras (uno, varios o ninguno). Sin ninguna casilla, la
                                búsqueda lista todas las facturas por páginas. Pulsa «Buscar facturas» cuando esté
                                listo; puedes cambiar filtros y volver a buscar sin rellenar todo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {filterValidationMsg && (
                                <p className="text-sm text-destructive">{filterValidationMsg}</p>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="flex gap-3 items-start rounded-lg border p-3">
                                    <Checkbox
                                        id="filter-order-code"
                                        className="mt-1"
                                        checked={useOrderCode}
                                        onCheckedChange={(v) => {
                                            setUseOrderCode(v === true);
                                            setSkip(0);
                                        }}
                                    />
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <Label htmlFor="orderCode" className="cursor-pointer">
                                            Filtrar por código de pedido
                                        </Label>
                                        <Input
                                            id="orderCode"
                                            placeholder="ej. ORD-2024-001"
                                            value={orderCode}
                                            disabled={!useOrderCode}
                                            onChange={(e) => {
                                                setOrderCode(e.target.value);
                                                setSkip(0);
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start rounded-lg border p-3">
                                    <Checkbox
                                        id="filter-dni"
                                        className="mt-1"
                                        checked={useCustomerDni}
                                        onCheckedChange={(v) => {
                                            setUseCustomerDni(v === true);
                                            setSkip(0);
                                        }}
                                    />
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <Label htmlFor="dni" className="cursor-pointer">
                                            Filtrar por NIT / documento del cliente
                                        </Label>
                                        <Input
                                            id="dni"
                                            placeholder="Documento en la factura"
                                            value={customerDni}
                                            disabled={!useCustomerDni}
                                            onChange={(e) => {
                                                setCustomerDni(e.target.value);
                                                setSkip(0);
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start rounded-lg border p-3">
                                    <Checkbox
                                        id="filter-status"
                                        className="mt-1"
                                        checked={useStatus}
                                        onCheckedChange={(v) => {
                                            setUseStatus(v === true);
                                            setSkip(0);
                                        }}
                                    />
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <Label htmlFor="status" className="cursor-pointer">
                                            Filtrar por estado DIAN
                                        </Label>
                                        <Input
                                            id="status"
                                            placeholder="ej. ACCEPTED"
                                            value={status}
                                            disabled={!useStatus}
                                            onChange={(e) => {
                                                setStatus(e.target.value);
                                                setSkip(0);
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3 rounded-lg border p-3 lg:col-span-2">
                                    <p className="text-sm font-medium">Rango de fechas (creación en Matias)</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex gap-3 items-start">
                                            <Checkbox
                                                id="filter-df"
                                                className="mt-1"
                                                checked={useDateFrom}
                                                onCheckedChange={(v) => {
                                                    setUseDateFrom(v === true);
                                                    setSkip(0);
                                                }}
                                            />
                                            <div className="space-y-2 flex-1">
                                                <Label htmlFor="df">Incluir &quot;desde&quot;</Label>
                                                <Input
                                                    id="df"
                                                    type="date"
                                                    value={dateFrom}
                                                    disabled={!useDateFrom}
                                                    onChange={(e) => {
                                                        setDateFrom(e.target.value);
                                                        setSkip(0);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <Checkbox
                                                id="filter-dt"
                                                className="mt-1"
                                                checked={useDateTo}
                                                onCheckedChange={(v) => {
                                                    setUseDateTo(v === true);
                                                    setSkip(0);
                                                }}
                                            />
                                            <div className="space-y-2 flex-1">
                                                <Label htmlFor="dt">Incluir &quot;hasta&quot;</Label>
                                                <Input
                                                    id="dt"
                                                    type="date"
                                                    value={dateTo}
                                                    disabled={!useDateTo}
                                                    onChange={(e) => {
                                                        setDateTo(e.target.value);
                                                        setSkip(0);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={() => runInvoiceSearch()}
                                    disabled={invLoading || invRefetching}
                                >
                                    <Search className="h-4 w-4 mr-2" />
                                    Buscar facturas
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (committedSearch !== null) {
                                            void refetchInv();
                                        }
                                    }}
                                    disabled={
                                        committedSearch === null || invLoading || invRefetching
                                    }
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Actualizar lista
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </PageBlock>

                <PageBlock column="main" blockId="table">
                    <Card>
                        <CardHeader>
                            <CardTitle>Facturas emitidas</CardTitle>
                            <CardDescription>
                                {committedSearch === null ? (
                                    'Aún no se ha cargado el listado.'
                                ) : (
                                    <>
                                        Total: {total} · Página {Math.floor(skip / pageSize) + 1} de{' '}
                                        {Math.max(1, Math.ceil(total / pageSize) || 1)}
                                    </>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {invErrMsg && (
                                <div className="mb-4">
                                    <p className="text-sm text-destructive font-medium">{invErrMsg}</p>
                                    {invErrDetail ? (
                                        <p className="text-sm text-muted-foreground mt-1.5">{invErrDetail}</p>
                                    ) : null}
                                </div>
                            )}
                            {matiasActionFeedback ? (
                                <p className="text-sm text-muted-foreground mb-4">{matiasActionFeedback}</p>
                            ) : null}
                            {committedSearch === null ? (
                                <p className="text-sm text-muted-foreground">
                                    Pulsa «Buscar facturas» arriba para cargar el listado desde Matias (con o sin
                                    filtros).
                                </p>
                            ) : invLoading ? (
                                <p className="text-sm text-muted-foreground">Cargando facturas…</p>
                            ) : (
                                <>
                                    {items.length === 0 && !invErrMsg ? (
                                        <p className="text-sm text-muted-foreground py-4">
                                            No hay facturas que coincidan con tu búsqueda. Prueba otros filtros o
                                            comprueba más adelante.
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Pedido</TableHead>
                                                        <TableHead>Prefijo #</TableHead>
                                                        <TableHead>Cliente</TableHead>
                                                        <TableHead>Estado</TableHead>
                                                        <TableHead className="text-right">Total</TableHead>
                                                        <TableHead>Fecha</TableHead>
                                                        <TableHead>PDF</TableHead>
                                                        <TableHead className="whitespace-nowrap">Matias</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {items.map((row) => (
                                                        <TableRow key={row.id}>
                                                            <TableCell className="font-mono">{row.orderCode}</TableCell>
                                                            <TableCell>
                                                                {row.prefix}-{row.documentNumber}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-sm">{row.customerName}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {row.customerDni}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-sm">{row.status}</span>
                                                                {row.statusMessage ? (
                                                                    <div className="text-xs text-muted-foreground max-w-xs truncate">
                                                                        {row.statusMessage}
                                                                    </div>
                                                                ) : null}
                                                            </TableCell>
                                                            <TableCell className="text-right whitespace-nowrap">
                                                                {row.total} {row.currencyCode}
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap text-sm">
                                                                {formatColombiaDateTime(row.createdAt)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {row.pdfUrl ? (
                                                                    <a
                                                                        className="text-primary text-sm underline"
                                                                        href={row.pdfUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                    >
                                                                        Ver
                                                                    </a>
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-wrap gap-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={!!actingInvoiceId}
                                                                        title="Sincronizar estado y enlaces desde Matias (Bearer de la tienda del pedido, si aplica)"
                                                                        onClick={() =>
                                                                            syncInvoiceFromMatiasMut.mutate(row)
                                                                        }
                                                                    >
                                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={!!actingInvoiceId}
                                                                        title="Reenviar correo desde Matias"
                                                                        onClick={() => {
                                                                            const email = window.prompt(
                                                                                'Email destino (reenvío PDF/XML desde Matias)',
                                                                            );
                                                                            if (email === null) return;
                                                                            const t = email.trim();
                                                                            if (!t) {
                                                                                setMatiasActionFeedback(
                                                                                    'Email vacío; no se envió nada.',
                                                                                );
                                                                                return;
                                                                            }
                                                                            resendInvoiceMatiasMut.mutate({
                                                                                row,
                                                                                email: t,
                                                                            });
                                                                        }}
                                                                    >
                                                                        <Mail className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between mt-4 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={skip <= 0 || invLoading || invRefetching}
                                            onClick={() => setSkip((s) => Math.max(0, s - pageSize))}
                                        >
                                            Anterior
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={skip >= maxSkip || invLoading || invRefetching}
                                            onClick={() => setSkip((s) => s + pageSize)}
                                        >
                                            Siguiente
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
