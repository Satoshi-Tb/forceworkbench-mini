package com.example.sfqry.common;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ErrorAdvice {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> handleApiException(ApiException e) {
        return ResponseEntity
                .status(e.getStatus())
                .body(Map.of("code", e.getCode(), "message", e.getMessage()));
    }
}
