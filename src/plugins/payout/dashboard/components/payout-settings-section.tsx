import React from 'react';
import {
    api,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsList,
    TabsTrigger,
} from '@vendure/dashboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    GET_MY_PAYOUT_INFO,
    GET_MY_PAYOUT_BATCHES,
    SAVE_MY_PAYOUT_INFO,
} from '../graphql-queries';
import { BANKS } from '../../constants';

const BANK_HELP: Record<string, string> = {
    '1007': 'Ingresa tu numero de cuenta de ahorros o corriente Bancolombia.',
    '1051': 'Para Daviplata ingresa tu celular registrado. Para cuenta Davivienda ingresa el numero de cuenta.',
    '1507': 'Ingresa tu numero de celular registrado en Nequi. El dinero llega automaticamente.',
    '1551': 'Ingresa tu numero de celular registrado en Daviplata. El dinero llega automaticamente.',
    '1013': 'Ingresa tu numero de cuenta BBVA.',
    '1002': 'Ingresa tu numero de cuenta del Banco Popular.',
    '1001': 'Ingresa tu numero de cuenta de Banco de Bogota.',
};

const DOC_TYPES: Record<string, string> = {
    CC: 'Cedula de Ciudadania (CC)',
    NIT: 'NIT',
    CE: 'Cedula de Extranjeria (CE)',
    TI: 'Tarjeta de Identidad (TI)',
    PP: 'Pasaporte (PP)',
};

const ACCOUNT_TYPES: Record<string, string> = {
    AHORROS: 'Ahorros',
    CORRIENTE: 'Corriente',
};

const BREB_TYPES: Record<string, string> = {
    ALPHANUMERIC: 'Alfanumerica (@alias)',
    MAIL: 'Email',
    PHONE: 'Telefono',
};

