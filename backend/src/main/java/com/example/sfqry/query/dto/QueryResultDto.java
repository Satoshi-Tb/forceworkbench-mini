package com.example.sfqry.query.dto;

import java.util.List;
import java.util.Map;

public record QueryResultDto(
        List<String> columns,
        List<Map<String, String>> rows,
        boolean limitExceeded) {}
