package com.example.sfqry.query;

import com.example.sfqry.auth.SessionContext;
import com.example.sfqry.common.SalesforceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class QueryService {

    private static final Logger audit = LoggerFactory.getLogger("audit");

    private final SalesforceClient salesforceClient;
    private final SessionContext sessionContext;

    public QueryService(SalesforceClient salesforceClient, SessionContext sessionContext) {
        this.salesforceClient = salesforceClient;
        this.sessionContext = sessionContext;
    }

    public QueryResultDto query(String soql) {
        SoqlQueryGuard.validateSelectQuery(soql);
        audit.info("QUERY user={} soql={}", currentEmail(), soql);
        return salesforceClient.query(soql);
    }

    public String exportCsv(String soql) {
        SoqlQueryGuard.validateSelectQuery(soql);
        audit.info("CSV user={} soql={}", currentEmail(), soql);
        return salesforceClient.exportCsv(soql);
    }

    private String currentEmail() {
        return sessionContext.getUserInfo() == null
                ? "anonymous"
                : sessionContext.getUserInfo().email();
    }
}
