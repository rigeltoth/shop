import type { PageContextValue } from '@vendure/dashboard';
import { Printer, Truck } from 'lucide-react';

export function EnviaShippingActions({ context }: { context: PageContextValue }) {
    const order = context?.entity as any;
    const fulfillments: any[] = order?.fulfillments ?? [];

    const actions: { key: string; url: string; type: 'label' | 'track' }[] = [];
    for (const fulfillment of fulfillments) {
        const cf = fulfillment?.customFields ?? {};
        if (cf.enviaLabelUrl) {
            actions.push({ key: `${fulfillment?.id}-label`, url: cf.enviaLabelUrl, type: 'label' });
        }
        if (cf.enviaTrackUrl) {
            actions.push({ key: `${fulfillment?.id}-track`, url: cf.enviaTrackUrl, type: 'track' });
        }
    }

    if (actions.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {actions.map(action => (
                <a
                    key={action.key}
                    href={action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                >
                    {action.type === 'label' ? <Printer className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                    {action.type === 'label' ? 'Imprimir guía' : 'Ver rastreo'}
                </a>
            ))}
        </div>
    );
}

EnviaShippingActions.displayName = 'EnviaShippingActions';
