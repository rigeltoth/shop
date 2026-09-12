import {
    api,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Page,
    PageBlock,
    PageLayout,
    PageTitle,
} from '@vendure/dashboard';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { userFacingDashboardError } from './format-graphql-error';

const STORES_QUERY = `
  query MatiasBillingStores {
    matiasBillingStores {
      channelId
      channelCode
      sellerName
      billingActive
      remaining
      matiasCompanyId
      matiasCompanyIdConfigured
      matiasInvoicePrefix
      matiasResolutionNumber
      matiasEmitProfileComplete
    }
    matiasGlobalInvoicePool {
      defaultChannelCode
      total
      sellableRemaining
    }
  }
`;

const UPDATE_GLOBAL_POOL = `
  mutation UpdateMatiasGlobalPool($input: UpdateMatiasGlobalInvoicePoolInput!) {
    updateMatiasGlobalInvoicePool(input: $input) {
      defaultChannelCode
      total
      sellableRemaining
    }
  }
`;

const UPDATE_STORE = `
  mutation UpdateMatiasBillingStore($input: UpdateMatiasBillingStoreInput!) {
    updateMatiasBillingStore(input: $input) {
      channelId
      channelCode
      billingActive
      remaining
      matiasCompanyId
      matiasCompanyIdConfigured
      matiasInvoicePrefix
      matiasResolutionNumber
      matiasEmitProfileComplete
    }
  }
`;

type StoreRow = {
    channelId: string;
    channelCode: string;
    sellerName: string | null;
    billingActive: boolean;
    remaining: number | null;
    matiasCompanyId: string | null;
    matiasCompanyIdConfigured: boolean;
    matiasInvoicePrefix: string | null;
    matiasResolutionNumber: string | null;
    matiasEmitProfileComplete: boolean;
};

type GlobalPool = {
    defaultChannelCode: string;
    total: number | null;
    sellableRemaining: number | null;
};

export function MatiasStoresPage() {
    const [storeFilter, setStoreFilter] = useState('');
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['matias-billing-stores'],
        queryFn: async () => {
            try {
                return await api.query<{
                    matiasBillingStores: StoreRow[];
                    matiasGlobalInvoicePool: GlobalPool;
                }>(STORES_QUERY);
            } catch (e) {
                throw userFacingDashboardError(e, 'No se pudo cargar el listado.');
            }
        },
    });

    const rows = data?.matiasBillingStores ?? [];
    const filteredRows = useMemo(() => {
        const q = storeFilter.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((row) => {
            const code = row.channelCode.toLowerCase();
            const seller = (row.sellerName ?? '').toLowerCase();
            return code.includes(q) || seller.includes(q);
        });
    }, [rows, storeFilter]);
    const pool = data?.matiasGlobalInvoicePool;
    const errMsg = error ? error.message : null;

    return (
        <Page pageId="matias-billing-stores">
            <PageTitle>Facturación Matias por tienda</PageTitle>
            <PageLayout>
                <PageBlock column="main" blockId="intro">
                    <p className="text-muted-foreground text-sm max-w-3xl">
                        Modelo <strong>Casa de Software</strong>: un solo login Matias en el microservicio. Por
                        cada tienda vendedora configura el <strong>Company ID (UUID)</strong>, el{' '}
                        <strong>prefijo</strong> y el <strong>número de resolución DIAN</strong>. El Company ID
                        identifica la cuenta; la resolución indica a Matias qué rango de numeración aplicar. El
                        cupo se acredita al pagar un paquete en Planes de facturación.
                    </p>
                </PageBlock>

                <PageBlock column="main" blockId="global-pool">
                    <GlobalPoolCard pool={pool} onSaved={() => void refetch()} />
                </PageBlock>

                <PageBlock column="main" blockId="stores">
                    <Card>
                        <CardHeader className="space-y-4">
                            <div className="flex flex-row items-start justify-between gap-4">
                                <div>
                                    <CardTitle>Tiendas vendedoras</CardTitle>
                                    <CardDescription>
                                        Sin Company ID, prefijo y resolución no se puede emitir. Usa el buscador
                                        para encontrar una tienda por código o nombre.
                                    </CardDescription>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Actualizar
                                </Button>
                            </div>
                            <div className="space-y-1.5 max-w-xl">
                                <Label htmlFor="matias-store-search">Buscar tienda</Label>
                                <Input
                                    id="matias-store-search"
                                    type="search"
                                    placeholder="Escribe el nombre o código (ej. tienda-mary, Lucy…)"
                                    value={storeFilter}
                                    onChange={(e) => setStoreFilter(e.target.value)}
                                />
                                {!isLoading && !errMsg && rows.length > 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        {filteredRows.length === rows.length
                                            ? `${rows.length} tienda${rows.length === 1 ? '' : 's'}`
                                            : `${filteredRows.length} de ${rows.length} tiendas`}
                                    </p>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isLoading ? (
                                <p className="text-sm text-muted-foreground">Cargando tiendas…</p>
                            ) : errMsg ? (
                                <p className="text-sm text-destructive">{errMsg}</p>
                            ) : rows.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No hay canales con vendedor.</p>
                            ) : filteredRows.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Ninguna tienda coincide con «{storeFilter.trim()}».
                                </p>
                            ) : (
                                filteredRows.map((row) => (
                                    <StoreEditorRow key={row.channelId} row={row} onSaved={() => void refetch()} />
                                ))
                            )}
                        </CardContent>
                    </Card>
                </PageBlock>
            </PageLayout>
        </Page>
    );
}

