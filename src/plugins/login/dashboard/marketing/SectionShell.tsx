import type { ReactNode } from 'react';

export function SectionShell({
    eyebrow,
    title,
    subtitle,
    children,
    tone = 'default',
}: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    children: ReactNode;
    /** 'muted' alterna el fondo para separar visualmente secciones consecutivas. */
    tone?: 'default' | 'muted';
}) {
    return (
        <section
            className={
                tone === 'muted'
                    ? 'bg-black/[0.02] dark:bg-white/[0.03] px-6 py-16 md:py-20'
                    : 'px-6 py-16 md:py-20'
            }
        >
            <div className="mx-auto max-w-6xl">
                <div className="max-w-2xl mb-10">
                    {eyebrow && (
                        <p className="text-sm font-semibold text-brand mb-2 uppercase tracking-wide">
                            {eyebrow}
                        </p>
                    )}
                    <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground mb-3">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-muted-foreground leading-relaxed">{subtitle}</p>
                    )}
                </div>
                {children}
            </div>
        </section>
    );
}
