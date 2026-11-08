package com.teamboard.web.dto.task;

import java.time.Instant;

public class CommentResponse {
    private Long id;
    private Long taskId;
    private Long userId;
    private String authorName;
    private String authorEmail;
    private String content;
    private Instant createdAt;

    public CommentResponse() {
    }

    public CommentResponse(Long id, Long taskId, Long userId, String authorName,
                           String authorEmail, String content, Instant createdAt) {
        this.id = id;
        this.taskId = taskId;
        this.userId = userId;
        this.authorName = authorName;
        this.authorEmail = authorEmail;
        this.content = content;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public String getAuthorEmail() {
        return authorEmail;
    }

    public void setAuthorEmail(String authorEmail) {
        this.authorEmail = authorEmail;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
