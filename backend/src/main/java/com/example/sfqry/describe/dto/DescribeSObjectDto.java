package com.example.sfqry.describe.dto;

import java.util.List;

public record DescribeSObjectDto(
        String name,
        String label,
        boolean custom,
        boolean searchable,
        boolean layoutable,
        boolean retrieveable,
        boolean createable,
        boolean updateable,
        boolean deletable,
        boolean mergeable,
        boolean queryable,
        boolean triggerable,
        String keyPrefix,
        List<FieldDto> fields,
        List<ChildRelationshipDto> childRelationships) {}
