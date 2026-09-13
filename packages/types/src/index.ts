/**
 * Types shared between the Nexo frontend and backend.
 *
 * Import them as type-only (`import type { ... } from '@nexo/types'`) so the
 * package leaves no trace in the compiled JavaScript.
 *
 * These are public API contracts. They must stay independent of Prisma and of
 * any database model — the frontend never depends on the persistence layer.
 * Never add `passwordHash`, `refreshTokenHash`, session internals or anything
 * else that must not reach a browser.
 */

/** Health state reported by the API. */
export type ApiStatus = {
  status: 'ok' | 'error';
};

/** Identity and health reported by the API root endpoint. */
export type ApiInfo = ApiStatus & {
  name: string;
};

/** Result of the database health probe. */
export type DatabaseHealth = ApiStatus & {
  database: 'connected' | 'disconnected';
};

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Role a user holds inside an organization.
 *
 * Deliberately a plain union rather than a re-export of the Prisma enum: the
 * frontend must not depend on the database layer. `auth.contract.spec.ts`
 * asserts that this stays in sync with the Prisma `MembershipRole` enum.
 */
export type MembershipRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';

/** The authenticated person. Never carries credentials. */
export type AuthenticatedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

/** Minimal public description of an organization. */
export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
};

/** The caller's role in the active organization. */
export type MembershipSummary = {
  role: MembershipRole;
};

/** Who the caller is and which organization they are acting in. */
export type AuthSession = {
  user: AuthenticatedUser;
  organization: OrganizationSummary;
  membership: MembershipSummary;
};

/**
 * Response of a successful login, refresh or organization switch.
 *
 * The refresh token is intentionally absent: it travels only in an HttpOnly
 * cookie and must never be readable by JavaScript.
 */
export type AuthTokens = AuthSession & {
  accessToken: string;
};

/** Credentials submitted to the login endpoint. */
export type LoginRequest = {
  email: string;
  password: string;
  /** Required only when the user belongs to more than one organization. */
  organizationId?: string;
};

/** Stable, machine-readable error codes returned by the auth endpoints. */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ORGANIZATION_REQUIRED'
  | 'INVALID_ORGANIZATION'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';

/**
 * Returned with `ORGANIZATION_REQUIRED` when a user belongs to several
 * organizations and did not say which one to sign in to. Only emitted after
 * the credentials have already been verified.
 */
export type OrganizationChoiceRequired = {
  code: 'ORGANIZATION_REQUIRED';
  organizations: OrganizationSummary[];
};

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** Standard envelope for every paginated list the API returns. */
export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

/**
 * Plain unions rather than re-exports of the Prisma enums: the frontend must
 * not depend on the persistence layer. `clients.contract.spec.ts` asserts these
 * stay in sync with the database.
 */
export type ClientType = 'PERSON' | 'COMPANY';

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'PROSPECT';

/**
 * A client as the API returns it.
 *
 * `organizationId` is deliberately absent: the tenant is implied by the
 * session, and echoing it back would only invite the frontend to send it.
 * Timestamps are ISO strings, which is what JSON carries.
 */
export type Client = {
  id: string;
  type: ClientType;
  name: string;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClientSortField = 'name' | 'createdAt' | 'updatedAt';

export type SortOrder = 'asc' | 'desc';

/** Query accepted by `GET /clients`. Every field is optional. */
export type ClientListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: ClientStatus;
  type?: ClientType;
  sortBy?: ClientSortField;
  sortOrder?: SortOrder;
};

/** Body of `POST /clients`. */
export type CreateClientInput = {
  type: ClientType;
  name: string;
  documentType?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: ClientStatus;
};

/** Body of `PATCH /clients/:id`. Partial by design. */
export type UpdateClientInput = Partial<CreateClientInput>;

/** Error codes specific to the clients module. */
export type ClientErrorCode =
  'CLIENT_NOT_FOUND' | 'CLIENT_DOCUMENT_ALREADY_EXISTS' | 'CLIENT_HAS_PROJECTS';

// ---------------------------------------------------------------------------
// Organization members
// ---------------------------------------------------------------------------

/**
 * A person in the caller's organization, as offered for selection — for
 * example when assigning project members. Carries nothing sensitive: no
 * password hash, no sessions, no membership internals beyond the role.
 */
