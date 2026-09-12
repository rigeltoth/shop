import { MessageCircle, TrendingUp, Sparkles } from 'lucide-react';
import { SectionShell } from '../SectionShell';
import avatarUrl from '../../../../ai-chat/dashboard/simteria-avatar.png';

const POINTS = [
    {
        icon: MessageCircle,
        title: '¿Qué es?',
        description:
            'SimetrIA es el asistente de inteligencia artificial de Ecommer, integrado directamente en tu panel de administración.',
    },
    {
        icon: TrendingUp,
        title: '¿Cómo funciona?',
        description:
            'Conversas con ella igual que por chat: le preguntas sobre tus productos, ventas o inventario y responde con base en los datos reales de tu tienda.',
    },
    {
        icon: Sparkles,
        title: '¿Cómo te ayuda?',
        description:
            'Te ayuda a interpretar tus métricas, detectar qué productos venden mejor y decidir qué hacer a continuación, sin que tengas que ser un experto en análisis de datos.',
    },
];

export function SimetriaSection() {
    return (
        <SectionShell
            eyebrow="Tu asistente de IA"
            title="Conoce a SimetrIA"
            subtitle="Un agente de inteligencia artificial que vive dentro del Admin para ayudarte a entender y hacer crecer tu negocio."
            tone="muted"
        >
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 items-center">
                <div className="flex justify-center lg:justify-start">
                    <div className="h-32 w-32 rounded-3xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 shadow-xl flex items-center justify-center p-4">
                        <img src={avatarUrl} alt="SimetrIA" className="h-full w-full object-contain" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {POINTS.map(({ icon: Icon, title, description }) => (
                        <div key={title} className="flex flex-col gap-2">
                            <Icon className="h-5 w-5 text-brand" />
                            <h3 className="font-heading font-bold text-foreground">{title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </SectionShell>
    );
}
