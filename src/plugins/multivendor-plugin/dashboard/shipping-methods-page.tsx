import { useState, useEffect } from 'react';
import {
    Page,
    PageLayout,
    PageBlock,
    PageTitle,
    Card,
    CardContent,
    Switch,
} from '@vendure/dashboard';
import { Truck, Globe, User } from 'lucide-react';
import { gql } from './graphql-queries';

const SELLER_SHIPPING_SETTINGS_QUERY = `
    query { sellerShippingSettings { ownDeliveryEnabled } }
`;
const UPDATE_SELLER_SHIPPING_SETTINGS_MUTATION = `
    mutation UpdateSellerShippingSettings($ownDeliveryEnabled: Boolean!) {
        updateSellerShippingSettings(ownDeliveryEnabled: $ownDeliveryEnabled) { ownDeliveryEnabled }
    }
`;

export function ShippingMethodsPage() {
    const [ownDeliveryEnabled, setOwnDeliveryEnabled] = useState(false);
    const [ownDeliveryLoading, setOwnDeliveryLoading] = useState(true);

    useEffect(() => {
        gql<{ sellerShippingSettings: { ownDeliveryEnabled: boolean } }>(SELLER_SHIPPING_SETTINGS_QUERY)
            .then(d => setOwnDeliveryEnabled(d.sellerShippingSettings.ownDeliveryEnabled))
            .catch(() => {})
            .finally(() => setOwnDeliveryLoading(false));
    }, []);

    const handleToggleOwnDelivery = async (enabled: boolean) => {
        setOwnDeliveryEnabled(enabled);
        try {
            await gql(UPDATE_SELLER_SHIPPING_SETTINGS_MUTATION, { ownDeliveryEnabled: enabled });
        } catch {
            setOwnDeliveryEnabled(!enabled);
        }
    };

    return (
        <Page pageId="shipping-methods-page">
            <PageTitle>
                <span className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Métodos de envío
                </span>
            </PageTitle>

            <PageLayout>
                <PageBlock column="main">
                    <div className="space-y-4">
                        <Card>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 text-blue-600">
                                            <Globe className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Domicilio Messenger Domis</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Costo calculado automáticamente según distancia. Solo Popayán.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                        Siempre activo
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-50 text-green-600">
                                            <Globe className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Envío Nacional (Envía)</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Envíos a toda Colombia con Envía. Fuera de Popayán.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                        Siempre activo
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-50 text-purple-600">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Domicilio con el vendedor</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                El vendedor coordina la entrega. El domicilio se cobra en el lugar de destino.
                                            </p>
                                        </div>
                                    </div>
                                    {ownDeliveryLoading ? (
                                        <div className="w-10 h-6 bg-muted rounded-full animate-pulse" />
                                    ) : (
                                        <Switch
                                            checked={ownDeliveryEnabled}
                                            onCheckedChange={handleToggleOwnDelivery}
                                        />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
