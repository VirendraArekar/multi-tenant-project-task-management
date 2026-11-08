package com.teamboard.service;

import com.teamboard.common.exception.ConflictException;
import com.teamboard.common.exception.ForbiddenException;
import com.teamboard.domain.project.Project;
import com.teamboard.domain.project.ProjectRepository;
import com.teamboard.domain.task.*;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.web.dto.task.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TaskLabelRepository taskLabelRepository;

    @Mock
    private TenantSecurityService tenantSecurityService;

    @Mock
    private OutboxService outboxService;

    @Mock
    private CacheInvalidationService cacheInvalidationService;

    @InjectMocks
    private TaskService taskService;

    private Long orgA = 100L;
    private Long orgB = 200L;
    private Long projectId = 10L;
    private Long userId = 1L;

    @Test
    void createTaskGeneratesProperPositionAndEvent() {
        Project project = new Project(orgA, "Mobile App", "Description", userId);
        project.setId(projectId);

        User reporter = new User("user@test.com", "hash", "Alice");
        reporter.setId(userId);

        when(projectRepository.findByIdAndOrganizationId(projectId, orgA)).thenReturn(Optional.of(project));
        when(userRepository.findById(userId)).thenReturn(Optional.of(reporter));
        when(taskRepository.findMaxPositionByProjectIdAndStatus(projectId, TaskStatus.TODO)).thenReturn(65536.0);

        when(taskRepository.save(any(Task.class))).thenAnswer(i -> {
            Task t = i.getArgument(0);
            t.setId(501L);
            return t;
        });

        CreateTaskRequest request = new CreateTaskRequest("Implement Login", "Add auth", TaskStatus.TODO, TaskPriority.HIGH, null, null, null);
        TaskResponse response = taskService.createTask(orgA, projectId, request, userId);

        assertNotNull(response);
        assertEquals("Implement Login", response.getTitle());
        assertEquals(131072.0, response.getPosition()); // 65536 + 65536
        verify(outboxService, times(1)).recordEvent(eq("TASK"), eq("501"), eq("TASK_CREATED"), any(), any());
    }

    @Test
    void moveTaskDetectsOptimisticLockConflict() {
        Task task = new Task(orgA, projectId, "Card A", "Desc", TaskStatus.TODO, TaskPriority.MEDIUM, null, userId, null, 1000.0);
        task.setId(77L);
        task.setVersion(5L); // Current version in DB is 5

        when(taskRepository.findByIdAndOrganizationId(77L, orgA)).thenReturn(Optional.of(task));

        // Client sends version 4 (stale)
        MoveTaskRequest request = new MoveTaskRequest(TaskStatus.IN_PROGRESS, 2000.0, 4L);

        ConflictException ex = assertThrows(ConflictException.class, () ->
                taskService.moveTask(orgA, 77L, request, userId)
        );
        assertTrue(ex.getMessage().contains("Conflict detected"));
        verify(taskRepository, never()).saveAndFlush(any());
    }

    @Test
    void moveTaskSucceedsWhenVersionsMatch() {
        Task task = new Task(orgA, projectId, "Card A", "Desc", TaskStatus.TODO, TaskPriority.MEDIUM, null, userId, null, 1000.0);
        task.setId(77L);
        task.setVersion(5L);

        when(taskRepository.findByIdAndOrganizationId(77L, orgA)).thenReturn(Optional.of(task));
        when(taskRepository.saveAndFlush(any(Task.class))).thenAnswer(i -> i.getArgument(0));
        when(userRepository.findById(userId)).thenReturn(Optional.of(new User("user@test.com", "h", "Alice")));

        MoveTaskRequest request = new MoveTaskRequest(TaskStatus.DONE, 5000.0, 5L);
        TaskResponse response = taskService.moveTask(orgA, 77L, request, userId);

        assertNotNull(response);
        assertEquals(TaskStatus.DONE, response.getStatus());
        assertEquals(5000.0, response.getPosition());
        verify(outboxService, times(1)).recordEvent(eq("TASK"), eq("77"), eq("TASK_MOVED"), any(), any());
    }

    @Test
    void crossTenantTaskAccessIsBlocked() {
        // User attempts to access a task in orgB while claiming orgA or not being a member of orgB
        doThrow(new ForbiddenException("Access denied: You are not a member of organization " + orgB))
                .when(tenantSecurityService).verifyMembership(orgB, userId);

        assertThrows(ForbiddenException.class, () ->
                taskService.getTask(orgB, 77L, userId)
        );
    }
}
