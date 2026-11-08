package com.teamboard.common.exception;

import com.teamboard.common.dto.ErrorResponse;
import com.teamboard.common.filter.TraceIdFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException ex) {
        String traceId = TraceIdFilter.getCurrentTraceId();
        log.warn("API Exception [{}]: {}", traceId, ex.getMessage());

        HttpHeaders headers = new HttpHeaders();
        if (ex instanceof RateLimitExceededException rateLimitEx) {
            headers.add("Retry-After", String.valueOf(rateLimitEx.getRetryAfterSeconds()));
            headers.add("X-RateLimit-Reset", String.valueOf(System.currentTimeMillis() / 1000 + rateLimitEx.getRetryAfterSeconds()));
        }

        ErrorResponse response = new ErrorResponse(ex.getMessage(), null, traceId);
        return new ResponseEntity<>(response, headers, ex.getStatus());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationExceptions(MethodArgumentNotValidException ex) {
        String traceId = TraceIdFilter.getCurrentTraceId();
        Map<String, String> errors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(error.getField(), error.getDefaultMessage());
        }

        log.warn("Validation failed [{}]: {}", traceId, errors);
        ErrorResponse response = new ErrorResponse("Validation failed for one or more fields", errors, traceId);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLockingFailure(ObjectOptimisticLockingFailureException ex) {
        String traceId = TraceIdFilter.getCurrentTraceId();
        log.warn("Optimistic locking conflict [{}]: {}", traceId, ex.getMessage());
        ErrorResponse response = new ErrorResponse(
                "Conflict detected: The task was modified by another user. Please reload the board to see the latest changes.",
                null,
                traceId
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(AuthenticationException ex) {
        String traceId = TraceIdFilter.getCurrentTraceId();
        log.warn("Authentication failed [{}]: {}", traceId, ex.getMessage());
        ErrorResponse response = new ErrorResponse(ex.getMessage(), null, traceId);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(AccessDeniedException ex) {
        String traceId = TraceIdFilter.getCurrentTraceId();
        log.warn("Access denied [{}]: {}", traceId, ex.getMessage());
        ErrorResponse response = new ErrorResponse("You do not have permission to perform this action.", null, traceId);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneralException(Exception ex) {
        String traceId = TraceIdFilter.getCurrentTraceId();
        log.error("Unhandled exception [{}]: ", traceId, ex);
        ErrorResponse response = new ErrorResponse("An unexpected server error occurred. Reference trace: " + traceId, null, traceId);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
