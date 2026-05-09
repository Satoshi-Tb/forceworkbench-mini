package com.example.sfqry.infra.salesforce;

import com.example.sfqry.auth.dto.LoginResultDto;
import com.example.sfqry.describe.dto.DescribeGlobalDto;
import com.example.sfqry.describe.dto.DescribeSObjectDto;
import com.example.sfqry.query.dto.QueryResultDto;

public interface SalesforceClient {
    LoginResultDto login(String email, String password);

    QueryResultDto query(String soql);

    String exportCsv(String soql);

    DescribeGlobalDto describeGlobal();

    DescribeSObjectDto describeSObject(String sobject);
}