const fmt = (v: number) => `$${(v / 100).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fd = (d: string) => new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

export function PayoutSettingsSection() {
    const queryClient = useQueryClient();

    const { data: infoData, isLoading: infoLoading } = useQuery({
        queryKey: ['myPayoutInfo'],
        queryFn: () => api.query<{ myPayoutInfo: any }>(GET_MY_PAYOUT_INFO),
    });

    const { data: batchesData } = useQuery({
        queryKey: ['myPayoutBatches'],
        queryFn: () => api.query<{ myPayoutBatches: any[] }>(GET_MY_PAYOUT_BATCHES),
    });

    const info = infoData?.myPayoutInfo;
    const batches = batchesData?.myPayoutBatches ?? [];

    const saveMutation = useMutation({
        mutationFn: (input: any) => api.mutate(SAVE_MY_PAYOUT_INFO, { input }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myPayoutInfo'] });
        },
    });

    const [legalIdType, setLegalIdType] = React.useState('');
    const [legalId, setLegalId] = React.useState('');
    const [accountType, setAccountType] = React.useState('');
    const [accountNumber, setAccountNumber] = React.useState('');
    const [bankCode, setBankCode] = React.useState('');
    const [brebKey, setBrebKey] = React.useState('');
    const [brebKeyType, setBrebKeyType] = React.useState('');

    React.useEffect(() => {
        if (info) {
            setLegalIdType(info.legalIdType || '');
            setLegalId(info.legalId || '');
            setAccountType(info.accountType || '');
            setAccountNumber(info.accountNumber || '');
            setBankCode(info.bankCode || '');
            setBrebKey(info.brebKey || '');
            setBrebKeyType(info.brebKeyType || '');
        }
    }, [info]);

    const [activeTab, setActiveTab] = React.useState('settings');

    const handleSave = () => {
        saveMutation.mutate({
            legalIdType: legalIdType || null,
            legalId: legalId || null,
            accountType: accountType || null,
            accountNumber: accountNumber || null,
            bankCode: bankCode || null,
            brebKey: brebKey || null,
            brebKeyType: brebKeyType || null,
        });
    };

    const isPhoneField = bankCode === '1507' || bankCode === '1551';

    if (infoLoading) {
        return (
            <div className="space-y-4">
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                        Cargando datos de pago...
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="settings">Configurar pago</TabsTrigger>
                    <TabsTrigger value="history">Historial de pagos</TabsTrigger>
                </TabsList>
            </Tabs>

            {activeTab === 'settings' && (
                <Card>
                    <CardHeader><CardTitle>Donde recibir tu dinero</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {saveMutation.isError && (
                            <div className="text-red-500 text-sm">{(saveMutation.error as any)?.message}</div>
                        )}
                        {saveMutation.isSuccess && (
                            <div className="text-green-600 text-sm">Datos guardados exitosamente</div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Tipo de documento</Label>
                                <Select value={legalIdType} onValueChange={setLegalIdType}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar...">{legalIdType ? DOC_TYPES[legalIdType] || legalIdType : undefined}</SelectValue></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CC">Cedula de Ciudadania (CC)</SelectItem>
                                        <SelectItem value="NIT">NIT</SelectItem>
                                        <SelectItem value="CE">Cedula de Extranjeria (CE)</SelectItem>
                                        <SelectItem value="TI">Tarjeta de Identidad (TI)</SelectItem>
                                        <SelectItem value="PP">Pasaporte (PP)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Numero de documento</Label>
                                <Input value={legalId} onChange={e => setLegalId(e.target.value)} placeholder="1234567890" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label>Banco</Label>
                            <Select value={bankCode} onValueChange={setBankCode}>
                                <SelectTrigger><SelectValue placeholder="Selecciona tu banco...">{bankCode ? (BANKS[bankCode] || bankCode) : undefined}</SelectValue></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(BANKS).map(([code, name]) => (
                                        <SelectItem key={code} value={code}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>{isPhoneField ? 'Celular registrado' : 'Tipo de cuenta'}</Label>
                                {!isPhoneField ? (
                                    <Select value={accountType} onValueChange={setAccountType}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar...">{accountType ? ACCOUNT_TYPES[accountType] || accountType : undefined}</SelectValue></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="AHORROS">Ahorros</SelectItem>
                                            <SelectItem value="CORRIENTE">Corriente</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input value={isPhoneField ? accountNumber : ''} disabled placeholder="No aplica" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label>{isPhoneField ? 'Celular registrado' : 'Numero de cuenta'}</Label>
                                <Input
                                    value={accountNumber}
                                    onChange={e => setAccountNumber(e.target.value)}
                                    placeholder={isPhoneField ? '3001234567' : 'Numero de cuenta bancaria'}
                                />
                                {bankCode && BANK_HELP[bankCode] && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {BANK_HELP[bankCode]}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-4">
                            <p className="text-sm font-medium mb-2">Alternativa: Llave BRE-B</p>
                            <p className="text-xs text-muted-foreground mb-3">
                                La llave BRE-B te permite recibir pagos sin compartir datos bancarios. Solo necesitas una llave asociada a tu cuenta bancaria (email, telefono o alias).
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Llave BRE-B</Label>
                                    <Input value={brebKey} onChange={e => setBrebKey(e.target.value)} placeholder="@alias, email o telefono" />
                                </div>
                                <div className="space-y-1">
                                    <Label>Tipo de llave</Label>
                                    <Select value={brebKeyType} onValueChange={setBrebKeyType}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar...">{brebKeyType ? BREB_TYPES[brebKeyType] || brebKeyType : undefined}</SelectValue></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALPHANUMERIC">Alfanumerica (@alias)</SelectItem>
                                            <SelectItem value="MAIL">Email</SelectItem>
                                            <SelectItem value="PHONE">Telefono</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <Button variant="default" onClick={handleSave} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Guardando...' : 'Guardar datos de pago'}
                        </Button>

                        {info?.brebVerified && (
                            <p className="text-sm text-green-600">Llave BRE-B verificada</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {activeTab === 'history' && (
                <Card>
                    <CardHeader><CardTitle>Historial de pagos</CardTitle></CardHeader>
                    <CardContent>
                        {batches.length === 0 ? (
                            <p className="text-muted-foreground">No hay pagos registrados todavia.</p>
                        ) : (
                            <div className="space-y-3">
                                {batches.map((b: any) => (
                                    <div key={b.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div>
                                            <p className="font-medium">{b.reference}</p>
                                            <p className="text-sm text-muted-foreground">{fd(b.periodStart)} — {fd(b.periodEnd)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{fmt(b.totalAmount)}</p>
                                            <p className="text-sm text-muted-foreground">{b.paidAt ? fd(b.paidAt) : b.status}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
