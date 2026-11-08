package com.teamboard.domain.organization;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationMemberRepository extends JpaRepository<OrganizationMember, Long> {

    Optional<OrganizationMember> findByOrganizationIdAndUserId(Long organizationId, Long userId);

    @Query("SELECT om FROM OrganizationMember om JOIN FETCH om.user WHERE om.organizationId = :organizationId")
    List<OrganizationMember> findByOrganizationIdWithUser(@Param("organizationId") Long organizationId);

    List<OrganizationMember> findByUserId(Long userId);

    boolean existsByOrganizationIdAndUserId(Long organizationId, Long userId);

    long countByOrganizationIdAndRole(Long organizationId, Role role);

    void deleteByOrganizationIdAndUserId(Long organizationId, Long userId);
}
