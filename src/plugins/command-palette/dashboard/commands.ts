import type { LucideIcon } from 'lucide-react';
import {
    BarChart3, Bot, Boxes, Building2, Calculator, CircleUser, Clock, Cog, CreditCard, FileSpreadsheet, FolderTree, Globe, Home, Image, Key, Lightbulb, ListChecks, Map, Network, Package, Percent, Receipt, Settings, Shield, ShoppingCart, SlidersHorizontal, Sparkles, Star, Store, Tags, TrendingUp, Truck, UserCog, Users, UsersRound, Wallet, Warehouse,
} from 'lucide-react';

export interface Command {
    id: string;
    icon: LucideIcon;
    label: string;
    keywords: string[];
    path: string;
    section: string;
}

const SECTIONS = [
    'Inicio',
    'Catálogo',
    'Ventas',
    'Clientes',
    'Marketing',
    'Configuración',
    'Sistema',
    'Perfil',
    'Acciones',
] as const;

export type CommandSection = (typeof SECTIONS)[number];

export const ALL_COMMANDS: Command[] = [
    {
        id: 'dashboard',
        icon: Home,
        label: 'Inicio',
        keywords: ['inicio', 'home', 'panel', 'principal', 'dashboard', 'perspectivas'],
        path: '/',
        section: 'Inicio',
    },
    {
        id: 'products',
        icon: Package,
        label: 'Productos',
        keywords: ['producto', 'listado', 'catalogo', 'inventario'],
        path: '/products',
        section: 'Catálogo',
    },
    {
        id: 'product-variants',
        icon: Boxes,
        label: 'Variantes de Producto',
        keywords: ['variante', 'sku', 'precio', 'stock'],
        path: '/product-variants',
        section: 'Catálogo',
    },
    {
        id: 'option-groups',
        icon: SlidersHorizontal,
        label: 'Grupos de Opciones',
        keywords: ['opcion', 'atributo', 'talla', 'color', 'tamano'],
        path: '/option-groups',
        section: 'Catálogo',
    },
    {
        id: 'facets',
        icon: Tags,
        label: 'Facetas',
        keywords: ['filtro', 'categoria', 'etiqueta', 'tag'],
        path: '/facets',
        section: 'Catálogo',
    },
    {
        id: 'collections',
        icon: FolderTree,
        label: 'Colecciones',
        keywords: ['coleccion', 'agrupacion', 'categoria'],
        path: '/collections',
        section: 'Catálogo',
    },
    {
        id: 'assets',
        icon: Image,
        label: 'Archivos',
        keywords: ['asset', 'imagen', 'imagenes', 'foto', 'multimedia'],
        path: '/assets',
        section: 'Catálogo',
    },
    {
        id: 'reviews',
        icon: Star,
        label: 'Reviews',
        keywords: ['resena', 'opinion', 'comentario', 'valoracion', 'calificacion'],
        path: '/reviews',
        section: 'Catálogo',
    },
    {
        id: 'ai-chat',
        icon: Bot,
        label: 'Asistente IA',
        keywords: ['ia', 'inteligencia', 'artificial', 'chat', 'simetria', 'ayuda'],
        path: '/ai-chat',
        section: 'Catálogo',
    },
    {
        id: 'excel-product-import',
        icon: FileSpreadsheet,
        label: 'Importar Productos (Excel)',
        keywords: ['excel', 'importar', 'cargar', 'masivo', 'xlsx', 'hoja', 'calculo'],
        path: '/excel-product-import',
        section: 'Catálogo',
    },
    {
        id: 'orders',
        icon: ShoppingCart,
        label: 'Pedidos',
        keywords: ['orden', 'venta', 'compra', 'factura'],
        path: '/orders',
        section: 'Ventas',
    },
    {
        id: 'metrics',
        icon: BarChart3,
        label: 'Métricas Avanzadas',
        keywords: ['analisis', 'estadistica', 'reporte', 'grafico', 'dashboard'],
        path: '/metrics',
        section: 'Ventas',
    },
    {
        id: 'customers',
        icon: Users,
        label: 'Clientes',
        keywords: ['cliente', 'comprador', 'usuario', 'persona'],
        path: '/customers',
        section: 'Clientes',
    },
    {
        id: 'customer-groups',
        icon: UsersRound,
        label: 'Grupos de Clientes',
        keywords: ['grupo', 'segmento', 'clasificacion'],
        path: '/customer-groups',
        section: 'Clientes',
    },
    {
        id: 'promotions',
        icon: Percent,
        label: 'Promociones',
        keywords: ['promocion', 'descuento', 'oferta', 'cupon'],
        path: '/promotions',
        section: 'Marketing',
    },
    {
        id: 'sellers',
        icon: Store,
        label: 'Vendedores',
        keywords: ['vendedor', 'tienda', 'seller', 'comerciante'],
        path: '/sellers',
        section: 'Configuración',
    },
    {
        id: 'channels',
        icon: Network,
        label: 'Canales',
        keywords: ['canal', 'multitienda', 'multi'],
        path: '/channels',
        section: 'Configuración',
    },
    {
        id: 'stock-locations',
        icon: Warehouse,
        label: 'Ubicaciones de Stock',
        keywords: ['stock', 'bodega', 'almacen', 'inventario', 'ubicacion'],
        path: '/stock-locations',
        section: 'Configuración',
    },
    {
        id: 'administrators',
        icon: UserCog,
        label: 'Administradores',
        keywords: ['admin', 'administrador', 'usuario', 'acceso'],
        path: '/administrators',
        section: 'Configuración',
    },
    {
        id: 'roles',
        icon: Shield,
        label: 'Roles',
        keywords: ['rol', 'permiso', 'acceso', 'autorizacion'],
        path: '/roles',
        section: 'Configuración',
    },
    {
        id: 'shipping-methods',
        icon: Truck,
        label: 'Métodos de Envío',
        keywords: ['envio', 'domicilio', 'entrega', 'mensajeria', 'shipping'],
        path: '/shipping-methods',
        section: 'Configuración',
    },
    {
        id: 'payment-methods',
        icon: CreditCard,
        label: 'Métodos de Pago',
        keywords: ['pago', 'pagos', 'wompi', 'tarjeta', 'bancolombia', 'nequi'],
        path: '/payment-methods',
        section: 'Configuración',
    },
    {
        id: 'tax-categories',
        icon: Receipt,
        label: 'Categorías de Impuestos',
        keywords: ['impuesto', 'iva', 'categoria', 'tax'],
        path: '/tax-categories',
        section: 'Configuración',
    },
    {
        id: 'tax-rates',
        icon: Calculator,
        label: 'Tasas de Impuestos',
        keywords: ['tasa', 'iva', 'porcentaje', 'impuesto'],
        path: '/tax-rates',
        section: 'Configuración',
    },
    {
        id: 'countries',
        icon: Globe,
        label: 'Países',
        keywords: ['pais', 'paises', 'colombia', 'nacionalidad'],
        path: '/countries',
        section: 'Configuración',
    },
    {
        id: 'zones',
        icon: Map,
        label: 'Zonas',
        keywords: ['zona', 'region', 'departamento', 'ciudad'],
        path: '/zones',
        section: 'Configuración',
    },
    {
        id: 'global-settings',
        icon: Settings,
        label: 'Configuración Global',
        keywords: ['global', 'general', 'sistema', 'config'],
        path: '/global-settings',
        section: 'Configuración',
    },
    {
        id: 'feedback',
        icon: Lightbulb,
        label: 'Cocreativo',
        keywords: ['cocreativo', 'cocreacion', 'roadmap', 'ideas', 'feedback', 'opinion', 'sugerencia', 'votar'],
        path: '/cocreativo',
        section: 'Configuración',
    },
    {
        id: 'billing',
        icon: Wallet,
        label: 'Facturación y Plan',
        keywords: ['factura', 'plan', 'suscripcion', 'pago', 'billing', 'cobro'],
        path: '/billing',
        section: 'Configuración',
    },
    {
        id: 'store-management',
        icon: Building2,
        label: 'Tiendas',
        keywords: ['tienda', 'store', 'vendedor', 'listado'],
        path: '/stores',
        section: 'Configuración',
    },
    {
        id: 'store-analytics',
        icon: TrendingUp,
        label: 'Analíticas de Tiendas',
        keywords: ['analitica', 'tienda', 'reporte', 'estadistica', 'vendedor'],
        path: '/store-analytics',
        section: 'Configuración',
    },
    {
        id: 'job-queue',
        icon: ListChecks,
        label: 'Cola de Trabajos',
        keywords: ['trabajo', 'job', 'cola', 'proceso', 'tarea'],
        path: '/job-queue',
        section: 'Sistema',
    },
    {
        id: 'scheduled-tasks',
        icon: Clock,
        label: 'Tareas Programadas',
        keywords: ['tarea', 'programada', 'cron', 'automatico', 'scheduler'],
        path: '/scheduled-tasks',
        section: 'Sistema',
    },
    {
        id: 'settings-store',
        icon: Cog,
        label: 'Configuración de Tienda',
        keywords: ['config', 'tienda', 'ajustes', 'store', 'settings'],
        path: '/settings-store',
        section: 'Sistema',
    },
    {
        id: 'api-keys',
        icon: Key,
        label: 'API Keys',
        keywords: ['api', 'key', 'llave', 'token', 'acceso', 'integracion'],
        path: '/api-keys',
        section: 'Sistema',
    },
    {
        id: 'profile',
        icon: CircleUser,
        label: 'Mi Perfil',
        keywords: ['perfil', 'usuario', 'cuenta', 'ajustes', 'personal'],
        path: '/profile',
        section: 'Perfil',
    },
    {
        id: 'ask-ai',
        icon: Sparkles,
        label: 'Preguntar a SimetrIA',
        keywords: ['ia', 'simetria', 'preguntar', 'ayuda', 'duda', 'consulta', 'chat', 'gpt', 'inteligencia', 'artificial'],
        path: '',
        section: 'Acciones',
    },
];

export const SECTION_LABELS: Record<string, string> = {
    'Inicio': 'Inicio',
    'Catálogo': 'Catálogo',
    'Ventas': 'Ventas',
    'Clientes': 'Clientes',
    'Marketing': 'Marketing',
    'Configuración': 'Configuración',
    'Sistema': 'Sistema',
    'Perfil': 'Perfil',
    'Acciones': 'Acciones',
};

export const RESTRICTED_COMMAND_IDS = [
    'sellers',
    'channels',
    'administrators',
    'roles',
    'countries',
    'zones',
    'global-settings',
    'store-management',
    'store-analytics',
    'shipping-methods',
    'tax-categories',
    'tax-rates',
    'job-queue',
    'scheduled-tasks',
    'settings-store',
    'api-keys',
];

export function getCommandsBySection(): Record<string, Command[]> {
    const grouped: Record<string, Command[]> = {};
    for (const cmd of ALL_COMMANDS) {
        if (!grouped[cmd.section]) {
            grouped[cmd.section] = [];
        }
        grouped[cmd.section].push(cmd);
    }
    return grouped;
}