export type OrganizationMember = {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
  role: MembershipRole;
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * Plain unions rather than Prisma re-exports, like every other enum here;
 * `projects.contract.spec.ts` asserts they match the database.
 */
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

/** Shared by projects and, later, tasks: the scale is identical. */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** The minimum a project needs to show and link its client. */
export type ClientReference = {
  id: string;
  name: string;
};

/** A member as embedded in a project detail. */
export type ProjectMemberSummary = Pick<
  OrganizationMember,
  'userId' | 'firstName' | 'lastName' | 'avatarUrl'
>;

type ProjectBase = {
  id: string;
  /** Generated by the API (e.g. `NEX-001`), unique per organization, never reused. */
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  /**
   * Calendar dates, stored at UTC midnight and serialized as ISO strings.
   * Format them in UTC, or a date will show as the previous day west of Greenwich.
   */
  startDate: string | null;
  dueDate: string | null;
  client: ClientReference | null;
  createdAt: string;
  updatedAt: string;
};

/** A row of `GET /projects`. Counts only — no member or task records. */
export type ProjectListItem = ProjectBase & {
  membersCount: number;
  tasksCount: number;
};

/** Real task counts per status. All zero until tasks exist. */
export type ProjectTaskSummary = {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
  cancelled: number;
};

/** `GET /projects/:id`. */
export type ProjectDetail = ProjectBase & {
  members: ProjectMemberSummary[];
  tasks: ProjectTaskSummary;
};

export type ProjectSortField =
  'name' | 'code' | 'createdAt' | 'updatedAt' | 'startDate' | 'dueDate' | 'priority';

/** Query accepted by `GET /projects`. Every field is optional. */
export type ProjectListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProjectStatus;
  priority?: Priority;
  clientId?: string;
  memberId?: string;
  sortBy?: ProjectSortField;
  sortOrder?: SortOrder;
};

/** Body of `POST /projects`. There is no `code`: the API generates it. */
export type CreateProjectInput = {
  name: string;
  description?: string | null;
  clientId?: string | null;
  status?: ProjectStatus;
  priority?: Priority;
  startDate?: string | null;
  dueDate?: string | null;
};

/** Body of `PATCH /projects/:id`. `null` clears a nullable field. */
export type UpdateProjectInput = Partial<CreateProjectInput>;

/** Body of `POST /projects/:id/members`. */
export type AddProjectMemberInput = {
  userId: string;
};

/** Error codes specific to the projects module. */
export type ProjectErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_CLIENT_NOT_FOUND'
  | 'PROJECT_MEMBER_ALREADY_EXISTS'
  | 'PROJECT_MEMBER_NOT_FOUND'
  | 'PROJECT_MEMBER_NOT_IN_ORGANIZATION'
  | 'PROJECT_HAS_TASKS'
  | 'PROJECT_CODE_GENERATION_FAILED'
  | 'INVALID_PROJECT_DATES';

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/** Plain union; `tasks.contract.spec.ts` asserts it matches the database enum. */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';

/** Statuses that have a column on the board. Cancelled tasks stay off it. */
export type BoardTaskStatus = Exclude<TaskStatus, 'CANCELLED'>;

/** The minimum a task needs to show and link its project. */
export type ProjectReference = {
  id: string;
  code: string;
  name: string;
};

/** Same shape as a project member: users are identified by `userId`. */
export type TaskAssignee = ProjectMemberSummary;

/** A row of `GET /tasks`, and a card on the board. No description. */
export type TaskListItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  /** Order inside its column. Assigned by the API; never sent by the client. */
  position: number;
  /** Calendar dates at UTC midnight; format them in UTC. */
  startDate: string | null;
  dueDate: string | null;
  /** Maintained by the API: set on entering DONE, cleared on leaving it. */
  completedAt: string | null;
  project: ProjectReference;
  assignee: TaskAssignee | null;
  createdAt: string;
  updatedAt: string;
};

/** `GET /tasks/:id`. */
export type TaskDetail = TaskListItem & {
  description: string | null;
};

export type TaskSortField =
  'position' | 'title' | 'priority' | 'createdAt' | 'updatedAt' | 'startDate' | 'dueDate';

/** Query accepted by `GET /tasks`. Every field is optional. */
export type TaskListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  /** `YYYY-MM-DD`, inclusive. */
  dueFrom?: string;
  dueTo?: string;
  sortBy?: TaskSortField;
  sortOrder?: SortOrder;
};

/** Query accepted by `GET /tasks/board`. */
export type TaskBoardQuery = {
  projectId: string;
  search?: string;
  priority?: Priority;
  assigneeId?: string;
};

export type TaskBoardColumn = {
  status: BoardTaskStatus;
  /** Real number of matching tasks, even when `tasks` is capped. */
  total: number;
  tasks: TaskListItem[];
};

/** `GET /tasks/board`: every open task of one project, by column. */
export type TaskBoard = {
  limitPerColumn: number;
  columns: TaskBoardColumn[];
};

/** Body of `POST /tasks`. No position and no completedAt: the API owns both. */
export type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
};

/** Body of `PATCH /tasks/:id`. The project cannot change. */
export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'projectId'>>;

