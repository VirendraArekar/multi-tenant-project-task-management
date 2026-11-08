package com.teamboard.service;

import com.teamboard.domain.task.Task;
import com.teamboard.domain.task.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class OverdueTaskScheduler {

    private static final Logger log = LoggerFactory.getLogger(OverdueTaskScheduler.class);

    private final TaskRepository taskRepository;
    private final OutboxService outboxService;

    public OverdueTaskScheduler(TaskRepository taskRepository, OutboxService outboxService) {
        this.taskRepository = taskRepository;
        this.outboxService = outboxService;
    }

    // Runs every hour by default (0 0 * * * *)
    @Scheduled(cron = "${app.scheduling.overdue-cron:0 0 * * * *}")
    @Transactional
    public void scanAndEmitOverdueTasks() {
        LocalDate today = LocalDate.now();
        List<Task> overdueTasks = taskRepository.findAllOverdueTasks(today);

        log.info("Scanning for overdue tasks on date {}: found {} overdue task(s)", today, overdueTasks.size());

        for (Task task : overdueTasks) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("organizationId", task.getOrganizationId());
            payload.put("projectId", task.getProjectId());
            payload.put("taskId", task.getId());
            payload.put("title", task.getTitle());
            payload.put("dueDate", task.getDueDate().toString());
            payload.put("status", task.getStatus().name());
            payload.put("priority", task.getPriority().name());
            if (task.getAssigneeId() != null) {
                payload.put("assigneeId", task.getAssigneeId());
            }
            payload.put("reporterId", task.getReporterId());

            outboxService.recordEvent(
                    "TASK",
                    task.getId().toString(),
                    "TASK_OVERDUE",
                    "overdue-events",
                    payload
            );
        }
    }
}
