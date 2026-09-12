import { defineDashboardExtension } from '@vendure/dashboard';
import { LoginMarketingPage } from './marketing/LoginMarketingPage';
import { LoginLogo } from './components/LoginLogo';
import { DeleteAccountSection } from './components/DeleteAccountSection';
import VerifySellerEmailPage from './components/VerifySellerEmailPage';
import { SocialLinksSection } from '../../store-page/dashboard/social-links-section';
import { SubscriptionAlertSection } from '../../wompi-subscription/dashboard/subscription-alert';

defineDashboardExtension({
    routes: [{
        path: '/login-custom',
        authenticated: false,
        component: () => {
            return <LoginMarketingPage />;
        }
    }, {
        path: '/verify-email',
        authenticated: false,
        component: () => {
            return <VerifySellerEmailPage />;
        }
    }],

    // Inject into the default `/login` page. LoginMarketingPage renders a
    // fixed full-viewport overlay (see its own docblock for why not a portal),
    // so it fully replaces what's rendered by the logo/beforeForm slots below —
    // they're kept only as a non-flashing fallback for the initial paint.
    login: {
        logo: {
            component: LoginLogo,
        },
        beforeForm: {
            component: () => (
                <div className="flex flex-col items-center text-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Bienvenido a Ecommer</h1>
                    <p className="text-sm text-muted-foreground">Inicia sesión para acceder al panel de administración</p>
                </div>
            ),
        },
        afterForm: {
            component: () => {
                return <LoginMarketingPage />;
            },
        },
    },

    pageBlocks: [
        {
            id: 'subscription-alert-section',
            location: {
                pageId: 'profile',
                column: 'main',
                position: { blockId: 'custom-fields', order: 'before' },
            },
            component: SubscriptionAlertSection,
        },
        {
            id: 'social-links-section',
            location: {
                pageId: 'profile',
                column: 'main',
                position: { blockId: 'custom-fields', order: 'after' },
            },
            component: SocialLinksSection,
        },
        {
            id: 'delete-account-section',
            location: {
                pageId: 'profile',
                column: 'main',
                position: { blockId: 'custom-fields', order: 'after' },
            },
            component: DeleteAccountSection,
            shouldRender: () => {
                if (typeof window === 'undefined') return false;
                return localStorage.getItem('ecommer.isSuperAdmin') !== 'true';
            },
        },
    ],
});