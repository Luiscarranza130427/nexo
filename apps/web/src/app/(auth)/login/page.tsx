import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { LoginNotice } from '@/components/auth/login-notice';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { NexoMark, NovaTecAttribution } from '@/components/shared/nexo-mark';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
};

/**
 * Server component: only the form and the theme switch need to run in the
 * browser, so the branding half ships as plain HTML.
 */
export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Branding. Hidden on small screens, where the form is all that matters. */}
      <section className="bg-sidebar border-border relative hidden flex-col justify-between border-r p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <NexoMark />
          <span className="text-foreground text-base font-semibold tracking-tight">Nexo</span>
        </div>

        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Todo tu trabajo, en un solo lugar.
          </h2>
          <p className="text-muted-foreground text-pretty">
            Clientes, proyectos, tareas y equipo conectados en una plataforma interna diseñada para
            equipos pequeños.
          </p>
        </div>

        <NovaTecAttribution />
      </section>

      <section className="flex flex-col">
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              {/* The mark repeats on small screens, where the branding pane is gone. */}
              <NexoMark className="mb-4 lg:hidden" />
              <h1 className="text-2xl font-semibold tracking-tight">Bienvenido a Nexo</h1>
              <p className="text-muted-foreground text-sm text-pretty">
                Gestiona proyectos, clientes y operaciones desde un solo lugar.
              </p>
            </div>

            <Suspense fallback={null}>
              <LoginNotice />
            </Suspense>

            <LoginForm />

            <NovaTecAttribution className="text-center lg:hidden" />
          </div>
        </div>
      </section>
    </div>
  );
}
