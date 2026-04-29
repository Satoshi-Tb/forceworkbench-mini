package com.example.sfqry.common;

import com.example.sfqry.describe.dto.DescribeGlobalDto;
import com.example.sfqry.describe.dto.DescribeSObjectDto;
import com.example.sfqry.query.QueryResultDto;

public interface SalesforceClient {
    QueryResultDto query(String soql);

    QueryResultDto queryMore(String runId);

    String exportCsv(String soql);

    DescribeGlobalDto describeGlobal();

    DescribeSObjectDto describeSObject(String sobject);
}
