package com.teamboard.domain.activity;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    Page<ActivityLog> findByOrganizationId(Long organizationId, Pageable pageable);

    List<ActivityLog> findTop10ByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
}
