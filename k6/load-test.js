import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

// Custom metrics
const kanbanDuration = new Trend("kanban_duration_ms");
const taskMoveDuration = new Trend("task_move_duration_ms");
const conflictRate = new Rate("conflict_rate_409");
const errorRate = new Rate("error_rate");

export const options = {
  stages: [
    { duration: "20s", target: 20 },  // Ramp-up to 20 users
    { duration: "40s", target: 50 },  // Ramp-up to 50 concurrent users
    { duration: "1m", target: 50 },   // Sustained load at 50 users
    { duration: "20s", target: 100 }, // Peak spike to 100 users
    { duration: "20s", target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<250"], // 95% of requests must complete within 250ms
    http_req_failed: ["rate<0.01"],   // Error rate must stay below 1%
    kanban_duration_ms: ["p(95)<200"],
    task_move_duration_ms: ["p(95)<300"],
  },
};

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:80/api/v1";

export function setup() {
  const timestamp = Date.now();
  const registerPayload = JSON.stringify({
    email: `loadtest_${timestamp}@teamboard.io`,
    password: "Password123!",
    fullName: "Load Tester",
    organizationName: `Load Test Workspace ${timestamp}`,
  });

  const regHeaders = { "Content-Type": "application/json" };
  const regRes = http.post(`${BASE_URL}/auth/register`, registerPayload, { headers: regHeaders });
  
  let token = "";
  if (regRes.status === 201) {
    token = regRes.json("data.accessToken");
  } else {
    // Attempt fallback login if user already exists
    const loginPayload = JSON.stringify({
      email: `loadtest_${timestamp}@teamboard.io`,
      password: "Password123!",
    });
    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers: regHeaders });
    token = loginRes.json("data.accessToken");
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Fetch created organization
  const orgsRes = http.get(`${BASE_URL}/organizations`, { headers: authHeaders });
  const orgId = orgsRes.json("data.0.id");
  authHeaders["X-Organization-Id"] = String(orgId);

  // Create Project
  const projRes = http.post(
    `${BASE_URL}/organizations/${orgId}/projects`,
    JSON.stringify({ name: `Load Test Project ${timestamp}`, description: "Benchmark target" }),
    { headers: authHeaders }
  );
  const projectId = projRes.json("data.id");

  // Create initial set of tasks
  const taskIds = [];
  for (let i = 1; i <= 5; i++) {
    const taskRes = http.post(
      `${BASE_URL}/organizations/${orgId}/projects/${projectId}/tasks`,
      JSON.stringify({
        title: `Benchmark Task #${i}`,
        description: `Automated load test card #${i}`,
        status: "TODO",
        priority: "MEDIUM",
        labels: [],
      }),
      { headers: authHeaders }
    );
    if (taskRes.status === 201) {
      taskIds.push({
        id: taskRes.json("data.id"),
        version: taskRes.json("data.version"),
        status: "TODO",
      });
    }
  }

  return { token, orgId, projectId, taskIds };
}

export default function (data) {
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.token}`,
    "X-Organization-Id": String(data.orgId),
  };

  // 1. Fetch Kanban Board (read path, cached via Redis)
  const kanbanStart = Date.now();
  const kanbanRes = http.get(
    `${BASE_URL}/organizations/${data.orgId}/projects/${data.projectId}/kanban`,
    { headers: authHeaders }
  );
  kanbanDuration.add(Date.now() - kanbanStart);

  const kanbanSuccess = check(kanbanRes, {
    "kanban status is 200": (r) => r.status === 200,
    "kanban has columns": (r) => r.json("data.columns") !== undefined,
  });
  errorRate.add(!kanbanSuccess);

  sleep(0.5);

  // 2. Paginated task list query
  const listRes = http.get(
    `${BASE_URL}/organizations/${data.orgId}/projects/${data.projectId}/tasks?page=0&size=20`,
    { headers: authHeaders }
  );
  check(listRes, {
    "task list status is 200": (r) => r.status === 200,
    "task list returns content": (r) => Array.isArray(r.json("data.content")),
  });

  sleep(0.5);

  // 3. Move Task (write path, transactional outbox + optimistic locking)
  if (data.taskIds && data.taskIds.length > 0) {
    const randomTask = data.taskIds[Math.floor(Math.random() * data.taskIds.length)];
    const targetStatus = Math.random() > 0.5 ? "IN_PROGRESS" : "TODO";
    const targetPosition = Math.floor(Math.random() * 100000);

    const movePayload = JSON.stringify({
      targetStatus: targetStatus,
      targetPosition: targetPosition,
      version: randomTask.version,
    });

    const moveStart = Date.now();
    const moveRes = http.patch(
      `${BASE_URL}/organizations/${data.orgId}/tasks/${randomTask.id}/move`,
      movePayload,
      { headers: authHeaders }
    );
    taskMoveDuration.add(Date.now() - moveStart);

    if (moveRes.status === 200) {
      randomTask.version = moveRes.json("data.version");
      randomTask.status = targetStatus;
      conflictRate.add(false);
      errorRate.add(false);
    } else if (moveRes.status === 409) {
      // Handled optimistic lock conflict under high concurrency
      conflictRate.add(true);
      errorRate.add(false);
    } else {
      errorRate.add(true);
    }
  }

  sleep(1);
}
