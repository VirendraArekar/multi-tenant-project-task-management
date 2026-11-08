package com.teamboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamboard.domain.outbox.OutboxEvent;
import com.teamboard.domain.outbox.OutboxEventRepository;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

@Component
public class OutboxRelayScheduler {

    private static final Logger log = LoggerFactory.getLogger(OutboxRelayScheduler.class);

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final EventConsumerService eventConsumerService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OutboxRelayScheduler(
            OutboxEventRepository outboxEventRepository,
            @Autowired(required = false) KafkaTemplate<String, String> kafkaTemplate,
            @Autowired(required = false) EventConsumerService eventConsumerService
    ) {
        this.outboxEventRepository = outboxEventRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.eventConsumerService = eventConsumerService;
    }

    @Scheduled(fixedDelayString = "${app.outbox.relay-interval-ms:1000}")
    @Transactional
    public void processOutboxBatch() {
        List<OutboxEvent> pending = outboxEventRepository.findPendingEvents(PageRequest.of(0, 50));
        if (pending.isEmpty()) {
            return;
        }

        for (OutboxEvent event : pending) {
            try {
                // Extract organizationId for partition key routing
                String partitionKey = event.getAggregateId();
                try {
                    JsonNode node = objectMapper.readTree(event.getPayload());
                    if (node.has("organizationId")) {
                        partitionKey = node.get("organizationId").asText();
                    }
                } catch (Exception ignored) {
                }

                if (kafkaTemplate != null) {
                    ProducerRecord<String, String> record = new ProducerRecord<>(
                            event.getTopic(),
                            partitionKey,
                            event.getPayload()
                    );
                    record.headers().add(new RecordHeader("eventId", event.getId().getBytes(StandardCharsets.UTF_8)));
                    record.headers().add(new RecordHeader("eventType", event.getEventType().getBytes(StandardCharsets.UTF_8)));
                    if (event.getTraceId() != null) {
                        record.headers().add(new RecordHeader("traceId", event.getTraceId().getBytes(StandardCharsets.UTF_8)));
                    }

                    kafkaTemplate.send(record).get(3, java.util.concurrent.TimeUnit.SECONDS);
                    event.setStatus("PUBLISHED");
                    event.setProcessedAt(Instant.now());
                } else if (eventConsumerService != null) {
                    // Local direct fallback if Kafka template is unavailable
                    eventConsumerService.processEvent(event.getId(), event.getTopic(), event.getEventType(), event.getPayload());
                    event.setStatus("PUBLISHED");
                    event.setProcessedAt(Instant.now());
                }
            } catch (Exception e) {
                log.warn("Failed to publish outbox event id={}: {}", event.getId(), e.getMessage());
                event.setRetryCount(event.getRetryCount() + 1);
                if (event.getRetryCount() >= 5) {
                    event.setStatus("FAILED");
                }
            }
        }

        outboxEventRepository.saveAll(pending);
    }
}
