package com.teamboard.service;

import com.teamboard.domain.task.Task;
import com.teamboard.domain.task.TaskPriority;
import com.teamboard.domain.task.TaskRepository;
import com.teamboard.domain.task.TaskStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OverdueTaskSchedulerTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private OutboxService outboxService;

    @InjectMocks
    private OverdueTaskScheduler overdueTaskScheduler;

    @Test
    void scansOverdueTasksAndEmitsOutboxEvents() {
        Task overdueTask = new Task(1L, 10L, "Overdue Task", "Desc", TaskStatus.IN_PROGRESS, TaskPriority.URGENT, 5L, 2L, LocalDate.now().minusDays(2), 100.0);
        overdueTask.setId(999L);

        when(taskRepository.findAllOverdueTasks(any(LocalDate.class))).thenReturn(List.of(overdueTask));

        overdueTaskScheduler.scanAndEmitOverdueTasks();

        verify(outboxService, times(1)).recordEvent(
                eq("TASK"),
                eq("999"),
                eq("TASK_OVERDUE"),
                eq("overdue-events"),
                any()
        );
    }
}
