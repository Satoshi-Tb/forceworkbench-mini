package com.example.sfqry.query;

import com.example.sfqry.common.SalesforceClient;
import org.springframework.stereotype.Service;

@Service
public class QueryService {

    private final SalesforceClient salesforceClient;

    public QueryService(SalesforceClient salesforceClient) {
        this.salesforceClient = salesforceClient;
    }

    public QueryResultDto query(String soql) {
        return salesforceClient.query(soql);
    }

    public QueryResultDto queryMore(String runId) {
        return salesforceClient.queryMore(runId);
    }

    public String exportCsv(String soql) {
        return salesforceClient.exportCsv(soql);
    }
}
