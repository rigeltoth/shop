import { defineDashboardExtension } from '@vendure/dashboard';
import { ShippingMethodsPage } from './shipping-methods-page';

export default defineDashboardExtension({
    routes: [
        {
            path: '/seller-shipping-methods',
            loader: () => ({ breadcrumb: 'Métodos de envío' }),
            navMenuItem: {
                id: 'seller-shipping-methods',
                sectionId: 'settings',
                title: 'Métodos de envío',
                url: '/seller-shipping-methods',
            },
            component: () => <ShippingMethodsPage />,
        },
    ],
});
