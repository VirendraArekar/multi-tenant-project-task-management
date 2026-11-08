package com.teamboard.web.dto.dashboard;

import com.teamboard.domain.task.TaskStatus;

import java.util.List;
import java.util.Map;

public class DashboardResponse {
    private Map<TaskStatus, Long> countsByStatus;
    private long totalTasks;
    private long overdueTasks;
    private long myOpenTasks;
    private List<MemberTaskCountDto> tasksPerMember;
    private List<ActivityResponse> recentActivity;

    public DashboardResponse() {
    }

    public DashboardResponse(Map<TaskStatus, Long> countsByStatus, long totalTasks,
                             long overdueTasks, long myOpenTasks,
                             List<MemberTaskCountDto> tasksPerMember,
                             List<ActivityResponse> recentActivity) {
        this.countsByStatus = countsByStatus;
        this.totalTasks = totalTasks;
        this.overdueTasks = overdueTasks;
        this.myOpenTasks = myOpenTasks;
        this.tasksPerMember = tasksPerMember;
        this.recentActivity = recentActivity;
    }

    public Map<TaskStatus, Long> getCountsByStatus() {
        return countsByStatus;
    }

    public void setCountsByStatus(Map<TaskStatus, Long> countsByStatus) {
        this.countsByStatus = countsByStatus;
    }

    public long getTotalTasks() {
        return totalTasks;
    }

    public void setTotalTasks(long totalTasks) {
        this.totalTasks = totalTasks;
    }

    public long getOverdueTasks() {
        return overdueTasks;
    }

    public void setOverdueTasks(long overdueTasks) {
        this.overdueTasks = overdueTasks;
    }

    public long getMyOpenTasks() {
        return myOpenTasks;
    }

    public void setMyOpenTasks(long myOpenTasks) {
        this.myOpenTasks = myOpenTasks;
    }

    public List<MemberTaskCountDto> getTasksPerMember() {
        return tasksPerMember;
    }

    public void setTasksPerMember(List<MemberTaskCountDto> tasksPerMember) {
        this.tasksPerMember = tasksPerMember;
    }

    public List<ActivityResponse> getRecentActivity() {
        return recentActivity;
    }

    public void setRecentActivity(List<ActivityResponse> recentActivity) {
        this.recentActivity = recentActivity;
    }
}
