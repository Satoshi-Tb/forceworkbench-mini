package com.example.sfqry.describe.dto;

import java.util.List;

public record DescribeGlobalDto(List<SObjectSummaryDto> sobjects) {
    public record SObjectSummaryDto(String name, String label, boolean custom, boolean queryable) {}
}
