package com.teamboard.web.dto.task;

import jakarta.validation.constraints.NotBlank;

public class AddCommentRequest {

    @NotBlank(message = "Comment content cannot be blank")
    private String content;

    public AddCommentRequest() {
    }

    public AddCommentRequest(String content) {
        this.content = content;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
