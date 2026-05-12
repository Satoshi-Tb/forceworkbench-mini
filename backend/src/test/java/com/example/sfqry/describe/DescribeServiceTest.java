package com.example.sfqry.describe;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.sfqry.describe.dto.DescribeGlobalDto;
import com.example.sfqry.describe.dto.DescribeSObjectDto;
import com.example.sfqry.infra.salesforce.MockSalesforceClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Describeサービス")
class DescribeServiceTest {

    private final DescribeService describeService = new DescribeService(
            new MockSalesforceClient(new ObjectMapper(), "test@example.com", "test"));

    @Test
    @DisplayName("グローバルDescribeを返す")
    void describeGlobalReturnsSObjects() {
        DescribeGlobalDto result = describeService.describeGlobal();

        assertThat(result.sobjects())
                .extracting(DescribeGlobalDto.SObjectSummaryDto::name)
                .contains("Account", "Contact", "Opportunity", "Invoice__c");
    }

    @Test
    @DisplayName("SObject Describeでフィールドを返す")
    void describeSObjectReturnsFields() {
        DescribeSObjectDto result = describeService.describeSObject("Account");

        assertThat(result.name()).isEqualTo("Account");
        assertThat(result.keyPrefix()).isEqualTo("001");
    }
}
