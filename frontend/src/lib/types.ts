export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface User {
  id: number;
  email: string;
  fullName: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  role: Role;
  createdAt: string;
}

export interface Project {
  id: number;
  organizationId: number;
  name: string;
  description?: string;
  isArchived: boolean;
  createdBy: number;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id?: number;
  name: string;
  color: string;
}

export interface Task {
  id: number;
  organizationId: number;
  projectId: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: number | null;
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  reporterId: number;
  reporterName?: string;
  dueDate?: string | null;
  isOverdue: boolean;
  position: number;
  version: number;
  labels: Label[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  taskId: number;
  userId: number;
  authorName: string;
  authorEmail?: string;
  content: string;
  createdAt: string;
}

export interface Member {
  id: number;
  userId: number;
  email: string;
  fullName: string;
  role: Role;
  joinedAt: string;
}

export interface Invite {
  id: number;
  organizationId: number;
  organizationName: string;
  email: string;
  role: Role;
  token: string;
  inviteLink: string;
  inviterName: string;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: number;
  organizationId: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  entityType?: string;
  entityId?: number;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityItem {
  id: number;
  userId?: number;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: number;
  entityName?: string;
  details?: string;
  createdAt: string;
}

export interface DashboardData {
  countsByStatus: Record<TaskStatus, number>;
  totalTasks: number;
  overdueTasks: number;
  myOpenTasks: number;
  tasksPerMember: {
    userId: number;
    userName: string;
    userEmail: string;
    taskCount: number;
  }[];
  recentActivity: ActivityItem[];
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface KanbanBoardResponse {
  projectId: number;
  projectName: string;
  columns: Record<TaskStatus, Task[]>;
}