/**
 * Body of `PATCH /tasks/:id/move`. Where the task lands is described by its new
 * neighbours, never by a raw position: `afterTaskId` sits directly above it,
 * `beforeTaskId` directly below. Neither means "end of the column".
 */
export type MoveTaskInput = {
  status: TaskStatus;
  afterTaskId?: string | null;
  beforeTaskId?: string | null;
};

/** Error codes specific to the tasks module. */
export type TaskErrorCode =
  | 'TASK_NOT_FOUND'
  | 'TASK_PROJECT_NOT_FOUND'
  | 'TASK_ASSIGNEE_NOT_FOUND'
  | 'TASK_ASSIGNEE_NOT_PROJECT_MEMBER'
  | 'INVALID_TASK_DATES'
  | 'INVALID_TASK_POSITION'
  | 'TASK_MOVE_FAILED';

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

/** Plain union; `team.contract.spec.ts` asserts it matches the database enum. */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'INVITED';

/** A person in the organization, as the team list shows them. */
export type TeamMember = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  /** The account's status, which applies across every organization. */
  status: UserStatus;
  role: MembershipRole;
  /** When the membership was created. */
  joinedAt: string;
  /** Projects of this organization the person is a member of. */
  projectsCount: number;
};

export type TeamSortField = 'name' | 'email' | 'role' | 'joinedAt';

/** Query accepted by `GET /team`. Every field is optional. */
export type TeamListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  role?: MembershipRole;
  status?: UserStatus;
  sortBy?: TeamSortField;
  sortOrder?: SortOrder;
};

/** `GET /team/summary`: head count by role. */
export type TeamSummary = {
  total: number;
  byRole: Record<MembershipRole, number>;
};

/** A project as listed on a member's profile. */
export type TeamMemberProject = ProjectReference & {
  status: ProjectStatus;
};

/**
 * `GET /team/:userId`. A MEMBER viewing someone else sees only the projects
 * they share, and task counts within those projects.
 */
export type TeamMemberDetail = TeamMember & {
  projects: TeamMemberProject[];
  /** Tasks assigned to the person, by status. */
  tasks: ProjectTaskSummary;
};

/** Body of `PATCH /team/:userId/role`. */
export type ChangeMemberRoleInput = {
  role: MembershipRole;
};

export type TeamErrorCode = 'TEAM_MEMBER_NOT_FOUND' | 'LAST_OWNER_REQUIRED';

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

/** Plain union; `team.contract.spec.ts` asserts it matches the database enum. */
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

/** Ownership is never granted by invitation, only by an owner afterwards. */
export type InvitableRole = Exclude<MembershipRole, 'OWNER'>;

export type PersonReference = Pick<OrganizationMember, 'userId' | 'firstName' | 'lastName'>;

/** An invitation as the administration list shows it. Never carries the token. */
export type Invitation = {
  id: string;
  email: string;
  role: InvitableRole;
  /** Effective status: a pending invitation past its expiry reads as EXPIRED. */
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedBy: PersonReference | null;
};

/** Query accepted by `GET /team/invitations`. */
export type InvitationListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvitationStatus;
};

/** Body of `POST /team/invitations`. */
export type CreateInvitationInput = {
  email: string;
  role: InvitableRole;
};

/**
 * Response of `POST /team/invitations` — the only time the token exists outside
 * the invitee's link. The API keeps a fingerprint and cannot rebuild the URL.
 */
export type CreatedInvitation = {
  id: string;
  email: string;
  role: InvitableRole;
  expiresAt: string;
  inviteUrl: string;
};

/** `GET /invitations/:token`: just enough for the public invitation page. */
export type InvitationPreview =
  | {
      valid: true;
      status: 'PENDING';
      organizationName: string;
      email: string;
      role: InvitableRole;
      expiresAt: string;
      /** Whether the invitee must sign in with an existing account. */
      accountExists: boolean;
    }
  | {
      valid: false;
      status: Exclude<InvitationStatus, 'PENDING'>;
      organizationName: string;
    };

/**
 * Body of `POST /invitations/accept`. For an existing account `password`
 * proves ownership; for a new one it becomes the password, and the names are
 * required.
 */
export type AcceptInvitationInput = {
  token: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export type AcceptedInvitation = {
  organization: OrganizationSummary;
  email: string;
  role: InvitableRole;
};

export type InvitationErrorCode =
  | 'INVITATION_NOT_FOUND'
  | 'INVITATION_EXPIRED'
  | 'INVITATION_REVOKED'
  | 'INVITATION_ALREADY_ACCEPTED'
  | 'INVITATION_ALREADY_PENDING'
  | 'INVITATION_ACCOUNT_CHANGED'
  | 'INVITATION_PROFILE_REQUIRED'
  | 'INVALID_PASSWORD'
  | 'USER_ALREADY_MEMBER';
