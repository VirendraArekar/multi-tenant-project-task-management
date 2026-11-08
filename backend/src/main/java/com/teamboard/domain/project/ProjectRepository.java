package com.teamboard.domain.project;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    Optional<Project> findByIdAndOrganizationId(Long id, Long organizationId);

    Page<Project> findByOrganizationId(Long organizationId, Pageable pageable);

    Page<Project> findByOrganizationIdAndIsArchived(Long organizationId, boolean isArchived, Pageable pageable);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    long countByOrganizationIdAndIsArchived(Long organizationId, boolean isArchived);
}
