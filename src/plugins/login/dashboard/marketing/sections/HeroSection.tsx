import { AuthCard } from '../AuthCard';
import logoDark from '../../../public/PNG-05.png';
import logoLight from '../../../public/PNG-06-1.PNG';

function EcommerMark({ className }: { className: string }) {
    return (
        <>
            <img src={logoDark} alt="Ecommer" className={`hidden dark:block ${className}`} />
            <img src={logoLight} alt="Ecommer" className={`block dark:hidden ${className}`} />
        </>
    );
}

export function HeroSection() {
    return (
        <section
            id="ecommer-login-hero"
            className="relative overflow-hidden px-6 py-16 md:py-24"
        >
            {/*
              Fondo: por ahora solo gradientes de marca (sin fotografía real
              disponible en el repo). Ver marketing/placeholders/README.md
              para instrucciones de cómo reemplazar esto por una imagen real.
            */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(153,105,248,0.20),transparent)]" />
            <div className="pointer-events-none absolute -top-24 -right-24 -z-10 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
            <div className="pointer-events-none absolute top-1/3 -left-24 -z-10 h-72 w-72 rounded-full bg-brand-lighter/20 blur-3xl" />

            <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="flex flex-col items-start gap-6">
                    <EcommerMark className="h-12 w-auto" />
                    <h1 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                        Todo tu negocio, en un solo panel
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                        El Admin de Ecommer reúne productos, variantes, métricas y tu propia
                        tienda pública en un solo lugar — con SimetrIA ayudándote a decidir
                        qué hacer con esos datos.
                    </p>
                    <p className="text-sm text-muted-foreground max-w-xl">
                        Desplázate para conocer cómo funciona el ecosistema completo antes de
                        entrar, o inicia sesión directamente en la tarjeta.
                    </p>
                </div>

                <div className="flex justify-center lg:justify-end">
                    <AuthCard />
                </div>
            </div>
        </section>
    );
}
