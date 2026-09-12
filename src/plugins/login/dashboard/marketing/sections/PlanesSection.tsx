import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { SectionShell } from '../SectionShell';

type PlanFeature = {
    feature: { code: string; name: string };
    value: string;
};

type Plan = {
    id: string;
    name: string;
    price: number;
    description: string | null;
    planFeatures: PlanFeature[];
};

function featureValue(plan: Plan, code: string): string | undefined {
    return plan.planFeatures.find(pf => pf.feature.code === code)?.value;
}

function planHighlights(plan: Plan): string[] {
    const maxProducts = featureValue(plan, 'max_products');
    const maxVariations = featureValue(plan, 'max_variations');
    const aiAccess = featureValue(plan, 'ai_access') === 'true';
    const electronicBilling = featureValue(plan, 'electronic_billing') === 'true';

    const items: string[] = [];
    if (maxProducts) items.push(`${Number(maxProducts).toLocaleString('es-CO')} productos`);
    if (maxVariations) items.push(`${Number(maxVariations).toLocaleString('es-CO')} variantes`);
    items.push(aiAccess ? 'Acceso a SimetrIA' : 'Sin acceso a SimetrIA');
    if (electronicBilling) items.push('Facturación electrónica habilitada');
    return items;
}

function formatPrice(price: number): string {
    if (price === 0) return 'Gratis / para siempre';
    return `$${price.toLocaleString('es-CO')} COP /mes`;
}

export function PlanesSection() {
    const [plans, setPlans] = useState<Plan[] | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const adminApiUrl = `${window.location.origin}/admin-api`;
        fetch(adminApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                query: `
                    query AllPlans {
                        allPlans {
                            id
                            name
                            price
                            description
                            planFeatures {
                                value
                                feature { code name }
                            }
                        }
                    }
                `,
            }),
        })
            .then(res => res.json())
            .then(result => {
                if (result.errors?.length || !result.data?.allPlans) {
                    setError(true);
                    return;
                }
                setPlans(result.data.allPlans);
            })
            .catch(() => setError(true));
    }, []);

    // El plan "más popular" es el más barato entre los que incluyen SimetrIA
    // (la entrada al primer plan de pago real), no un umbral de precio fijo.
    const popularPlanId = plans
        ?.filter(p => featureValue(p, 'ai_access') === 'true')
        .sort((a, b) => a.price - b.price)[0]?.id;

    return (
        <SectionShell
            eyebrow="Planes"
            title="Planes diseñados para escalar"
            subtitle="Sin comisiones ocultas. Empieza gratis y sube de plan cuando tu negocio lo necesite."
            tone="muted"
        >
            {error && (
                <p className="text-sm text-muted-foreground">
                    No pudimos cargar los planes en este momento. Inicia sesión para verlos en tu panel.
                </p>
            )}

            {!error && !plans && (
                <p className="text-sm text-muted-foreground">Cargando planes...</p>
            )}

            {!error && plans && (
                <div className="flex gap-6 overflow-x-auto snap-x snap-proximity pt-4 pb-2">
                    {plans.map(plan => {
                        const popular = plan.id === popularPlanId;
                        return (
                            <div
                                key={plan.id}
                                className={
                                    popular
                                        ? 'shrink-0 snap-start w-80 relative rounded-2xl p-6 flex flex-col border-2 border-brand bg-white dark:bg-white/5 shadow-lg'
                                        : 'shrink-0 snap-start w-80 relative rounded-2xl p-6 flex flex-col border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03]'
                                }
                            >
                                {popular && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                                        MÁS POPULAR
                                    </span>
                                )}
                                <h3 className="font-heading text-lg font-bold text-foreground mb-1">{plan.name}</h3>
                                <p className="text-2xl font-extrabold text-foreground mb-1">{formatPrice(plan.price)}</p>
                                {plan.description && (
                                    <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                                )}
                                <ul className="space-y-2 mt-2">
                                    {planHighlights(plan).map(item => (
                                        <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Check className="h-4 w-4 text-brand shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}
        </SectionShell>
    );
}
