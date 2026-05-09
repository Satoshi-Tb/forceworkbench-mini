package com.example.sfqry.error;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    public static final String MALFORMED_QUERY = "MALFORMED_QUERY";
    public static final String INVALID_FIELD = "INVALID_FIELD";
    public static final String INVALID_SESSION_ID = "INVALID_SESSION_ID";
    public static final String QUERY_TIMEOUT = "QUERY_TIMEOUT";

    private final String code;
    private final HttpStatus status;

    public ApiException(String code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
