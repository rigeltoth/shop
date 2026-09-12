import { HeroSection } from './sections/HeroSection';
import { AdminCapabilitiesSection } from './sections/AdminCapabilitiesSection';
import { SimetriaSection } from './sections/SimetriaSection';
import { MiTiendaSection } from './sections/MiTiendaSection';
import { PlanesSection } from './sections/PlanesSection';
import { FacturacionSection } from './sections/FacturacionSection';
import { PagosSection } from './sections/PagosSection';
import { EcosistemaSection } from './sections/EcosistemaSection';
import { FaqSection } from './sections/FaqSection';

/**
 * Vendure's native /login route hardcodes a narrow centered column
 * (max-w-sm md:max-w-md) around whatever the login extension slots render.
 * A full SaaS-style landing page doesn't fit in that column, but it doesn't
 * need a portal to escape it either: `fixed inset-0` already positions
 * relative to the viewport, ignoring the ancestor's width constraint.
 *
 * A createPortal(..., document.body) approach was tried first, but React 19
 * delegates events at the root container it was mounted on (not `document`),
 * so a node portaled to `document.body` sits outside that container's DOM
 * subtree and never receives bubbled clicks — every onClick in the page went
 * dead. Plain `fixed` positioning stays in the React tree (event delegation
 * keeps working) while still visually replacing the native narrow card.
 */
export function LoginMarketingPage() {
    return (
        <div className="fixed inset-0 z-[999] overflow-y-auto bg-white dark:bg-[#0c0c2a] text-foreground font-body">
            <HeroSection />
            <AdminCapabilitiesSection />
            <SimetriaSection />
            <MiTiendaSection />
            <PlanesSection />
            <FacturacionSection />
            <PagosSection />
            <EcosistemaSection />
            <FaqSection />
        </div>
    );
}
