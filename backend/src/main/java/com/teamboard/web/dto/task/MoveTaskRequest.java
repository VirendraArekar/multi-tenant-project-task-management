package com.teamboard.web.dto.task;

import com.teamboard.domain.task.TaskStatus;
import jakarta.validation.constraints.NotNull;

public class MoveTaskRequest {

    @NotNull(message = "Target status is required")
    private TaskStatus targetStatus;

    @NotNull(message = "Target position is required")
    private Double targetPosition;

    @NotNull(message = "Version is required for concurrency control")
    private Long version;

    public MoveTaskRequest() {
    }

    public MoveTaskRequest(TaskStatus targetStatus, Double targetPosition, Long version) {
        this.targetStatus = targetStatus;
        this.targetPosition = targetPosition;
        this.version = version;
    }

    public TaskStatus getTargetStatus() {
        return targetStatus;
    }

    public void setTargetStatus(TaskStatus targetStatus) {
        this.targetStatus = targetStatus;
    }

    public Double getTargetPosition() {
        return targetPosition;
    }

    public void setTargetPosition(Double targetPosition) {
        this.targetPosition = targetPosition;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }
}
