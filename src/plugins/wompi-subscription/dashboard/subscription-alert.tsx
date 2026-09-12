import { useEffect, useState } from 'react';
import { Card, CardContent } from '@vendure/dashboard';
import { MY_SUBSCRIPTION_QUERY, gql } from './graphql-queries';

interface SubscriptionAlertData {
    mySubscription: { id: number; status: string; endsAt?: string; gracePeriodStart?: string } | null;
}

export function SubscriptionAlertSection() {
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        gql<SubscriptionAlertData>(MY_SUBSCRIPTION_QUERY)
            .then(data => {
                if (!cancelled) setStatus(data?.mySubscription?.status ?? null);
            })
            .catch(() => {
                if (!cancelled) setStatus(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (status === 'PENDING_PAYMENT') {
        return (
            <Card className="border-warning/50 bg-warning/5">
                <CardContent className="py-4 space-y-2">
                    <p className="text-sm text-warning-foreground">
                        Tienes un <strong>pago pendiente</strong> por tu suscripción.
                    </p>
                    <a href="/dashboard/billing" className="text-sm font-medium underline text-warning-foreground">
                        Completar el pago
                    </a>
                </CardContent>
            </Card>
        );
    }

    if (status === 'GRACE_PERIOD') {
        return (
            <Card className="border-warning/50 bg-warning/5">
                <CardContent className="py-4 space-y-2">
                    <p className="text-sm text-warning-foreground">
                        Tu suscripción está en <strong>período de gracia</strong>. Realiza el pago para evitar la suspensión.
                    </p>
                    <a href="/dashboard/billing" className="text-sm font-medium underline text-warning-foreground">
                        Realizar el pago
                    </a>
                </CardContent>
            </Card>
        );
    }

    return <div style={{ display: 'none' }} />;
}