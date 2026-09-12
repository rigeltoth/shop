import { useState, useEffect } from 'react';
import { Card, CardContent } from '@vendure/dashboard';
import { Sparkles } from 'lucide-react';
import { gql, MY_BIFROST_USAGE_QUERY } from '../graphql-queries';

interface BifrostUsage {
    usagePercent: number;
}

function percentColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-yellow-500';
    return 'bg-blue-500';
}

export function AiUsageCard() {
    const [usage, setUsage] = useState<BifrostUsage | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        gql<{ myBifrostKeyUsage: { usage: BifrostUsage } | null }>(MY_BIFROST_USAGE_QUERY)
            .then(d => setUsage(d.myBifrostKeyUsage?.usage ?? null))
            .catch(() => setUsage(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return null;
    }

    if (!usage) {
        return null;
    }

    const pct = Math.min(Math.max(usage.usagePercent ?? 0, 0), 100);

    return (
        <Card>
            <CardContent className="py-4 space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Consumo IA
                </h4>
                <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Uso mensual</span>
                        <span className="font-medium">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${percentColor(pct)}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {pct >= 90
                            ? 'Estás cerca del límite de tu plan'
                            : pct >= 70
                                ? 'Has consumido gran parte de tu plan'
                                : 'Consumo dentro de tu plan'}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
