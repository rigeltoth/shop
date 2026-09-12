import type { DashboardFormComponent } from '@vendure/dashboard';
import { Printer } from 'lucide-react';

export const EnviaLabelUrlDisplay: DashboardFormComponent = ({ value }) => {
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
            <Printer className="h-4 w-4" />
            Imprimir guía
        </a>
    );
};

EnviaLabelUrlDisplay.displayName = 'EnviaLabelUrlDisplay';
