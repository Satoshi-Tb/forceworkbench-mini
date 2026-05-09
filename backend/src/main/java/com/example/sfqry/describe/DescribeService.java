package com.example.sfqry.describe;

import com.example.sfqry.infra.salesforce.SalesforceClient;
import com.example.sfqry.describe.dto.DescribeGlobalDto;
import com.example.sfqry.describe.dto.DescribeSObjectDto;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class DescribeService {

    private final SalesforceClient salesforceClient;

    public DescribeService(SalesforceClient salesforceClient) {
        this.salesforceClient = salesforceClient;
    }

    @Cacheable("describeGlobal")
    public DescribeGlobalDto describeGlobal() {
        return salesforceClient.describeGlobal();
    }

    @Cacheable(value = "describe", key = "#sobject")
    public DescribeSObjectDto describeSObject(String sobject) {
        return salesforceClient.describeSObject(sobject);
    }
}
