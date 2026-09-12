import { defineDashboardExtension } from '@vendure/dashboard';
import { PayoutListPage } from './pages/payout-list';
import { PayoutNewPage } from './pages/payout-new';
import { PayoutDetailPage } from './pages/payout-detail';
import { PayoutSellersPage } from './pages/payout-sellers';
import { PayoutSellerDetailPage } from './pages/payout-seller-detail';

export default defineDashboardExtension({
    routes: [
        {
            path: '/payouts',
            loader: () => ({ breadcrumb: 'Liquidaciones' }),
            navMenuItem: {
                id: 'payouts',
                sectionId: 'settings',
                title: 'Dispersiones',
                url: '/payouts',
                requiresPermission: ['SuperAdmin'],
            },
            component: (route: any) => <PayoutListPage route={route} />,
        },
        {
            path: '/payouts/new',
            loader: () => ({ breadcrumb: 'Nueva liquidación' }),
            component: () => <PayoutNewPage />,
        },
        {
            path: '/payouts/$id',
            loader: () => ({ breadcrumb: 'Detalle de liquidación' }),
            component: (route: any) => <PayoutDetailPage route={route} />,
        },
        {
            path: '/payout-sellers',
            loader: () => ({ breadcrumb: 'Pagos por vendedor' }),
            navMenuItem: {
                id: 'payout-sellers',
                sectionId: 'settings',
                title: 'Pagos por vendedor',
                url: '/payout-sellers',
                requiresPermission: ['SuperAdmin'],
            },
            component: () => <PayoutSellersPage />,
        },
        {
            path: '/payout-sellers/$sellerId',
            loader: () => ({ breadcrumb: 'Detalle de vendedor' }),
            component: (route: any) => <PayoutSellerDetailPage route={route} />,
        },
    ],
});
