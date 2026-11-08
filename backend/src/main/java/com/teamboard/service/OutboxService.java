package com.teamboard.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.teamboard.common.filter.TraceIdFilter;
import com.teamboard.domain.outbox.OutboxEvent;
import com.teamboard.domain.outbox.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboxService {

    private static final Logger log = LoggerFactory.getLogger(OutboxService.class);

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public OutboxService(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordEvent(String aggregateType, String aggregateId, String eventType, String topic, Object payload) {
        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            String traceId = TraceIdFilter.getCurrentTraceId();

            OutboxEvent event = new OutboxEvent(aggregateType, aggregateId, eventType, topic, payloadJson, traceId);
            outboxEventRepository.save(event);
            log.debug("Recorded outbox event: id={}, type={}, topic={}", event.getId(), eventType, topic);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize outbox event payload: {}", e.getMessage(), e);
            throw new RuntimeException("Could not serialize domain event", e);
        }
    }
}
