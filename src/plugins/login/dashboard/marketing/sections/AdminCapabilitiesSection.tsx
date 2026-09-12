import { Package, Layers, Tags, BarChart3 } from 'lucide-react';
import { SectionShell } from '../SectionShell';

const CAPABILITIES = [
    {
        icon: Package,
        title: 'Productos',
        description: 'Publica y organiza tu catálogo completo, con fotos, descripciones y precios.',
    },
    {
        icon: Layers,
        title: 'Variantes',
        description: 'Maneja tallas, colores y presentaciones sin crear un producto distinto por cada una.',
    },
    {
        icon: Tags,
        title: 'Facetas',
        description: 'Clasifica tu catálogo para que tus clientes encuentren lo que buscan más rápido.',
    },
    {
        icon: BarChart3,
        title: 'Métricas',
        description: 'Revisa el desempeño de tu tienda y tus ventas para tomar mejores decisiones.',
    },
];

export function AdminCapabilitiesSection() {
    return (
        <SectionShell
            eyebrow="El Admin"
            title="Todo lo que puedes hacer dentro del Admin"
            subtitle="Un solo panel para crear tu catálogo, entender tus ventas y administrar tu negocio de principio a fin."
        >
            <div className="flex gap-6 overflow-x-auto snap-x snap-proximity pb-2">
                {CAPABILITIES.map(({ icon: Icon, title, description }) => (
                    <div
                        key={title}
                        className="shrink-0 snap-start w-64 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 flex flex-col gap-3"
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
