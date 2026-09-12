import { defineDashboardExtension } from '@vendure/dashboard';
import { EnviaLabelUrlDisplay } from './envia-label-url-display';
import { EnviaTrackUrlDisplay } from './envia-track-url-display';
import { EnviaShippingActions } from './envia-shipping-actions';

export default defineDashboardExtension({
    customFormComponents: {
        customFields: [
            { id: 'ecommer-envia-label-url', component: EnviaLabelUrlDisplay },
            { id: 'ecommer-envia-track-url', component: EnviaTrackUrlDisplay },
        ],
    },
    pageBlocks: [
        {
            id: 'envia-shipping-actions',
            title: 'Envío',
            location: {
                pageId: 'seller-order-detail',
                column: 'main',
                position: { blockId: 'payment-details', order: 'before' },
            },
            component: EnviaShippingActions,
        },
    ],
});
