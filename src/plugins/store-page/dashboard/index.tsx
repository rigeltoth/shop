import { defineDashboardExtension, DropdownMenuItem, useChannel } from '@vendure/dashboard';
import { Share2 } from 'lucide-react';
import ProductTracker from '@/plugins/login/dashboard/components/ProductTracker';
import { toast } from 'sonner';
import { useState } from 'react';
import SellerFirstSaleTracker from '@/plugins/login/dashboard/components/SellerFirstSaleTracker';
import { StoreBannerAssetPickerInput } from './store-banner-asset-picker-input';
import { StoreFeaturedStarInput } from './store-featured-star-input';
import { StorePickupMapPreviewInput } from './store-pickup-map-preview-input';
import { StorePickupAddressInput } from './store-pickup-address-input';
import { ShareProductButton } from './share-product-button';
import { SlugShareDisplay } from './slug-share-display';
import { ShareLinksWidget } from './share-links-widget';

defineDashboardExtension({
    routes: [],
    customFormComponents: {
        customFields: [
            { id: 'ecommer-store-featured-star', component: StoreFeaturedStarInput },
            { id: 'ecommer-store-logo-asset-picker', component: StoreBannerAssetPickerInput },
            { id: 'ecommer-store-header-banner-asset-picker', component: StoreBannerAssetPickerInput },
            { id: 'ecommer-store-banner-asset-picker', component: StoreBannerAssetPickerInput },
            { id: 'ecommer-store-pickup-map-preview', component: StorePickupMapPreviewInput },
            { id: 'ecommer-store-pickup-address-input', component: StorePickupAddressInput },
        ],
    },
    actionBarItems: [
        {
            id: 'ecommer-share-product',
            pageId: 'product-detail',
            component: ShareProductButton,
            type: 'button',
        },
        {
            id: 'ecommer-share-product-dropdown',
            pageId: 'product-detail',
            component: ShareProductDropdownItem,
            type: 'dropdown',
        },
        {
            id: 'ecommer-product-tracker',
            pageId: 'product-detail',
            component: ProductTracker,
            type: 'button',
        },
        {
            id: 'ecommer-seller-first-sale-tracker',
            pageId: 'seller-order-detail',
            component: SellerFirstSaleTracker,
            type: 'button',
        },
    ],
    dataTables: [
        {
            pageId: 'product-list',
            displayComponents: [
                {
                    column: 'slug',
                    component: SlugShareDisplay,
                },
            ],
        },
    ],
    widgets: [
        {
            id: 'ecommer-share-links',
            name: 'Links para compartir',
            component: ShareLinksWidget,
            defaultSize: { w: 6, h: 4, x: 0, y: 9 },
            minSize: { w: 4, h: 3 },
            maxSize: { w: 6, h: 6 },
        },
    ],
});

import type { PageContextValue } from '@vendure/dashboard';

function ShareProductDropdownItem({ context }: { context: PageContextValue }) {
    const { activeChannel } = useChannel();

    if (!context?.entity) {
        return null;
    }

    const handleCopy = async () => {
        try {
            const slug = (context?.entity as any)?.slug;
            const productLink = slug
                ? `https://ecommer.shop/es/product/${slug}`
                : window.location.href;
            const storeLink = activeChannel?.code
                ? `https://ecommer.shop/es/store/${activeChannel.code}`
                : null;
            const text = [productLink, storeLink].filter(Boolean).join("\n");
            await navigator.clipboard.writeText(text);
            toast.success('Links copiados al portapapeles');
        } catch {
            toast.error('Error al copiar los links');
        }
    };

    return (
        <DropdownMenuItem onClick={handleCopy}>
            <Share2 className="mr-2 h-4 w-4" />
            Compartir
        </DropdownMenuItem>
    );
}
