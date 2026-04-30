package com.example.sfqry.common;

import com.example.sfqry.auth.SessionContext;
import com.example.sfqry.auth.UserInfo;
import com.example.sfqry.config.PartnerConnectionFactory;
import com.example.sfqry.config.SalesforceProperties;
import com.example.sfqry.describe.dto.ChildRelationshipDto;
import com.example.sfqry.describe.dto.DescribeGlobalDto;
import com.example.sfqry.describe.dto.DescribeSObjectDto;
import com.example.sfqry.describe.dto.FieldDto;
import com.example.sfqry.query.QueryResultDto;
import com.example.sfqry.query.QueryRunState;
import com.sforce.soap.partner.ChildRelationship;
import com.sforce.soap.partner.DescribeGlobalResult;
import com.sforce.soap.partner.DescribeGlobalSObjectResult;
import com.sforce.soap.partner.DescribeSObjectResult;
import com.sforce.soap.partner.Field;
import com.sforce.soap.partner.GetUserInfoResult;
import com.sforce.soap.partner.PartnerConnection;
import com.sforce.soap.partner.QueryResult;
import com.sforce.soap.partner.fault.ApiFault;
import com.sforce.soap.partner.fault.LoginFault;
import com.sforce.soap.partner.sobject.SObject;
import com.sforce.ws.ConnectionException;
import com.sforce.ws.bind.XmlObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Profile("!mock")
@Service
public class SoapSalesforceClient implements SalesforceClient {

    private static final Logger log = LoggerFactory.getLogger(SoapSalesforceClient.class);

    private final SalesforceProperties props;
    private final PartnerConnectionFactory connectionFactory;
    private final SessionContext sessionContext;

    public SoapSalesforceClient(
            SalesforceProperties props,
            PartnerConnectionFactory connectionFactory,
            SessionContext sessionContext) {
        this.props = props;
        this.connectionFactory = connectionFactory;
        this.sessionContext = sessionContext;
    }

