import type { Metadata } from 'next';
import Link from 'next/link';
import { NexoMark } from '@/components/shared/nexo-mark';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Página no encontrada' };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <NexoMark />

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">Error 404</p>
        <h1 className="text-xl font-semibold tracking-tight">Página no encontrada</h1>
        <p className="text-muted-foreground max-w-sm text-sm text-pretty">
          La página que buscas no existe o se ha movido.
        </p>
      </div>

      <Button asChild>
        <Link href="/dashboard">Volver al dashboard</Link>
      </Button>
    </div>
  );
}
