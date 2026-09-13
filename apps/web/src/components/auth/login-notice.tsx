'use client';

import { CircleCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

/** Confirms an accepted invitation when signing in afterwards was not automatic. */
export function LoginNotice() {
  const searchParams = useSearchParams();

  if (searchParams.get('invitation') !== 'accepted') {
    return null;
  }

  return (
    <Alert role="status">
      <CircleCheck className="size-4" aria-hidden="true" />
      <AlertDescription>Invitación aceptada. Inicia sesión.</AlertDescription>
    </Alert>
  );
}
