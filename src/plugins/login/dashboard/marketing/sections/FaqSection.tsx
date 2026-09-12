import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SectionShell } from '../SectionShell';

const FAQS: { question: string; answer: string }[] = [
    {
        question: '¿Necesito conocimientos técnicos para usar el Admin?',
        answer:
            'No. Si sabes usar WhatsApp o Instagram, sabes usar el Admin de Ecommer. Publicar un producto es tan fácil como publicar una foto en redes sociales.',
    },
    {
        question: '¿Qué puedo hacer dentro del Admin?',
        answer:
            'Crear y publicar productos con sus variantes, organizar tu catálogo con facetas, revisar tus métricas de ventas con ayuda de SimetrIA, y administrar tu negocio de principio a fin.',
    },
    {
        question: '¿Qué es SimetrIA y tengo que pagar aparte por ella?',
        answer:
            'Es el asistente de inteligencia artificial integrado en tu panel. En el plan Free no está disponible; a partir del plan Tienda viene incluido, sin costo adicional.',
    },
    {
        question: '¿Mi tienda tiene su propia página web?',
        answer:
            'Sí. Cada vendedor tiene su propia tienda pública (MiTienda): todo lo que publiques en el Admin aparece automáticamente ahí para que tus clientes lo encuentren y compren.',
    },
    {
        question: '¿Es obligatorio facturar electrónicamente?',
        answer:
            'No para empezar. Si eres persona natural en régimen no responsable de IVA, puedes vender sin facturación electrónica. Las personas jurídicas sí están obligadas por ley.',
    },
    {
        question: '¿Cómo y cuándo recibo el dinero de mis ventas?',
        answer:
            'Recibes el dinero cada 15 días. Si usas Nequi, Bancolombia o un banco con llave BRE-B registrada, no hay costos adicionales por el giro.',
    },
    {
        question: '¿Existe un número de atención al cliente?',
        answer:
            'Sí. Puedes escribir al 314 851 8961: el soporte te conecta primero con un bot de IA, que te redirige a un asistente real si lo necesitas.',
    },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-b border-black/10 dark:border-white/10">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-4 py-4 text-left cursor-pointer"
            >
                <span className="font-heading font-semibold text-foreground">{question}</span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && <p className="pb-4 text-muted-foreground leading-relaxed">{answer}</p>}
        </div>
    );
}

export function FaqSection() {
    return (
        <SectionShell eyebrow="Preguntas frecuentes" title="¿Tienes alguna pregunta?" tone="muted">
            <div className="w-full max-w-3xl">
                {FAQS.map(faq => (
                    <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
                ))}
            </div>
        </SectionShell>
    );
}
