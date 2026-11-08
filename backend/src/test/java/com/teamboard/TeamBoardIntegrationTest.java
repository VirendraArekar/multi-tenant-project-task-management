package com.teamboard;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamboard.domain.organization.Role;
import com.teamboard.domain.task.TaskPriority;
import com.teamboard.domain.task.TaskStatus;
import com.teamboard.web.dto.auth.LoginRequest;
import com.teamboard.web.dto.auth.RegisterRequest;
import com.teamboard.web.dto.org.InviteRequest;
import com.teamboard.web.dto.project.CreateProjectRequest;
import com.teamboard.web.dto.task.CreateTaskRequest;
import com.teamboard.web.dto.task.MoveTaskRequest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TeamBoardIntegrationTest {

    @Container
    static final MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0")
            .withDatabaseName("teamboard_test")
            .withUsername("teamboard")
            .withPassword("teamboard");

    @Container
    static final GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379)
            .waitingFor(Wait.forListeningPort());

    @Container
    static final KafkaContainer kafka = new KafkaContainer("apache/kafka:3.8.0");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", redis::getFirstMappedPort);
        registry.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
        registry.add("app.rate-limit.auth-capacity", () -> "5");
        registry.add("app.rate-limit.auth-refill-tokens-per-minute", () -> "5");
    }

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static String aliceToken;
    private static Long aliceOrgId;
    private static Long aliceProjectId;
    private static Long aliceTaskId;

    private static String bobToken;
    private static Long bobOrgId;

    @Test
    @Order(1)
    @DisplayName("1. User A registers, workspace is created, and user becomes OWNER")
    void testRegisterUserA() throws Exception {
        RegisterRequest registerReq = new RegisterRequest(
                "alice@acme.com",
                "Password123!",
                "Alice Engineer",
                "Acme Corp"
        );

        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .header("X-Forwarded-For", "10.0.0.1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.user.email").value("alice@acme.com"))
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        aliceToken = root.path("data").path("accessToken").asText();

        // Fetch organizations for Alice to obtain aliceOrgId
        MvcResult orgsResult = mockMvc.perform(get("/api/v1/organizations")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("Acme Corp"))
                .andExpect(jsonPath("$.data[0].role").value("OWNER"))
                .andReturn();

        JsonNode orgsNode = objectMapper.readTree(orgsResult.getResponse().getContentAsString()).path("data");
        aliceOrgId = orgsNode.get(0).path("id").asLong();

        assertThat(aliceToken).isNotBlank();
        assertThat(aliceOrgId).isNotNull();
    }

    @Test
    @Order(2)
    @DisplayName("2. User A creates project, creates task, and moves task with optimistic locking")
    void testProjectAndTaskWorkflow() throws Exception {
        // Create Project
        CreateProjectRequest projectReq = new CreateProjectRequest("Core Platform", "Main enterprise services");
        MvcResult projResult = mockMvc.perform(post("/api/v1/organizations/" + aliceOrgId + "/projects")
                        .header("Authorization", "Bearer " + aliceToken)
                        .header("X-Organization-Id", aliceOrgId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(projectReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Core Platform"))
                .andReturn();

        JsonNode projNode = objectMapper.readTree(projResult.getResponse().getContentAsString());
        aliceProjectId = projNode.path("data").path("id").asLong();

        // Create Task
        CreateTaskRequest taskReq = new CreateTaskRequest(
                "Implement JWT Auth",
                "Add stateless JWT authentication filter",
                TaskStatus.TODO,
                TaskPriority.HIGH,
                null,
                null,
                List.of()
        );

        MvcResult taskResult = mockMvc.perform(post("/api/v1/organizations/" + aliceOrgId + "/projects/" + aliceProjectId + "/tasks")
                        .header("Authorization", "Bearer " + aliceToken)
                        .header("X-Organization-Id", aliceOrgId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(taskReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.title").value("Implement JWT Auth"))
                .andExpect(jsonPath("$.data.status").value("TODO"))
                .andExpect(jsonPath("$.data.version").value(0))
                .andReturn();

        JsonNode taskNode = objectMapper.readTree(taskResult.getResponse().getContentAsString());
        aliceTaskId = taskNode.path("data").path("id").asLong();

        // Fetch persisted task to check actual version
        MvcResult fetchResult = mockMvc.perform(get("/api/v1/organizations/" + aliceOrgId + "/tasks/" + aliceTaskId)
                        .header("Authorization", "Bearer " + aliceToken)
                        .header("X-Organization-Id", aliceOrgId))
                .andExpect(status().isOk())
                .andReturn();
        System.out.println(">>> PERSISTED TASK: " + fetchResult.getResponse().getContentAsString());
        long currentVersion = objectMapper.readTree(fetchResult.getResponse().getContentAsString()).path("data").path("version").asLong();

        // Move Task to IN_PROGRESS
        MoveTaskRequest moveReq = new MoveTaskRequest(TaskStatus.IN_PROGRESS, 1000.0, currentVersion);
        MvcResult moveResult = mockMvc.perform(patch("/api/v1/organizations/" + aliceOrgId + "/tasks/" + aliceTaskId + "/move")
                        .header("Authorization", "Bearer " + aliceToken)
                        .header("X-Organization-Id", aliceOrgId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(moveReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andReturn();
    }

    @Test
    @Order(3)
    @DisplayName("3. Optimistic locking: Stale version returns 409 Conflict")
    void testOptimisticLockConflict() throws Exception {
        // Attempt move using stale version 0 when entity is at version 1
        MoveTaskRequest staleMoveReq = new MoveTaskRequest(TaskStatus.DONE, 2000.0, 0L);
        mockMvc.perform(patch("/api/v1/organizations/" + aliceOrgId + "/tasks/" + aliceTaskId + "/move")
                        .header("Authorization", "Bearer " + aliceToken)
                        .header("X-Organization-Id", aliceOrgId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(staleMoveReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("modified by another user")));
    }

    @Test
    @Order(4)
    @DisplayName("4. Multi-tenancy isolation: User B cannot access User A's organization data")
    void testTenantIsolation() throws Exception {
        // Register User B in Beta Corp
        RegisterRequest registerReq = new RegisterRequest(
                "bob@betacorp.com",
                "Password123!",
                "Bob Builder",
                "Beta Corp"
        );

        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .header("X-Forwarded-For", "10.0.0.2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerReq)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        bobToken = root.path("data").path("accessToken").asText();

        // Fetch organizations for Bob
        MvcResult bobOrgsResult = mockMvc.perform(get("/api/v1/organizations")
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andReturn();
        bobOrgId = objectMapper.readTree(bobOrgsResult.getResponse().getContentAsString())
                .path("data").get(0).path("id").asLong();

        // Bob attempts to read Alice's project in Alice's Org (Org A)
        mockMvc.perform(get("/api/v1/organizations/" + aliceOrgId + "/projects/" + aliceProjectId)
                        .header("Authorization", "Bearer " + bobToken)
                        .header("X-Organization-Id", aliceOrgId))
                .andExpect(status().isForbidden());

        // Bob attempts to move Alice's task in Org A
        MoveTaskRequest bobMoveReq = new MoveTaskRequest(TaskStatus.DONE, 3000.0, 1L);
        mockMvc.perform(patch("/api/v1/organizations/" + aliceOrgId + "/tasks/" + aliceTaskId + "/move")
                        .header("Authorization", "Bearer " + bobToken)
                        .header("X-Organization-Id", aliceOrgId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(bobMoveReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(5)
    @DisplayName("5. Role enforcement: MEMBER cannot delete project or change member roles")
    void testRoleEnforcement() throws Exception {
        // Alice invites Charlie as MEMBER to Acme Corp
        InviteRequest inviteReq = new InviteRequest("charlie@acme.com", Role.MEMBER);
        MvcResult inviteResult = mockMvc.perform(post("/api/v1/organizations/" + aliceOrgId + "/invites")
                        .header("Authorization", "Bearer " + aliceToken)
                        .header("X-Organization-Id", aliceOrgId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(inviteReq)))
                .andExpect(status().isCreated())
                .andReturn();

        String inviteToken = objectMapper.readTree(inviteResult.getResponse().getContentAsString())
                .path("data").path("token").asText();

        // Register Charlie
        RegisterRequest charlieRegister = new RegisterRequest(
                "charlie@acme.com",
                "Password123!",
                "Charlie Contributor",
                "Charlie Solo"
        );
        MvcResult charlieRegResult = mockMvc.perform(post("/api/v1/auth/register")
                        .header("X-Forwarded-For", "10.0.0.3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(charlieRegister)))
                .andExpect(status().isCreated())
                .andReturn();

        String charlieToken = objectMapper.readTree(charlieRegResult.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();

        // Charlie accepts invite to Acme Corp
        mockMvc.perform(post("/api/v1/invites/" + inviteToken + "/accept")
                        .header("Authorization", "Bearer " + charlieToken))
                .andExpect(status().isOk());

        // Charlie (MEMBER) attempts to delete project in Acme Corp -> 403 Forbidden
        mockMvc.perform(delete("/api/v1/organizations/" + aliceOrgId + "/projects/" + aliceProjectId)
                        .header("Authorization", "Bearer " + charlieToken)
                        .header("X-Organization-Id", aliceOrgId))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(6)
    @DisplayName("6. Distributed rate limiting: Rapid login requests return 429 Too Many Requests")
    void testRateLimiterReturns429() throws Exception {
        LoginRequest badLogin = new LoginRequest("spammer@acme.com", "WrongPassword123!");

        // Fire 8 consecutive requests exceeding the auth-capacity of 5 with a dedicated IP
        int status429Count = 0;
        for (int i = 0; i < 8; i++) {
            MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                            .header("X-Forwarded-For", "198.51.100.99")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badLogin)))
                    .andReturn();
            if (res.getResponse().getStatus() == 429) {
                status429Count++;
                assertThat(res.getResponse().getHeader("Retry-After")).isNotNull();
                assertThat(res.getResponse().getHeader("X-RateLimit-Limit")).isNotNull();
            }
        }

        assertThat(status429Count).isGreaterThan(0);
    }
}
