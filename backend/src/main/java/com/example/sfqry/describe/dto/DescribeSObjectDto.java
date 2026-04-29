package com.example.sfqry.describe.dto;

import java.util.List;

public record DescribeSObjectDto(
        String name,
        String label,
        List<FieldDto> fields,
        List<ChildRelationshipDto> childRelationships) {}
