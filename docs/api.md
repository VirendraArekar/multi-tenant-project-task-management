# TeamBoard REST API Documentation

All API endpoints are versioned under `/api/v1` and return standard JSON envelopes.

---

## Standard Response Format

### Success Response
```json
{
  "status": "SUCCESS",
  "message": "Operation completed successfully",
  "data": { ... },
  "traceId": "d3b07384-d113-40e1-bb90-410a719d38bb"
}
```

### Error Response
```json
{
  "status": "ERROR",
  "message": "Invalid credentials or validation failure",
  "fieldErrors": {
    "email": "Must be a well-formed email address"
  },
  "traceId": "d3b07384-d113-40e1-bb90-410a719d38bb"
}
```

---

## 1. Authentication (`/api/v1/auth`)

### 1.1 Register User & Initial Organization
- **Endpoint**: `POST /api/v1/auth/register`
- **Rate Limit**: 10 requests / minute
- **Request Body**:
```json
{
  "email": "alex@enterprise.com",
  "password": "SecurePassword123!",
  "fullName": "Alex Rivera",
  "organizationName": "Acme Engineering"
}
```
- **Response**: `201 Created`
```json
{
  "status": "SUCCESS",
  "message": "User registered and workspace created successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "4892cfa1-71e8-46f9-bf93-2781498b81fa",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": 1,
      "email": "alex@enterprise.com",
      "fullName": "Alex Rivera"
    }
  },
  "traceId": "c8a8c34c-5f0b-41a9-9626-62c6cb086869"
}
```

### 1.2 User Login
- **Endpoint**: `POST /api/v1/auth/login`
- **Rate Limit**: 10 requests / minute
- **Request Body**:
```json
{
  "email": "alex@enterprise.com",
  "password": "SecurePassword123!"
}
```
- **Response**: `200 OK`

### 1.3 Refresh Access Token
- **Endpoint**: `POST /api/v1/auth/refresh`
- **Request Body**:
```json
{
  "refreshToken": "4892cfa1-71e8-46f9-bf93-2781498b81fa"
}
```

### 1.4 User Logout
- **Endpoint**: `POST /api/v1/auth/logout`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "refreshToken": "4892cfa1-71e8-46f9-bf93-2781498b81fa"
}
```

### 1.5 Current User Profile
- **Endpoint**: `GET /api/v1/auth/me`
- **Headers**: `Authorization: Bearer <token>`

---

## 2. Organizations / Tenants (`/api/v1/organizations`)

### 2.1 List User's Workspaces
- **Endpoint**: `GET /api/v1/organizations`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "name": "Acme Engineering",
      "slug": "acme-engineering-8392",
      "role": "OWNER",
      "createdAt": "2026-11-09T01:30:00Z"
    }
  ]
}
```

### 2.2 Create New Organization
- **Endpoint**: `POST /api/v1/organizations`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "name": "DevOps Operations"
}
```

### 2.3 Rename Workspace
- **Endpoint**: `PUT /api/v1/organizations/{id}`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <id>`
- **Role Requirement**: `OWNER` or `ADMIN`
- **Request Body**:
```json
{
  "name": "Global Platform Engineering"
}
```

---

## 3. Members & Invites (`/api/v1/organizations/{orgId}/members`)

### 3.1 List Workspace Members
- **Endpoint**: `GET /api/v1/organizations/{orgId}/members`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Response**: `200 OK`
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "email": "alex@enterprise.com",
      "fullName": "Alex Rivera",
      "role": "OWNER",
      "joinedAt": "2026-11-09T01:30:00Z"
    }
  ]
}
```

### 3.2 Change Member Role
- **Endpoint**: `PUT /api/v1/organizations/{orgId}/members/{userId}/role`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Role Requirement**: `OWNER` or `ADMIN` (Invariants: Cannot demote last owner; Admins cannot demote owners)
- **Request Body**:
```json
{
  "role": "ADMIN"
}
```

### 3.3 Remove Member or Leave Workspace
- **Endpoint**: `DELETE /api/v1/organizations/{orgId}/members/{userId}`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`

### 3.4 Create Member Invitation
- **Endpoint**: `POST /api/v1/organizations/{orgId}/invites`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Role Requirement**: `OWNER` or `ADMIN`
- **Request Body**:
```json
{
  "email": "carol@enterprise.com",
  "role": "MEMBER"
}
```
- **Response**: `201 Created`
```json
{
  "status": "SUCCESS",
  "data": {
    "id": 1,
    "organizationId": 1,
    "organizationName": "Acme Engineering",
    "email": "carol@enterprise.com",
    "role": "MEMBER",
    "token": "a4f8d9b2e1c7...",
    "inviteLink": "http://localhost:3000/invite/accept?token=a4f8d9b2e1c7...",
    "inviterName": "Alex Rivera",
    "expiresAt": "2026-11-16T01:30:00Z"
  }
}
```

