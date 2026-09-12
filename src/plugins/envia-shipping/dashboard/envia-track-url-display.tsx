import type { DashboardFormComponent } from '@vendure/dashboard';
import { Truck } from 'lucide-react';

export const EnviaTrackUrlDisplay: DashboardFormComponent = ({ value }) => {
    const url = typeof value === 'string' && value.trim() ? value : null;

    if (!url) {
        return <span className="text-sm text-muted-foreground">—</span>;
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
        >
            <Truck className="h-4 w-4" />
            Ver rastreo
        </a>
    );
};

EnviaTrackUrlDisplay.displayName = 'EnviaTrackUrlDisplay';
