import { SectionShell } from '../SectionShell';

// Espejo de los datos reales del backend (no se pueden consultar antes de
// iniciar sesión: billingInvoicePlans y myBillingPlanState requieren
// Permission.Authenticated). Mantener sincronizado manualmente con:
// - src/plugins/invoice-client/services/billing-plans.service.ts (paquetes)
// - src/plugins/invoice-client/dashboard/billing-plans-page.tsx (precio del certificado)
const CERT_ANNUAL_PRICE_COP = 199_000;

type InvoicePackage = {
    code: string;
    name: string;
    invoices: number;
    priceCop: number;
    detailLine?: string;
};

const CERTIFICATE_PLAN: InvoicePackage = {
    code: 'certificate-annual',
    name: 'Certificado anual',
    invoices: 0,
    priceCop: CERT_ANNUAL_PRICE_COP,
    detailLine: 'Pago único anual del certificado de facturación DIAN',
};

const INVOICE_PACKAGES: InvoicePackage[] = [
    { code: 'starter', name: 'Starter', invoices: 10, priceCop: 4_000 },
    { code: 'plus', name: 'Plus', invoices: 20, priceCop: 6_000 },
    { code: 'pro', name: 'Pro', invoices: 50, priceCop: 10_000 },
    { code: 'pyme', name: 'Pyme', invoices: 100, priceCop: 18_000 },
    { code: 'business', name: 'Business', invoices: 200, priceCop: 32_000 },
    { code: 'elite', name: 'Elite', invoices: 500, priceCop: 70_000 },
    { code: 'infinity', name: 'Infinity', invoices: 1000, priceCop: 120_000 },
];

// Tarjeta propia (en vez de reutilizar InvoicePlanCard de invoice-client, que
// hardcodea un gradiente oscuro sin variantes de tema — se ve bien en el
// dashboard autenticado, que siempre es oscuro, pero rompe en modo claro
// aquí). Solo lo que distingue a cada paquete (nombre, cantidad, precio):
// lo que comparten todos los paquetes se dice una sola vez, en el texto de
// la sección, no repetido tarjeta por tarjeta.
function InvoicePackageCard({ plan }: { plan: InvoicePackage }) {
    return (
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 flex flex-col gap-4">
            <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{plan.name}</p>
                {plan.invoices > 0 ? (
                    <>
                        <p className="mt-1 text-3xl font-extrabold text-brand">{plan.invoices}</p>
                        <p className="text-xs text-muted-foreground">facturas en el paquete</p>
                    </>
                ) : (
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{plan.detailLine}</p>
                )}
            </div>

            <div className="text-center border-t border-black/10 dark:border-white/10 pt-4">
                <span className="text-2xl font-extrabold text-foreground">${plan.priceCop.toLocaleString('es-CO')}</span>
                <span className="text-sm text-muted-foreground"> COP</span>
            </div>
        </div>
    );
}

export function FacturacionSection() {
    return (
        <SectionShell
            eyebrow="Facturación electrónica"
            title="Factura electrónica, sin complicarte"
            subtitle="No es obligatorio para empezar a vender, pero si tu negocio lo necesita, Ecommer lo integra directo con la DIAN."
        >
            <p className="mb-10 text-sm text-muted-foreground">
                ¿Cuándo la necesitas? Es obligatoria para <strong className="text-foreground">personas jurídicas</strong>;
                opcional si eres <strong className="text-foreground">persona natural</strong> no responsable de IVA.
            </p>

            <div className="mb-6 max-w-xs">
                <InvoicePackageCard plan={CERTIFICATE_PLAN} />
            </div>

            <p className="text-sm text-muted-foreground mb-4">
                Con el certificado activo, compras paquetes de facturas según tu volumen de ventas.{' '}
                <strong className="text-foreground">Ningún paquete vence</strong> — se descuentan solo al
                emitir — y todos usan <strong className="text-foreground">facturación electrónica Matias</strong>.
            </p>
            <div className="flex gap-4 overflow-x-auto snap-x snap-proximity pt-1 pb-2">
                {INVOICE_PACKAGES.map(plan => (
                    <div key={plan.code} className="shrink-0 snap-start w-52">
                        <InvoicePackageCard plan={plan} />
                    </div>
                ))}
            </div>
        </SectionShell>
    );
}
