import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Paginated, TaskBoard, TaskDetail, TaskListItem } from '@nexo/types';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../auth/types/auth.types.js';
import { MembershipRole } from '../generated/prisma/enums.js';
import { BoardQueryDto } from './dto/board-query.dto.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { MoveTaskDto } from './dto/move-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TasksService } from './tasks.service.js';

/**
 * Create and delete are fixed per role and guarded here. Reading, editing and
 * moving depend on the task itself — a MEMBER sees only their projects and may
 * change only their own tasks — so those rules live in the service, which
 * re-reads the role from the database.
 */
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query() query: QueryTasksDto,
  ): Promise<Paginated<TaskListItem>> {
    return this.tasks.list(auth, query);
  }

  /** Declared before `:id` so the literal path is matched first. */
  @Get('board')
  board(@CurrentUser() auth: AuthContext, @Query() query: BoardQueryDto): Promise<TaskBoard> {
    return this.tasks.board(auth, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TaskDetail> {
    return this.tasks.findOne(auth, id);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskDetail> {
    return this.tasks.create(organizationId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDetail> {
    return this.tasks.update(auth, id, dto);
  }

  @Patch(':id/move')
  move(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveTaskDto,
  ): Promise<TaskDetail> {
    return this.tasks.move(auth, id, dto);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.tasks.remove(organizationId, id);
  }
}
