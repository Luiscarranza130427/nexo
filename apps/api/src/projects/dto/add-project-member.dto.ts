import { IsUUID } from 'class-validator';

export class AddProjectMemberDto {
  /** Must belong to the caller's organization; the service checks the membership. */
  @IsUUID()
  userId!: string;
}
