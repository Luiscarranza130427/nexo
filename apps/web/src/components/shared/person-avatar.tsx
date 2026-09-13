import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type Person = {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

/** `Luis Carranza` becomes `LC`. */
export function initials({ firstName, lastName }: Pick<Person, 'firstName' | 'lastName'>): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * A person's avatar. With no photo it falls back to initials — never a stock
 * or generated image standing in for a real face.
 */
export function PersonAvatar({ person, className }: { person: Person; className?: string }) {
  return (
    <Avatar className={cn('size-8', className)}>
      {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
        {initials(person)}
      </AvatarFallback>
    </Avatar>
  );
}
