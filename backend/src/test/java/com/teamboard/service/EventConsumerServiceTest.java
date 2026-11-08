package com.teamboard.service;

import com.teamboard.domain.activity.ActivityLog;
import com.teamboard.domain.activity.ActivityLogRepository;
import com.teamboard.domain.notification.Notification;
import com.teamboard.domain.notification.NotificationRepository;
import com.teamboard.domain.outbox.ProcessedEvent;
import com.teamboard.domain.outbox.ProcessedEventRepository;
import com.teamboard.domain.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EventConsumerServiceTest {

    @Mock
    private ProcessedEventRepository processedEventRepository;

    @Mock
    private ActivityLogRepository activityLogRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CacheInvalidationService cacheInvalidationService;

    @InjectMocks
    private EventConsumerService eventConsumerService;

    @Test
    void processesTaskAssignedAndCreatesNotificationAndActivity() {
        String eventId = "evt-12345";
        when(processedEventRepository.existsById(eventId)).thenReturn(false);

        String payload = """
                {
                  "organizationId": 1,
                  "projectId": 10,
                  "taskId": 101,
                  "title": "Fix Auth Bug",
                  "assigneeId": 99,
                  "assigneeName": "Bob"
                }
                """;

        eventConsumerService.processEvent(eventId, "task-events", "TASK_ASSIGNED", payload);

        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(activityLogRepository, times(1)).save(any(ActivityLog.class));
        verify(processedEventRepository, times(1)).save(any(ProcessedEvent.class));
    }

    @Test
    void idempotentConsumerIgnoresDuplicateEventId() {
        String eventId = "duplicate-evt";
        when(processedEventRepository.existsById(eventId)).thenReturn(true);

        eventConsumerService.processEvent(eventId, "task-events", "TASK_ASSIGNED", "{}");

        verify(notificationRepository, never()).save(any());
        verify(activityLogRepository, never()).save(any());
        verify(processedEventRepository, never()).save(any());
    }

    @Test
    void processesCommentAddedAndNotifiesAssignee() {
        String eventId = "evt-comment-1";
        when(processedEventRepository.existsById(eventId)).thenReturn(false);

        String payload = """
                {
                  "organizationId": 1,
                  "projectId": 10,
                  "taskId": 101,
                  "taskTitle": "Fix Auth Bug",
                  "commentId": 501,
                  "authorId": 1,
                  "authorName": "Alice",
                  "assigneeId": 2,
                  "reporterId": 3,
                  "contentPreview": "Please check this commit"
                }
                """;

        eventConsumerService.processEvent(eventId, "comment-events", "COMMENT_ADDED", payload);

        // Notifies both assignee (2) and reporter (3) since author is 1
        verify(notificationRepository, times(2)).save(any(Notification.class));
        verify(activityLogRepository, times(1)).save(any(ActivityLog.class));
        verify(processedEventRepository, times(1)).save(any(ProcessedEvent.class));
    }
}
