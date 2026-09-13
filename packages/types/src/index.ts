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
