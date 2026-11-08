package com.teamboard.service;

import com.teamboard.domain.activity.ActivityLog;
import com.teamboard.domain.activity.ActivityLogRepository;
import com.teamboard.domain.task.TaskRepository;
import com.teamboard.domain.task.TaskStatus;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.web.dto.dashboard.DashboardResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ActivityLogRepository activityLogRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TenantSecurityService tenantSecurityService;

    @InjectMocks
    private DashboardService dashboardService;

    private Long orgId = 1L;
    private Long userId = 10L;

    @Test
    void computesAccurateDashboardMetrics() {
        when(taskRepository.countByOrganizationIdAndStatus(orgId, TaskStatus.TODO)).thenReturn(4L);
        when(taskRepository.countByOrganizationIdAndStatus(orgId, TaskStatus.IN_PROGRESS)).thenReturn(2L);
        when(taskRepository.countByOrganizationIdAndStatus(orgId, TaskStatus.IN_REVIEW)).thenReturn(1L);
        when(taskRepository.countByOrganizationIdAndStatus(orgId, TaskStatus.DONE)).thenReturn(3L);

        when(taskRepository.countOverdueTasks(eq(orgId), any(LocalDate.class))).thenReturn(2L);
        when(taskRepository.countMyOpenTasks(orgId, userId)).thenReturn(3L);
        when(taskRepository.countTasksPerMember(orgId)).thenReturn(Collections.emptyList());

        ActivityLog log = new ActivityLog(orgId, userId, "user@test.com", "Alice", "CREATE", "TASK", 100L, "Task 1", null);
        when(activityLogRepository.findTop10ByOrganizationIdOrderByCreatedAtDesc(orgId)).thenReturn(List.of(log));

        DashboardResponse response = dashboardService.getDashboard(orgId, userId);

        assertNotNull(response);
        assertEquals(10L, response.getTotalTasks());
        assertEquals(4L, response.getCountsByStatus().get(TaskStatus.TODO));
        assertEquals(2L, response.getOverdueTasks());
        assertEquals(3L, response.getMyOpenTasks());
        assertEquals(1, response.getRecentActivity().size());
        assertEquals("CREATE", response.getRecentActivity().get(0).getAction());

        verify(tenantSecurityService, times(1)).verifyMembership(orgId, userId);
    }
}
