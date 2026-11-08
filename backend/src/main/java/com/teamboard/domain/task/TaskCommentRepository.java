package com.teamboard.domain.task;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {

    @Query(
            value = "SELECT c FROM TaskComment c JOIN FETCH c.author WHERE c.organizationId = :organizationId AND c.taskId = :taskId ORDER BY c.createdAt ASC",
            countQuery = "SELECT COUNT(c) FROM TaskComment c WHERE c.organizationId = :organizationId AND c.taskId = :taskId"
    )
    Page<TaskComment> findByOrganizationIdAndTaskId(
            @Param("organizationId") Long organizationId,
            @Param("taskId") Long taskId,
            Pageable pageable
    );
}
