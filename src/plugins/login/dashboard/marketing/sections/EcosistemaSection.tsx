import { LayoutDashboard, Store, ArrowRight } from 'lucide-react';
import { SectionShell } from '../SectionShell';

export function EcosistemaSection() {
    return (
        <SectionShell
            eyebrow="El ecosistema"
            title="Dos ambientes, un solo negocio"
            subtitle="Todo lo que haces en el Admin se refleja automáticamente en tu Tienda — no hay que sincronizar nada a mano."
        >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 flex flex-col gap-3">
                    <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center">
                        <LayoutDashboard className="h-5 w-5 text-brand" />
                    </div>
                    <h3 className="font-heading font-bold text-foreground">Administrador (Admin)</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Donde trabajas: creas productos, variantes y facetas, analizas tus métricas con
                        ayuda de SimetrIA y administras tu negocio de principio a fin. Es la pantalla en
                        la que estás ahora mismo.
                    </p>
                </div>

                <div className="flex md:flex-col items-center justify-center text-brand">
                    <ArrowRight className="h-6 w-6 rotate-90 md:rotate-0" />
                </div>

                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 flex flex-col gap-3">
                    <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center">
                        <Store className="h-5 w-5 text-brand" />
                    </div>
                    <h3 className="font-heading font-bold text-foreground">Tienda</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Donde te compran: los productos que publicas en el Admin aparecen automáticamente
                        en tu tienda pública, para que tus clientes la visiten, consulten la información y
                        realicen sus compras.
                    </p>
                </div>
            </div>
        </SectionShell>
    );
}
