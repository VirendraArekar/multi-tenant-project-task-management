package com.teamboard.domain.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByOrganizationIdAndUserId(Long organizationId, Long userId, Pageable pageable);

    long countByOrganizationIdAndUserIdAndIsReadFalse(Long organizationId, Long userId);

    Optional<Notification> findByIdAndOrganizationIdAndUserId(Long id, Long organizationId, Long userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.organizationId = :orgId AND n.userId = :userId AND n.isRead = false")
    int markAllAsRead(@Param("orgId") Long organizationId, @Param("userId") Long userId);
}
