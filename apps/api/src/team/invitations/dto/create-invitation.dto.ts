import { Transform } from 'class-transformer';
import { IsEmail, IsIn, MaxLength } from 'class-validator';
import { INVITABLE_ROLES } from '../../team-rules.js';

export class CreateInvitationDto {
  /** Normalized like every stored email, so one address never gets two invitations. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** OWNER is not accepted: ownership is granted later, explicitly, by an owner. */
  @IsIn(INVITABLE_ROLES)
  role!: (typeof INVITABLE_ROLES)[number];
}