function GlobalPoolCard({
    pool,
    onSaved,
}: {
    pool: GlobalPool | undefined;
    onSaved: () => void;
}) {
    const [total, setTotal] = useState(String(pool?.total ?? ''));
    const [sellable, setSellable] = useState(String(pool?.sellableRemaining ?? ''));

    useEffect(() => {
        setTotal(pool?.total != null ? String(pool.total) : '');
        setSellable(pool?.sellableRemaining != null ? String(pool.sellableRemaining) : '');
    }, [pool?.total, pool?.sellableRemaining]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            await api.mutate(UPDATE_GLOBAL_POOL, {
                input: {
                    total: total.trim() ? Number(total) : null,
                    sellableRemaining: sellable.trim() ? Number(sellable) : null,
                },
            });
        },
        onSuccess: onSaved,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Pool global Matias ({pool?.defaultChannelCode ?? '—'})</CardTitle>
                <CardDescription>
                    Paquete grande de facturas de la cuenta Casa de Software. Lo vendes en paquetes pequeños a
                    tiendas.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 max-w-xl">
                <div className="space-y-1">
                    <Label htmlFor="pool-total">Total del paquete</Label>
                    <Input
                        id="pool-total"
                        type="number"
                        min={0}
                        value={total}
                        onChange={(e) => setTotal(e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="pool-sellable">Disponible para vender</Label>
                    <Input
                        id="pool-sellable"
                        type="number"
                        min={0}
                        value={sellable}
                        onChange={(e) => setSellable(e.target.value)}
                    />
                </div>
                <Button
                    type="button"
                    size="sm"
                    className="sm:col-span-2 w-fit"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                >
                    <Save className="h-4 w-4 mr-1" />
                    {saveMutation.isPending ? 'Guardando…' : 'Guardar pool'}
                </Button>
            </CardContent>
            {saveMutation.isError && saveMutation.error instanceof Error ? (
                <p className="px-6 pb-4 text-sm text-destructive">{saveMutation.error.message}</p>
            ) : null}
        </Card>
    );
}

function StoreEditorRow({
    row,
    onSaved,
}: {
    row: StoreRow;
    onSaved: () => void;
}) {
    const [companyId, setCompanyId] = useState(row.matiasCompanyId ?? '');
    const [prefix, setPrefix] = useState(row.matiasInvoicePrefix ?? '');
    const [resolution, setResolution] = useState(row.matiasResolutionNumber ?? '');

    useEffect(() => {
        setCompanyId(row.matiasCompanyId ?? '');
        setPrefix(row.matiasInvoicePrefix ?? '');
        setResolution(row.matiasResolutionNumber ?? '');
    }, [
        row.channelId,
        row.billingActive,
        row.remaining,
        row.matiasCompanyId,
        row.matiasInvoicePrefix,
        row.matiasResolutionNumber,
    ]);

    const dirty = useMemo(
        () =>
            companyId.trim() !== (row.matiasCompanyId ?? '').trim() ||
            prefix.trim() !== (row.matiasInvoicePrefix ?? '').trim() ||
            resolution.trim() !== (row.matiasResolutionNumber ?? '').trim(),
        [companyId, prefix, resolution, row.matiasCompanyId, row.matiasInvoicePrefix, row.matiasResolutionNumber],
    );

    const saveMutation = useMutation({
        mutationFn: async () => {
            await api.mutate(UPDATE_STORE, {
                input: {
                    channelId: row.channelId,
                    billingActive: row.billingActive,
                    matiasCompanyId: companyId.trim() || null,
                    matiasInvoicePrefix: prefix.trim() || null,
                    matiasResolutionNumber: resolution.trim() || null,
                },
            });
        },
        onSuccess: onSaved,
    });

    return (
        <div className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <p className="font-mono font-medium">{row.channelCode}</p>
                    <p className="text-sm text-muted-foreground">{row.sellerName ?? '—'}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                    Perfil: {row.matiasEmitProfileComplete ? 'completo' : 'incompleto'}
                </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 rounded-md border bg-muted/30 p-3 sm:col-span-2">
                    <p className="text-xs uppercase text-muted-foreground">Estado actual</p>
                    <p className="text-sm">
                        {row.billingActive ? 'Facturación activa' : 'Sin paquete activo comprado'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Cupo restante: {row.remaining ?? 0} facturas
                    </p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor={`cid-${row.channelId}`}>Company ID Matias (UUID)</Label>
                    <Input
                        id={`cid-${row.channelId}`}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Identifica la cuenta o subcuenta del cliente en Matias.
                    </p>
                </div>
                <div className="space-y-1">
                    <Label htmlFor={`prefix-${row.channelId}`}>Prefijo</Label>
                    <Input
                        id={`prefix-${row.channelId}`}
                        placeholder="Ej. SETP"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value)}
                        className="font-mono text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor={`res-${row.channelId}`}>Número de resolución</Label>
                    <Input
                        id={`res-${row.channelId}`}
                        placeholder="Ej. 18760000001"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Obligatorio: Matias usa este dato para el rango de numeración del documento.
                    </p>
                </div>
            </div>
            <Button
                type="button"
                size="sm"
                disabled={!dirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
            >
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? 'Guardando…' : 'Guardar configuración Matias'}
            </Button>
            {saveMutation.isError && saveMutation.error instanceof Error ? (
                <p className="text-sm text-destructive">{saveMutation.error.message}</p>
            ) : null}
        </div>
    );
}
