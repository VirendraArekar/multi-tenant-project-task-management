package com.teamboard.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.teamboard.domain.activity.ActivityLog;
import com.teamboard.domain.activity.ActivityLogRepository;
import com.teamboard.domain.task.TaskRepository;
import com.teamboard.domain.task.TaskStatus;
import com.teamboard.domain.user.User;
import com.teamboard.domain.user.UserRepository;
import com.teamboard.web.dto.dashboard.ActivityResponse;
import com.teamboard.web.dto.dashboard.DashboardResponse;
import com.teamboard.web.dto.dashboard.MemberTaskCountDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private static final Logger log = LoggerFactory.getLogger(DashboardService.class);
    private static final String DASHBOARD_CACHE_PREFIX = "cache:dashboard:";

    private final TaskRepository taskRepository;
    private final ActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;
    private final TenantSecurityService tenantSecurityService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, String> localDashboardCache = new ConcurrentHashMap<>();

    public DashboardService(
            TaskRepository taskRepository,
            ActivityLogRepository activityLogRepository,
            UserRepository userRepository,
            TenantSecurityService tenantSecurityService,
            @Autowired(required = false) StringRedisTemplate redisTemplate
    ) {
        this.taskRepository = taskRepository;
        this.activityLogRepository = activityLogRepository;
        this.userRepository = userRepository;
        this.tenantSecurityService = tenantSecurityService;
        this.redisTemplate = redisTemplate;
        this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(Long orgId, Long currentUserId) {
        tenantSecurityService.verifyMembership(orgId, currentUserId);

        String cacheKey = DASHBOARD_CACHE_PREFIX + orgId + ":" + currentUserId;

        // Try Redis cache
        try {
            if (redisTemplate != null) {
                String cachedJson = redisTemplate.opsForValue().get(cacheKey);
                if (cachedJson != null) {
                    return objectMapper.readValue(cachedJson, DashboardResponse.class);
                }
            }
        } catch (Exception e) {
            log.debug("Redis dashboard cache get error: {}", e.getMessage());
        }

        // Try local memory fallback
        String localJson = localDashboardCache.get(cacheKey);
        if (localJson != null) {
            try {
                return objectMapper.readValue(localJson, DashboardResponse.class);
            } catch (JsonProcessingException ignored) {
            }
        }

        // Compute real data
        LocalDate today = LocalDate.now();

        Map<TaskStatus, Long> countsByStatus = new LinkedHashMap<>();
        long totalTasks = 0;
        for (TaskStatus status : TaskStatus.values()) {
            long count = taskRepository.countByOrganizationIdAndStatus(orgId, status);
            countsByStatus.put(status, count);
            totalTasks += count;
        }

        long overdueTasks = taskRepository.countOverdueTasks(orgId, today);
        long myOpenTasks = taskRepository.countMyOpenTasks(orgId, currentUserId);

        // Tasks per member
        List<Object[]> memberTasksRaw = taskRepository.countTasksPerMember(orgId);
        List<MemberTaskCountDto> tasksPerMember = new ArrayList<>();
        for (Object[] row : memberTasksRaw) {
            Long memberUserId = (Long) row[0];
            Long count = (Long) row[1];
            userRepository.findById(memberUserId).ifPresent(u ->
                    tasksPerMember.add(new MemberTaskCountDto(u.getId(), u.getFullName(), u.getEmail(), count))
            );
        }

        // Recent activity feed
        List<ActivityLog> recentLogs = activityLogRepository.findTop10ByOrganizationIdOrderByCreatedAtDesc(orgId);
        List<ActivityResponse> recentActivity = recentLogs.stream()
                .map(log -> new ActivityResponse(
                        log.getId(),
                        log.getUserId(),
                        log.getUserName(),
                        log.getUserEmail(),
                        log.getAction(),
                        log.getEntityType(),
                        log.getEntityId(),
                        log.getEntityName(),
                        log.getDetails(),
                        log.getCreatedAt()
                ))
                .collect(Collectors.toList());

        DashboardResponse response = new DashboardResponse(
                countsByStatus,
                totalTasks,
                overdueTasks,
                myOpenTasks,
                tasksPerMember,
                recentActivity
        );

        // Cache result for 5 minutes
        try {
            String json = objectMapper.writeValueAsString(response);
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(cacheKey, json, Duration.ofMinutes(5));
            }
            localDashboardCache.put(cacheKey, json);
        } catch (Exception e) {
            log.debug("Failed to cache dashboard aggregates: {}", e.getMessage());
        }

        return response;
    }
}
