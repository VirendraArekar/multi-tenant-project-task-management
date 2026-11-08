package com.teamboard.domain.organization;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationInviteRepository extends JpaRepository<OrganizationInvite, Long> {

    @Query("SELECT oi FROM OrganizationInvite oi JOIN FETCH oi.organization WHERE oi.token = :token")
    Optional<OrganizationInvite> findByTokenWithOrganization(@Param("token") String token);

    Optional<OrganizationInvite> findByToken(String token);

    List<OrganizationInvite> findByOrganizationIdAndAcceptedAtIsNull(Long organizationId);

    Optional<OrganizationInvite> findByOrganizationIdAndEmailAndAcceptedAtIsNull(Long organizationId, String email);
}