    @Override
    public LoginResult login(String email, String password) {
        if (props.username() == null || props.username().isBlank()
                || props.password() == null || props.password().isBlank()) {
            throw new ApiException(
                    "INVALID_LOGIN",
                    "Salesforce credentials are not configured",
                    HttpStatus.UNAUTHORIZED);
        }
        byte[] expectedEmailBytes = props.username().getBytes(StandardCharsets.UTF_8);
        byte[] expectedPasswordBytes = props.password().getBytes(StandardCharsets.UTF_8);
        byte[] emailBytes = email.getBytes(StandardCharsets.UTF_8);
        byte[] passwordBytes = password.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(emailBytes, expectedEmailBytes)
                || !MessageDigest.isEqual(passwordBytes, expectedPasswordBytes)) {
            throw new ApiException("INVALID_LOGIN", "Invalid credentials", HttpStatus.UNAUTHORIZED);
        }
        try {
            PartnerConnection conn = connectionFactory.createForLogin(email, salesforcePassword(password));
            conn.getServerTimestamp();
            GetUserInfoResult ui = conn.getUserInfo();
            String sessionId = conn.getConfig().getSessionId();
            String serviceEndpoint = conn.getConfig().getServiceEndpoint();
            String instanceUrl = serviceEndpoint.substring(0, serviceEndpoint.indexOf("/services/"));
            UserInfo userInfo = new UserInfo(
                    ui.getUserEmail(),
                    ui.getUserFullName(),
                    ui.getOrganizationId(),
                    ui.getUserId());
            return new LoginResult(sessionId, instanceUrl, userInfo);
        } catch (LoginFault e) {
            throw new ApiException("INVALID_LOGIN", e.getExceptionMessage(), HttpStatus.UNAUTHORIZED);
        } catch (ApiFault e) {
            String code = e.getExceptionCode() == null
                    ? e.getClass().getSimpleName()
                    : e.getExceptionCode().name();
            throw new ApiException(code, apiFaultMessage(e), HttpStatus.SERVICE_UNAVAILABLE);
        } catch (ConnectionException e) {
            log.warn(
                    "Salesforce SOAP login failed: endpoint={}, exception={}, cause={}",
                    connectionFactory.loginEndpoint(),
                    e.getClass().getName(),
                    e.getCause() == null ? "" : e.getCause().getClass().getName());
            throw new ApiException("LOGIN_FAILED", errorMessage(e), HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private String salesforcePassword(String password) {
        return password + (props.securityToken() == null ? "" : props.securityToken());
    }

    @Override
    public QueryResultDto query(String soql) {
        try {
            PartnerConnection conn = queryConnection();
            QueryResult qr = conn.query(soql);
            String runId = qr.isDone() ? null : registerNewRun(qr);
            return convertResult(qr, runId);
        } catch (ConnectionException e) {
            throw mapException(e);
        }
    }

    @Override
    public QueryResultDto queryMore(String runId) {
        QueryRunState state = sessionContext.getQueryRuns().get(runId);
        if (state == null) {
            throw new ApiException("INVALID_QUERY_RUN", "Query run not found", HttpStatus.NOT_FOUND);
        }
        try {
            PartnerConnection conn = queryConnection();
            QueryResult qr = conn.queryMore(state.nextResource());
            if (qr.isDone()) {
                sessionContext.getQueryRuns().remove(runId);
                return convertResult(qr, null);
            }
            sessionContext.getQueryRuns().put(runId, new QueryRunState(qr.getQueryLocator(), false));
            return convertResult(qr, runId);
        } catch (ConnectionException e) {
            throw mapException(e);
        }
    }

    @Override
    public String exportCsv(String soql) {
        try {
            PartnerConnection conn = queryConnection();
            StringBuilder csv = new StringBuilder();
            QueryResult qr = conn.query(soql);
            List<String> columns = extractColumns(qr.getRecords());
            csv.append(String.join(",", columns)).append("\n");
            appendRows(csv, columns, qr.getRecords());
            while (!qr.isDone()) {
                qr = conn.queryMore(qr.getQueryLocator());
                appendRows(csv, columns, qr.getRecords());
            }
            return csv.toString();
        } catch (ConnectionException e) {
            throw mapException(e);
        }
    }

    @Override
    public DescribeGlobalDto describeGlobal() {
        try {
            PartnerConnection conn = connection();
            DescribeGlobalResult dgr = conn.describeGlobal();
            List<DescribeGlobalDto.SObjectSummaryDto> sobjects = new ArrayList<>();
            for (DescribeGlobalSObjectResult s : dgr.getSobjects()) {
                sobjects.add(new DescribeGlobalDto.SObjectSummaryDto(s.getName(), s.getLabel(), s.isCustom()));
            }
            return new DescribeGlobalDto(sobjects);
        } catch (ConnectionException e) {
            throw mapException(e);
        }
    }

    @Override
    public DescribeSObjectDto describeSObject(String sobject) {
        try {
            PartnerConnection conn = connection();
            DescribeSObjectResult dsr = conn.describeSObject(sobject);
            List<FieldDto> fields = new ArrayList<>();
            for (Field f : dsr.getFields()) {
                fields.add(toFieldDto(f));
            }
            List<ChildRelationshipDto> children = new ArrayList<>();
            for (ChildRelationship c : dsr.getChildRelationships()) {
                children.add(new ChildRelationshipDto(
                        c.getChildSObject(), c.getField(), c.getRelationshipName()));
            }
            return new DescribeSObjectDto(
                    dsr.getName(),
                    dsr.getLabel(),
                    dsr.isCustom(),
                    dsr.isSearchable(),
                    dsr.isLayoutable(),
                    dsr.isRetrieveable(),
                    dsr.isCreateable(),
                    dsr.isUpdateable(),
                    dsr.isDeletable(),
                    dsr.isMergeable(),
                    dsr.isQueryable(),
                    dsr.isTriggerable(),
                    dsr.getKeyPrefix(),
                    fields,
                    children);
        } catch (ConnectionException e) {
            throw mapException(e);
        }
    }

    private FieldDto toFieldDto(Field f) {
        return new FieldDto(
                f.getName(),
                f.getLabel(),
                f.getType() == null ? "" : f.getType().toString(),
                f.getReferenceTo() == null ? List.of() : Arrays.asList(f.getReferenceTo()),
                f.getRelationshipName(),
                f.getSoapType() == null ? "" : f.getSoapType().toString(),
                f.getLength(),
                f.getByteLength(),
                f.getDigits(),
                f.getPrecision(),
                f.getScale(),
                f.isNillable(),
                f.isCreateable(),
                f.isUpdateable(),
                f.isDefaultedOnCreate(),
                f.isCalculated(),
                f.isAutoNumber(),
                f.isAiPredictionField(),
                f.isAggregatable(),
                f.isGroupable(),
                f.isFilterable(),
                f.isSortable(),
                f.isCaseSensitive(),
                f.isSearchPrefilterable(),
                f.isIdLookup(),
                f.isNameField(),
                f.isNamePointing(),
                f.isPolymorphicForeignKey(),
                f.isCustom(),
                f.isDeprecatedAndHidden(),
                f.isRestrictedPicklist(),
                f.isPermissionable(),
                f.isUnique());
    }

    private PartnerConnection connection() throws ConnectionException {
        if (sessionContext.getSessionId() == null) {
            throw new ApiException(ApiException.INVALID_SESSION_ID, "Not logged in", HttpStatus.UNAUTHORIZED);
        }
        return connectionFactory.createForSession(
                sessionContext.getSessionId(),
                sessionContext.getInstanceUrl());
    }

    private PartnerConnection queryConnection() throws ConnectionException {
        PartnerConnection conn = connection();
        if (props.queryBatchSize() != null) {
            conn.setQueryOptions(props.queryBatchSize());
        }
        return conn;
    }

    private QueryResultDto convertResult(QueryResult qr, String runId) {
        List<String> columns = extractColumns(qr.getRecords());
        List<Map<String, String>> rows = new ArrayList<>();
        for (SObject record : qr.getRecords()) {
            rows.add(toRow(record, columns));
        }
        return new QueryResultDto(runId, columns, rows, qr.isDone());
    }

    private String registerNewRun(QueryResult qr) {
        String runId = UUID.randomUUID().toString();
        sessionContext.getQueryRuns().put(runId, new QueryRunState(qr.getQueryLocator(), false));
        return runId;
    }

    private List<String> extractColumns(SObject[] records) {
        if (records == null || records.length == 0) {
            return List.of();
        }
        LinkedHashSet<String> cols = new LinkedHashSet<>();
        Iterator<XmlObject> it = records[0].getChildren();
        while (it.hasNext()) {
            XmlObject child = it.next();
            String name = child.getName().getLocalPart();
            if (name != null && !name.isEmpty() && !"type".equals(name)) {
                cols.add(name);
            }
        }
        return new ArrayList<>(cols);
    }

    private Map<String, String> toRow(SObject record, List<String> columns) {
        Map<String, String> row = new LinkedHashMap<>();
        for (String col : columns) {
            Object v = record.getField(col);
            row.put(col, v == null ? "" : v.toString());
        }
        return row;
    }

    private void appendRows(StringBuilder csv, List<String> columns, SObject[] records) {
        for (SObject record : records) {
            Map<String, String> row = toRow(record, columns);
            List<String> values = columns.stream().map(row::get).toList();
            csv.append(String.join(",", values)).append("\n");
        }
    }

    private ApiException mapException(ConnectionException e) {
        if (e instanceof ApiFault fault) {
            String code = fault.getExceptionCode() != null
                    ? fault.getExceptionCode().name()
                    : "API_ERROR";
            HttpStatus status = ApiException.INVALID_SESSION_ID.equals(code)
                    ? HttpStatus.UNAUTHORIZED
                    : HttpStatus.BAD_REQUEST;
            return new ApiException(code, fault.getExceptionMessage(), status);
        }
        return new ApiException("SOAP_ERROR", errorMessage(e), HttpStatus.SERVICE_UNAVAILABLE);
    }

    private String apiFaultMessage(ApiFault e) {
        if (e.getExceptionMessage() != null && !e.getExceptionMessage().isBlank()) {
            return e.getExceptionMessage();
        }
        return e.getClass().getSimpleName();
    }

    private String errorMessage(ConnectionException e) {
        if (e.getMessage() != null && !e.getMessage().isBlank()) {
            return e.getMessage();
        }
        if (e.getCause() != null && e.getCause().getMessage() != null) {
            return e.getCause().getMessage();
        }
        return e.getClass().getSimpleName();
    }
}
