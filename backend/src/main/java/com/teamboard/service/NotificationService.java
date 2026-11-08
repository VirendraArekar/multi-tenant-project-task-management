package com.teamboard.service;

import com.teamboard.common.exception.ResourceNotFoundException;
import com.teamboard.domain.notification.Notification;
import com.teamboard.domain.notification.NotificationRepository;
import com.teamboard.web.dto.notification.NotificationResponse;
import com.teamboard.web.dto.notification.UnreadCountResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final TenantSecurityService tenantSecurityService;

    public NotificationService(
            NotificationRepository notificationRepository,
            TenantSecurityService tenantSecurityService
    ) {
        this.notificationRepository = notificationRepository;
        this.tenantSecurityService = tenantSecurityService;
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotifications(Long orgId, Long userId, Pageable pageable) {
        tenantSecurityService.verifyMembership(orgId, userId);

        Page<Notification> page = notificationRepository.findByOrganizationIdAndUserId(orgId, userId, pageable);
        return page.map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse getUnreadCount(Long orgId, Long userId) {
        tenantSecurityService.verifyMembership(orgId, userId);
        long count = notificationRepository.countByOrganizationIdAndUserIdAndIsReadFalse(orgId, userId);
        return new UnreadCountResponse(count);
    }

    @Transactional
    public void markAsRead(Long orgId, Long notificationId, Long userId) {
        tenantSecurityService.verifyMembership(orgId, userId);

        Notification notification = notificationRepository.findByIdAndOrganizationIdAndUserId(notificationId, orgId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id: " + notificationId));

        notification.setRead(true);
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(Long orgId, Long userId) {
        tenantSecurityService.verifyMembership(orgId, userId);
        notificationRepository.markAllAsRead(orgId, userId);
    }

    private NotificationResponse mapToResponse(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getOrganizationId(),
                n.getUserId(),
                n.getTitle(),
                n.getMessage(),
                n.getType(),
                n.getEntityType(),
                n.getEntityId(),
                n.isRead(),
                n.getCreatedAt()
        );
    }
}
