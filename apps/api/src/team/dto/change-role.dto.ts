import { IsEnum } from 'class-validator';
import { MembershipRole } from '../../generated/prisma/enums.js';

/**
 * Any role is well-formed here, OWNER included: whether this actor may grant
 * it to this member is decided by the service, which knows both.
 */
export class ChangeRoleDto {
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