### 3.5 Accept Workspace Invitation
- **Endpoint**: `POST /api/v1/invites/{token}/accept`
- **Headers**: `Authorization: Bearer <token>` (User must be logged in)

---

## 4. Projects (`/api/v1/organizations/{orgId}/projects`)

### 4.1 List Projects
- **Endpoint**: `GET /api/v1/organizations/{orgId}/projects?page=0&size=20&includeArchived=false`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`

### 4.2 Create Project
- **Endpoint**: `POST /api/v1/organizations/{orgId}/projects`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Request Body**:
```json
{
  "name": "Microservices Migration",
  "description": "Decomposing legacy monolith into spring boot services"
}
```

### 4.3 Archive / Unarchive Project
- **Endpoint**: `PATCH /api/v1/organizations/{orgId}/projects/{projectId}/archive`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Role Requirement**: `OWNER` or `ADMIN`

### 4.4 Delete Project
- **Endpoint**: `DELETE /api/v1/organizations/{orgId}/projects/{projectId}`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Role Requirement**: `OWNER` or `ADMIN`

---

## 5. Tasks & Kanban Board (`/api/v1/organizations/{orgId}`)

### 5.1 Fetch Full Kanban Board
- **Endpoint**: `GET /api/v1/organizations/{orgId}/projects/{projectId}/kanban`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Response**: `200 OK` (Grouped into `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` ordered by `position`)
```json
{
  "status": "SUCCESS",
  "data": {
    "projectId": 1,
    "projectName": "Microservices Migration",
    "columns": {
      "TODO": [
        {
          "id": 101,
          "title": "Configure Kafka Topics",
          "status": "TODO",
          "priority": "HIGH",
          "position": 65536.0,
          "version": 0,
          "commentCount": 2,
          "isOverdue": false
        }
      ],
      "IN_PROGRESS": [],
      "IN_REVIEW": [],
      "DONE": []
    }
  }
}
```

### 5.2 Create Task
- **Endpoint**: `POST /api/v1/organizations/{orgId}/projects/{projectId}/tasks`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Request Body**:
```json
{
  "title": "Implement JWT Filter",
  "description": "Stateless token verification filter",
  "status": "TODO",
  "priority": "HIGH",
  "assigneeId": 2,
  "dueDate": "2026-11-20",
  "labels": [
    { "name": "backend", "color": "#3B82F6" },
    { "name": "security", "color": "#EF4444" }
  ]
}
```

### 5.3 Move Task (Drag-and-Drop with Optimistic Locking)
- **Endpoint**: `PATCH /api/v1/organizations/{orgId}/tasks/{taskId}/move`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Request Body**:
```json
{
  "targetStatus": "IN_PROGRESS",
  "targetPosition": 32768.0,
  "version": 0
}
```
- **Response on Success**: `200 OK` (Entity version incremented to 1)
- **Response on Stale Version**: `409 Conflict`
```json
{
  "status": "ERROR",
  "message": "Conflict detected: This task has been modified by another user. Please reload the board to see the latest changes.",
  "traceId": "b182cf91-1192-4f88-883a-123456789abc"
}
```

---

## 6. Dashboard Aggregates (`/api/v1/organizations/{orgId}/dashboard`)

### 6.1 Get Workspace Dashboard
- **Endpoint**: `GET /api/v1/organizations/{orgId}/dashboard`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
- **Cache**: Cached in Redis with 5-minute TTL; invalidated on task/project writes.
- **Response**: `200 OK`
```json
{
  "status": "SUCCESS",
  "data": {
    "countsByStatus": {
      "TODO": 12,
      "IN_PROGRESS": 8,
      "IN_REVIEW": 4,
      "DONE": 35
    },
    "totalTasks": 59,
    "overdueTasks": 2,
    "myOpenTasks": 5,
    "tasksPerMember": [
      {
        "userId": 1,
        "userName": "Alex Rivera",
        "userEmail": "alex@enterprise.com",
        "taskCount": 7
      }
    ],
    "recentActivity": [ ... ]
  }
}
```

---

## 7. Notifications & Activity Logs

### 7.1 Unread Notifications Badge Count
- **Endpoint**: `GET /api/v1/organizations/{orgId}/notifications/unread-count`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`

### 7.2 Mark All Notifications Read
- **Endpoint**: `PATCH /api/v1/organizations/{orgId}/notifications/read-all`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`

### 7.3 Activity Logs / Audit Trail
- **Endpoint**: `GET /api/v1/organizations/{orgId}/activity-logs?page=0&size=25&sort=createdAt,desc`
- **Headers**: `Authorization: Bearer <token>`, `X-Organization-Id: <orgId>`
