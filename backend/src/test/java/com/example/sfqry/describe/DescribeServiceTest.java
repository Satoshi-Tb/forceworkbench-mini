package com.example.sfqry.describe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.sfqry.describe.dto.DescribeGlobalDto;
import com.example.sfqry.describe.dto.DescribeSObjectDto;
import com.example.sfqry.infra.salesforce.SalesforceClient;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = DescribeService.class)
@Import(DescribeServiceTest.CacheConfig.class)
@DisplayName("Describeサービス")
class DescribeServiceTest {

    @Autowired
    private DescribeService describeService;

    @Autowired
    private CacheManager cacheManager;

    @MockitoBean
    private SalesforceClient salesforceClient;

    @BeforeEach
    void clearCache() {
        cacheManager.getCacheNames().forEach(name -> cacheManager.getCache(name).clear());
    }

    @Test
    @DisplayName("グローバルDescribeを返す")
    void describeGlobalReturnsSObjects() {
        when(salesforceClient.describeGlobal()).thenReturn(new DescribeGlobalDto(List.of(
                new DescribeGlobalDto.SObjectSummaryDto("Account", "Account", false, true))));

        DescribeGlobalDto result = describeService.describeGlobal();

        assertThat(result.sobjects())
                .extracting(DescribeGlobalDto.SObjectSummaryDto::name)
                .containsExactly("Account");
    }

    @Test
    @DisplayName("SObject Describeでフィールドを返す")
    void describeSObjectReturnsFields() {
        DescribeSObjectDto account = new DescribeSObjectDto(
                "Account",
                "Account",
                false,
                true,
                true,
                true,
                true,
                true,
                true,
                true,
                true,
                true,
                "001",
                List.of(),
                List.of());
        when(salesforceClient.describeSObject("Account")).thenReturn(account);

        DescribeSObjectDto result = describeService.describeSObject("Account");

        assertThat(result.name()).isEqualTo("Account");
        assertThat(result.keyPrefix()).isEqualTo("001");
    }

    @Test
    @DisplayName("グローバルDescribeはキャッシュされる")
    void describeGlobalIsCachedAcrossCalls() {
        when(salesforceClient.describeGlobal()).thenReturn(new DescribeGlobalDto(List.of()));

        describeService.describeGlobal();
        describeService.describeGlobal();

        verify(salesforceClient, times(1)).describeGlobal();
    }

    @Test
    @DisplayName("SObject Describeは名前ごとにキャッシュされる")
    void describeSObjectKeyedByName() {
        DescribeSObjectDto account = describeSObject("Account");
        DescribeSObjectDto contact = describeSObject("Contact");
        when(salesforceClient.describeSObject("Account")).thenReturn(account);
        when(salesforceClient.describeSObject("Contact")).thenReturn(contact);

        describeService.describeSObject("Account");
        describeService.describeSObject("Account");
        describeService.describeSObject("Contact");

        verify(salesforceClient, times(1)).describeSObject("Account");
        verify(salesforceClient, times(1)).describeSObject("Contact");
    }

    private static DescribeSObjectDto describeSObject(String name) {
        return new DescribeSObjectDto(
                name,
                name,
                false,
                true,
                true,
                true,
                true,
                true,
                true,
                true,
                true,
                true,
                null,
                List.of(),
                List.of());
    }

    @EnableCaching
    static class CacheConfig {
        @Bean
        CacheManager cacheManager() {
            return new ConcurrentMapCacheManager("describeGlobal", "describe");
        }
    }
}
