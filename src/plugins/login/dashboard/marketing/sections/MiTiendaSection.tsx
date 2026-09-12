import { Store, Globe, ShoppingBag } from 'lucide-react';
import { SectionShell } from '../SectionShell';

const POINTS = [
    {
        icon: Store,
        title: 'Tu propia tienda',
        description: 'Cada vendedor de Ecommer tiene su propia tienda dentro de la plataforma, independiente de las demás.',
    },
    {
        icon: Globe,
        title: 'Tu propia página web',
        description: 'Esa tienda vive en su propia página pública, con tu nombre y tu catálogo, lista para compartir.',
    },
    {
        icon: ShoppingBag,
        title: 'Tus clientes compran ahí',
        description: 'Todo lo que publiques en el Admin aparece automáticamente en tu página: tus clientes ven la información y compran directo.',
    },
];

export function MiTiendaSection() {
    return (
        <SectionShell
            eyebrow="MiTienda"
            title="Cada vendedor tiene su propia tienda"
            subtitle="Lo que publicas en el Admin se refleja al instante en tu página pública, sin pasos adicionales."
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
