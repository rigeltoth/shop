import { defineDashboardExtension, DashboardRouteDefinition } from '@vendure/dashboard';
import { AiChatPage } from './AiChatPage';
import { AiChatFabTrigger } from './AiChatFabTrigger';
import { HomeHeroWidget } from './HomeHeroWidget';
import { showOnlyForSuperAdmin } from '../../superadminvisibility/dashboard/hooks';

const aiChatRoute: DashboardRouteDefinition = {
    path: '/ai-chat',
    loader: () => ({ breadcrumb: 'Asistente IA' }),
    navMenuItem: {
        id: 'ai-chat',
        sectionId: 'catalog',
        title: 'Asistente IA',
        url: '/ai-chat',
    },
    component: () => <AiChatPage />,
};

export default defineDashboardExtension({
    routes: [aiChatRoute],
    widgets: [
        {
            id: 'ecommer-home-hero',
            name: 'Bienvenida y acciones rápidas',
            component: HomeHeroWidget,
            defaultSize: { w: 12, h: 8, x: 0, y: 0 },
            minSize: { w: 8, h: 4 },
            maxSize: { w: 12, h: 12 },
            shouldRender: showOnlyForSuperAdmin,
        },
    ],
    toolbarItems: [
        {
            id: 'ai-chat-trigger',
            component: AiChatFabTrigger,
            shouldRender: showOnlyForSuperAdmin,
        },
    ],
});