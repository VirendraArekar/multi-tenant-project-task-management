package com.teamboard.web.dto.dashboard;

public class MemberTaskCountDto {
    private Long userId;
    private String userName;
    private String userEmail;
    private long taskCount;

    public MemberTaskCountDto() {
    }

    public MemberTaskCountDto(Long userId, String userName, String userEmail, long taskCount) {
        this.userId = userId;
        this.userName = userName;
        this.userEmail = userEmail;
        this.taskCount = taskCount;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public long getTaskCount() {
        return taskCount;
    }

    public void setTaskCount(long taskCount) {
        this.taskCount = taskCount;
    }
}
