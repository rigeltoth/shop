import { useChannel, Button, Tooltip, TooltipContent, TooltipTrigger } from '@vendure/dashboard';
import { CheckCheck, Share2, Store, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import type { PageContextValue } from '@vendure/dashboard';

function getStoreFrontendUrl(): string {
    const origin = window.location.origin;
    return origin.replace(/^https?:\/\/admin[-.]/, 'https://');
}

const STOREFRONT_URL = typeof window !== 'undefined' ? getStoreFrontendUrl() : 'https://ecommer.shop';

export function ShareProductButton({ context }: { context: PageContextValue }) {
    const { activeChannel } = useChannel();
    const [copiedProduct, setCopiedProduct] = useState(false);
    const [copiedStore, setCopiedStore] = useState(false);

    if (!context?.entity) {
        return null;
    }

    const slug = (context?.entity as any)?.slug;
    const storeCode = activeChannel?.code;

    const handleCopyProduct = async () => {
        try {
            const productLink = slug
                ? `${STOREFRONT_URL}/es/product/${slug}`
                : window.location.href;
            await navigator.clipboard.writeText(productLink);
            toast.success("Enlace del producto copiado");
            
            (window as any).dataLayer = (window as any).dataLayer || [];
            (window as any).dataLayer.push({
                event: 'seller_share_link',
                seller_id: storeCode || 'unknown',
                share_type: 'copy_product_link'
            });

            setCopiedProduct(true);
            setTimeout(() => setCopiedProduct(false), 2000);
        } catch {
            toast.error('Error al copiar el enlace');
        }
    };

    const handleCopyStore = async () => {
        try {
            const storeLink = storeCode
                ? `${STOREFRONT_URL}/es/store/${storeCode}`
                : null;
            if (!storeLink) {
                toast.error('No se pudo generar el enlace de la tienda');
                return;
            }
            await navigator.clipboard.writeText(storeLink);
            toast.success("Enlace de la tienda copiado");

            (window as any).dataLayer = (window as any).dataLayer || [];
            (window as any).dataLayer.push({
                event: 'seller_share_link',
                seller_id: storeCode || 'unknown',
                share_type: 'copy_store_link'
            });

            setCopiedStore(true);
            setTimeout(() => setCopiedStore(false), 2000);
        } catch {
            toast.error('Error al copiar el enlace');
        }
    };

    const handleDownloadQR = () => {
        const slugFromEntity = (context?.entity as any)?.slug ?? '';
        const imageUrl = (context?.entity as any)?.featuredAsset?.preview 
            ?? (context?.entity as any)?.assets?.[0]?.preview 
            ?? null;
        
        const base = `${STOREFRONT_URL}/api/product-qr`;
        const params = new URLSearchParams({ slug: slugFromEntity });
        if (imageUrl) params.set("image", imageUrl);

        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).dataLayer.push({
            event: "seller_share_link",
            seller_id: storeCode || "unknown",
            share_type: "download_qr"
        });

        window.open(`${base}?${params.toString()}`, "_blank");
    };

    return (
        <>
            <Tooltip>
                <TooltipTrigger render={
                    <Button type="button" variant="outline" onClick={handleCopyProduct}>
                        {copiedProduct
                            ? <CheckCheck className="mr-2 h-4 w-4" />
                            : <Share2 className="mr-2 h-4 w-4" />
                        }
                        Compartir Producto
                    </Button>
                } />
                <TooltipContent>
                    <p>Comparte el enlace público de este producto</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger render={
                    <Button type="button" variant="outline" onClick={handleCopyStore}>
                        {copiedStore
                            ? <CheckCheck className="mr-2 h-4 w-4" />
                            : <Store className="mr-2 h-4 w-4" />
                        }
                        Compartir Tienda
                    </Button>
                } />
                <TooltipContent>
                    <p>Comparte el enlace público de tu tienda</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger render={
                    <Button type="button" variant="outline" onClick={handleDownloadQR}>
                        <Download className="mr-2 h-4 w-4" />
                        Descargar QR
                    </Button>
                } />
                <TooltipContent>
                    <p>Descarga el código QR de este producto</p>
                </TooltipContent>
            </Tooltip>
        </>
    );
}