package com.teamboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamboard.domain.activity.ActivityLog;
import com.teamboard.domain.activity.ActivityLogRepository;
import com.teamboard.domain.notification.Notification;
import com.teamboard.domain.notification.NotificationRepository;
import com.teamboard.domain.outbox.ProcessedEvent;
import com.teamboard.domain.outbox.ProcessedEventRepository;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

@Service
public class EventConsumerService {

    private static final Logger log = LoggerFactory.getLogger(EventConsumerService.class);

    private final ProcessedEventRepository processedEventRepository;
    private final ActivityLogRepository activityLogRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final CacheInvalidationService cacheInvalidationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public EventConsumerService(
            ProcessedEventRepository processedEventRepository,
            ActivityLogRepository activityLogRepository,
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            @Autowired(required = false) KafkaTemplate<String, String> kafkaTemplate,
            @Autowired(required = false) CacheInvalidationService cacheInvalidationService
    ) {
        this.processedEventRepository = processedEventRepository;
        this.activityLogRepository = activityLogRepository;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.cacheInvalidationService = cacheInvalidationService;
    }

    @KafkaListener(
            topics = {"task-events", "comment-events", "membership-events", "overdue-events"},
            groupId = "teamboard-consumer-group",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void onKafkaMessage(ConsumerRecord<String, String> record) {
        String eventId = extractHeader(record, "eventId");
        String eventType = extractHeader(record, "eventType");

        if (eventId == null || eventId.isBlank()) {
            eventId = record.topic() + "-" + record.partition() + "-" + record.offset();
        }

        try {
            processEvent(eventId, record.topic(), eventType, record.value());
        } catch (Exception e) {
            log.error("Error processing event from Kafka topic {}, sending to DLQ: {}", record.topic(), e.getMessage(), e);
            sendToDeadLetterQueue(record, e.getMessage());
        }
    }

    @Transactional
    public void processEvent(String eventId, String topic, String eventType, String payloadJson) {
        // Idempotency check: deduplicate by eventId
        if (processedEventRepository.existsById(eventId)) {
            log.debug("Event {} has already been processed. Skipping.", eventId);
            return;
        }

        try {
            JsonNode payload = objectMapper.readTree(payloadJson);
            Long orgId = payload.has("organizationId") ? payload.get("organizationId").asLong() : null;

            if (orgId == null) {
                log.warn("Event {} payload missing organizationId, skipping", eventId);
                processedEventRepository.save(new ProcessedEvent(eventId));
                return;
            }

            switch (eventType != null ? eventType : "") {
                case "TASK_CREATED" -> handleTaskCreated(orgId, payload);
                case "TASK_UPDATED" -> handleTaskUpdated(orgId, payload);
                case "TASK_MOVED" -> handleTaskMoved(orgId, payload);
                case "TASK_DELETED" -> handleTaskDeleted(orgId, payload);
                case "TASK_ASSIGNED" -> handleTaskAssigned(orgId, payload);
                case "PROJECT_CREATED" -> handleProjectCreated(orgId, payload);
                case "PROJECT_UPDATED" -> handleProjectUpdated(orgId, payload);
                case "PROJECT_ARCHIVED" -> handleProjectArchived(orgId, payload);
                case "PROJECT_DELETED" -> handleProjectDeleted(orgId, payload);
                case "COMMENT_ADDED" -> handleCommentAdded(orgId, payload);
                case "MEMBER_INVITED" -> handleMemberInvited(orgId, payload);
                case "MEMBER_JOINED" -> handleMemberJoined(orgId, payload);
                case "ROLE_CHANGED" -> handleRoleChanged(orgId, payload);
                case "MEMBER_REMOVED" -> handleMemberRemoved(orgId, payload);
                case "TASK_OVERDUE" -> handleTaskOverdue(orgId, payload);
                default -> log.debug("Unhandled event type: {}", eventType);
            }

            // Invalidate dashboard cache
            if (cacheInvalidationService != null) {
                cacheInvalidationService.invalidateDashboard(orgId);
            }

            // Mark event as processed for idempotency
            processedEventRepository.save(new ProcessedEvent(eventId));
            log.debug("Successfully processed and recorded event: {}", eventId);

        } catch (Exception e) {
            log.error("Failed to parse/process event payload: {}", e.getMessage(), e);
            throw new RuntimeException("Consumer event processing failed", e);
        }
    }

    private void handleTaskCreated(Long orgId, JsonNode payload) {
        Long taskId = payload.get("taskId").asLong();
        String title = payload.get("title").asText();
        Long reporterId = payload.has("reporterId") ? payload.get("reporterId").asLong() : null;
        String reporterName = payload.has("reporterName") ? payload.get("reporterName").asText() : null;

        activityLogRepository.save(new ActivityLog(
                orgId, reporterId, null, reporterName, "CREATE", "TASK", taskId, title,
                "Created task '" + title + "'"
        ));
    }

    private void handleTaskUpdated(Long orgId, JsonNode payload) {
        Long taskId = payload.get("taskId").asLong();
        String title = payload.get("title").asText();
        Long updatedBy = payload.has("updatedBy") ? payload.get("updatedBy").asLong() : null;
        String userName = getUserName(updatedBy);

        activityLogRepository.save(new ActivityLog(
                orgId, updatedBy, null, userName, "UPDATE", "TASK", taskId, title,
                "Updated task '" + title + "'"
        ));
    }

    private void handleTaskMoved(Long orgId, JsonNode payload) {
        Long taskId = payload.get("taskId").asLong();
        String title = payload.get("title").asText();
        String oldStatus = payload.get("oldStatus").asText();
        String newStatus = payload.get("newStatus").asText();
        Long updatedBy = payload.has("updatedBy") ? payload.get("updatedBy").asLong() : null;
        String userName = getUserName(updatedBy);

        activityLogRepository.save(new ActivityLog(
                orgId, updatedBy, null, userName, "MOVE", "TASK", taskId, title,
                "Moved task from " + oldStatus + " to " + newStatus
        ));
    }

    private void handleTaskDeleted(Long orgId, JsonNode payload) {
        Long taskId = payload.get("taskId").asLong();
        String title = payload.get("title").asText();
        Long deletedBy = payload.has("deletedBy") ? payload.get("deletedBy").asLong() : null;
        String userName = getUserName(deletedBy);

        activityLogRepository.save(new ActivityLog(
                orgId, deletedBy, null, userName, "DELETE", "TASK", taskId, title,
                "Deleted task '" + title + "'"
        ));
    }

    private void handleTaskAssigned(Long orgId, JsonNode payload) {
        Long taskId = payload.get("taskId").asLong();
        String title = payload.get("title").asText();
        Long assigneeId = payload.has("assigneeId") ? payload.get("assigneeId").asLong() : null;
        String assigneeName = payload.has("assigneeName") ? payload.get("assigneeName").asText() : null;

        if (assigneeId != null) {
            notificationRepository.save(new Notification(
                    orgId,
                    assigneeId,
                    "Task Assigned: " + title,
                    "You were assigned to task: " + title,
                    "TASK_ASSIGNED",
                    "TASK",
                    taskId
            ));

            activityLogRepository.save(new ActivityLog(
                    orgId, null, null, null, "ASSIGN", "TASK", taskId, title,
                    "Task assigned to " + assigneeName
            ));
        }
    }

    private void handleProjectCreated(Long orgId, JsonNode payload) {
        Long projectId = payload.get("projectId").asLong();
        String name = payload.get("name").asText();
        Long createdBy = payload.has("createdBy") ? payload.get("createdBy").asLong() : null;
        String creatorName = payload.has("creatorName") ? payload.get("creatorName").asText() : null;

        activityLogRepository.save(new ActivityLog(
                orgId, createdBy, null, creatorName, "CREATE", "PROJECT", projectId, name,
                "Created project '" + name + "'"
        ));
    }

    private void handleProjectUpdated(Long orgId, JsonNode payload) {
        Long projectId = payload.get("projectId").asLong();
        String name = payload.get("name").asText();
        Long updatedBy = payload.has("updatedBy") ? payload.get("updatedBy").asLong() : null;
        String userName = getUserName(updatedBy);

        activityLogRepository.save(new ActivityLog(
                orgId, updatedBy, null, userName, "UPDATE", "PROJECT", projectId, name,
                "Updated project '" + name + "'"
        ));
    }

    private void handleProjectArchived(Long orgId, JsonNode payload) {
        Long projectId = payload.get("projectId").asLong();
        boolean archived = payload.get("archived").asBoolean();
        Long updatedBy = payload.has("updatedBy") ? payload.get("updatedBy").asLong() : null;
        String userName = getUserName(updatedBy);

        activityLogRepository.save(new ActivityLog(
                orgId, updatedBy, null, userName, archived ? "ARCHIVE" : "UNARCHIVE", "PROJECT", projectId, null,
                archived ? "Archived project" : "Unarchived project"
        ));
    }

    private void handleProjectDeleted(Long orgId, JsonNode payload) {
        Long projectId = payload.get("projectId").asLong();
        String name = payload.has("name") ? payload.get("name").asText() : "Project";
        Long deletedBy = payload.has("deletedBy") ? payload.get("deletedBy").asLong() : null;
        String userName = getUserName(deletedBy);

        activityLogRepository.save(new ActivityLog(
                orgId, deletedBy, null, userName, "DELETE", "PROJECT", projectId, name,
                "Deleted project '" + name + "'"
        ));
    }

    private void handleCommentAdded(Long orgId, JsonNode payload) {
        Long taskId = payload.get("taskId").asLong();
        String taskTitle = payload.get("taskTitle").asText();
        Long commentId = payload.get("commentId").asLong();
        Long authorId = payload.get("authorId").asLong();
        String authorName = payload.get("authorName").asText();
        String contentPreview = payload.get("contentPreview").asText();

        activityLogRepository.save(new ActivityLog(
                orgId, authorId, null, authorName, "COMMENT", "TASK", taskId, taskTitle,
                authorName + ": \"" + contentPreview + "\""
        ));

        // Notify assignee and reporter if they are not the author
        Long assigneeId = payload.has("assigneeId") ? payload.get("assigneeId").asLong() : 0L;
        Long reporterId = payload.has("reporterId") ? payload.get("reporterId").asLong() : 0L;

        if (assigneeId > 0 && !assigneeId.equals(authorId)) {
            notificationRepository.save(new Notification(
                    orgId,
                    assigneeId,
                    "New comment on: " + taskTitle,
                    authorName + " commented: " + contentPreview,
                    "COMMENT_ADDED",
                    "TASK",
                    taskId
            ));
        }

        if (reporterId > 0 && !reporterId.equals(authorId) && !reporterId.equals(assigneeId)) {
            notificationRepository.save(new Notification(
                    orgId,
                    reporterId,
                    "New comment on: " + taskTitle,
                    authorName + " commented: " + contentPreview,
                    "COMMENT_ADDED",
                    "TASK",
                    taskId
            ));
        }
    }

    private void handleMemberInvited(Long orgId, JsonNode payload) {
        String email = payload.get("email").asText();
        String role = payload.get("role").asText();
        String inviterName = payload.has("inviterName") ? payload.get("inviterName").asText() : "A team member";

        activityLogRepository.save(new ActivityLog(
                orgId, null, email, null, "INVITE", "MEMBER", 0L, email,
                inviterName + " invited " + email + " as " + role
        ));
    }

    private void handleMemberJoined(Long orgId, JsonNode payload) {
        Long userId = payload.get("userId").asLong();
        String userEmail = payload.get("userEmail").asText();
        String userName = payload.get("userName").asText();
        String role = payload.get("role").asText();

        activityLogRepository.save(new ActivityLog(
                orgId, userId, userEmail, userName, "JOIN", "MEMBER", userId, userName,
                userName + " joined the workspace as " + role
        ));
    }

    private void handleRoleChanged(Long orgId, JsonNode payload) {
        Long targetUserId = payload.get("targetUserId").asLong();
        String newRole = payload.get("newRole").asText();
        Long updatedBy = payload.has("updatedBy") ? payload.get("updatedBy").asLong() : null;
        String userName = getUserName(targetUserId);

        activityLogRepository.save(new ActivityLog(
                orgId, updatedBy, null, null, "ROLE_CHANGE", "MEMBER", targetUserId, userName,
                "Changed role of " + userName + " to " + newRole
        ));

        notificationRepository.save(new Notification(
                orgId,
                targetUserId,
                "Role Updated",
                "Your role has been changed to " + newRole,
                "ROLE_CHANGED",
                "ORGANIZATION",
                orgId
        ));
    }

    private void handleMemberRemoved(Long orgId, JsonNode payload) {
        Long targetUserId = payload.get("targetUserId").asLong();
        Long removedBy = payload.has("removedBy") ? payload.get("removedBy").asLong() : null;
        String userName = getUserName(targetUserId);

        activityLogRepository.save(new ActivityLog(
                orgId, removedBy, null, null, "REMOVE", "MEMBER", targetUserId, userName,
                "Removed member " + userName + " from workspace"
        ));
    }

    private void handleTaskOverdue(Long orgId, JsonNode payload) {
        Long taskId = payload.get("taskId").asLong();
        String title = payload.get("title").asText();
        String dueDate = payload.has("dueDate") ? payload.get("dueDate").asText() : "";
        Long assigneeId = payload.has("assigneeId") ? payload.get("assigneeId").asLong() : null;
        Long reporterId = payload.has("reporterId") ? payload.get("reporterId").asLong() : null;

        activityLogRepository.save(new ActivityLog(
                orgId, null, null, "System", "OVERDUE", "TASK", taskId, title,
                "Task '" + title + "' is overdue (due: " + dueDate + ")"
        ));

        Long recipient = assigneeId != null ? assigneeId : reporterId;
        if (recipient != null) {
            notificationRepository.save(new Notification(
                    orgId,
                    recipient,
                    "Task Overdue: " + title,
                    "Task '" + title + "' was due on " + dueDate + " and is still incomplete.",
                    "TASK_OVERDUE",
                    "TASK",
                    taskId
            ));
        }
    }

    private void sendToDeadLetterQueue(ConsumerRecord<String, String> record, String errorMessage) {
        try {
            if (kafkaTemplate != null) {
                String dlqTopic = "teamboard-dead-letter";
                kafkaTemplate.send(dlqTopic, record.key(), record.value());
                log.warn("Sent poison message from topic {} partition {} offset {} to DLQ: {}",
                        record.topic(), record.partition(), record.offset(), errorMessage);
            }
        } catch (Exception dlqEx) {
            log.error("Failed to forward poison message to DLQ: {}", dlqEx.getMessage(), dlqEx);
        }
    }

    private String getUserName(Long userId) {
        if (userId == null) return "User";
        return userRepository.findById(userId).map(User::getFullName).orElse("User");
    }

    private String extractHeader(ConsumerRecord<String, String> record, String headerKey) {
        Header header = record.headers().lastHeader(headerKey);
        if (header != null && header.value() != null) {
            return new String(header.value(), StandardCharsets.UTF_8);
        }
        return null;
    }
}
