package com.teamboard.web.dto.task;

import com.teamboard.domain.task.TaskStatus;

import java.util.List;
import java.util.Map;

public class KanbanBoardResponse {
    private Long projectId;
    private String projectName;
    private Map<TaskStatus, List<TaskResponse>> columns;

    public KanbanBoardResponse() {
    }

    public KanbanBoardResponse(Long projectId, String projectName, Map<TaskStatus, List<TaskResponse>> columns) {
        this.projectId = projectId;
        this.projectName = projectName;
        this.columns = columns;
    }

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public Map<TaskStatus, List<TaskResponse>> getColumns() {
        return columns;
    }

    public void setColumns(Map<TaskStatus, List<TaskResponse>> columns) {
        this.columns = columns;
    }
}
