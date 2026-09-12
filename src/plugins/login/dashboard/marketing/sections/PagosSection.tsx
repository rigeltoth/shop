import { CreditCard, Clock, ShieldCheck } from 'lucide-react';
import { SectionShell } from '../SectionShell';

const POINTS = [
    {
        icon: CreditCard,
        title: 'Wompi procesa el pago',
        description: 'Tus clientes pagan con tarjeta, PSE o corresponsales a través de Wompi (Bancolombia), con antifraude integrado.',
    },
    {
        icon: Clock,
        title: 'Recibes el dinero cada 15 días',
        description: 'Si usas Nequi, Bancolombia o un banco con llave BRE-B registrada, no hay costos adicionales por el giro.',
    },
    {
        icon: ShieldCheck,
        title: 'Tu dinero está protegido',
        description: 'Wompi monitorea los pagos 24/7 y solo se retira con una segunda clave, con protección ante reclamos y contracargos.',
    },
];

export function PagosSection() {
    return (
        <SectionShell
            eyebrow="Pagos"
            title="Así reciben el dinero los vendedores"
            subtitle="La pasarela de pagos cobra una comisión por transacción; el resto se gira directo a tu cuenta."
            tone="muted"
        >
            <div className="flex gap-6 overflow-x-auto snap-x snap-proximity pb-2">
                {POINTS.map(({ icon: Icon, title, description }) => (
                    <div
                        key={title}
                        className="shrink-0 snap-start w-72 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 flex flex-col gap-3"
                    >
                        <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-brand" />
                        </div>
                        <h3 className="font-heading font-bold text-foreground">{title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                    </div>
                ))}
            </div>
        </SectionShell>
    );
}
