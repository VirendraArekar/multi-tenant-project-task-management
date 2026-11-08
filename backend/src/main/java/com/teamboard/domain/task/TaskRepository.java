package com.teamboard.domain.task;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    Optional<Task> findByIdAndOrganizationId(Long id, Long organizationId);

    Page<Task> findByOrganizationIdAndProjectId(Long organizationId, Long projectId, Pageable pageable);

    Page<Task> findByOrganizationIdAndProjectIdAndStatus(
            Long organizationId, Long projectId, TaskStatus status, Pageable pageable
    );

    @Query("SELECT t FROM Task t " +
            "LEFT JOIN FETCH t.assignee " +
            "LEFT JOIN FETCH t.labels " +
            "WHERE t.organizationId = :organizationId AND t.projectId = :projectId " +
            "ORDER BY t.position ASC")
    List<Task> findByOrganizationIdAndProjectIdOrderByPositionAsc(
            @Param("organizationId") Long organizationId,
            @Param("projectId") Long projectId
    );

    @Query("SELECT MAX(t.position) FROM Task t WHERE t.projectId = :projectId AND t.status = :status")
    Double findMaxPositionByProjectIdAndStatus(@Param("projectId") Long projectId, @Param("status") TaskStatus status);

    long countByOrganizationIdAndStatus(Long organizationId, TaskStatus status);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.organizationId = :organizationId AND t.dueDate < :today AND t.status != 'DONE'")
    long countOverdueTasks(@Param("organizationId") Long organizationId, @Param("today") LocalDate today);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.organizationId = :organizationId AND t.assigneeId = :userId AND t.status != 'DONE'")
    long countMyOpenTasks(@Param("organizationId") Long organizationId, @Param("userId") Long userId);

    @Query("SELECT t.assigneeId, COUNT(t) FROM Task t " +
            "WHERE t.organizationId = :organizationId AND t.assigneeId IS NOT NULL " +
            "GROUP BY t.assigneeId")
    List<Object[]> countTasksPerMember(@Param("organizationId") Long organizationId);

    @Query("SELECT t FROM Task t " +
            "LEFT JOIN FETCH t.assignee " +
            "WHERE t.organizationId = :organizationId AND t.dueDate < :today AND t.status != 'DONE' " +
            "ORDER BY t.dueDate ASC")
    List<Task> findOverdueTasksByOrganization(@Param("organizationId") Long organizationId, @Param("today") LocalDate today);

    @Query("SELECT t FROM Task t WHERE t.dueDate < :today AND t.status != 'DONE'")
    List<Task> findAllOverdueTasks(@Param("today") LocalDate today);
}
