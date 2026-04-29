package com.example.sfqry.query;

import java.util.List;
import java.util.Map;

public record QueryResultDto(
        String queryRunId,
        List<String> columns,
        List<Map<String, String>> rows,
        boolean done) {}
