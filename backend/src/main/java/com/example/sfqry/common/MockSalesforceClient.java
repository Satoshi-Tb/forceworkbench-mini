package com.example.sfqry.common;

import com.example.sfqry.auth.SessionContext;
import com.example.sfqry.auth.UserInfo;
import com.example.sfqry.describe.dto.DescribeGlobalDto;
import com.example.sfqry.describe.dto.DescribeSObjectDto;
import com.example.sfqry.query.QueryResultDto;
import com.example.sfqry.query.QueryRunState;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Profile("mock")
@Service
public class MockSalesforceClient implements SalesforceClient {

    private final ObjectMapper objectMapper;
    private final SessionContext sessionContext;
    private final byte[] expectedEmail;
    private final byte[] expectedPassword;

    public MockSalesforceClient(
            ObjectMapper objectMapper,
            SessionContext sessionContext,
            @Value("${app.login.email}") String email,
            @Value("${app.login.password}") String password) {
        this.objectMapper = objectMapper;
        this.sessionContext = sessionContext;
        this.expectedEmail = email.getBytes(StandardCharsets.UTF_8);
        this.expectedPassword = password.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public LoginResult login(String email, String password) {
        byte[] emailBytes = email.getBytes(StandardCharsets.UTF_8);
        byte[] passwordBytes = password.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(emailBytes, expectedEmail)
                || !MessageDigest.isEqual(passwordBytes, expectedPassword)) {
            throw new ApiException("INVALID_LOGIN", "Invalid credentials", HttpStatus.UNAUTHORIZED);
        }
        UserInfo userInfo = new UserInfo(
                email,
                "Test User",
                "00D000000000001",
                "005000000000001");
        return new LoginResult(
                "MOCK_SESSION_" + UUID.randomUUID(),
                "https://mock.example.salesforce.com",
                userInfo);
    }

    @Override
    public QueryResultDto query(String soql) {
        String normalized = soql == null ? "" : soql.toLowerCase(Locale.ROOT);
        if (normalized.contains(" from contact")) {
            return result(null, "mock/query/contact-basic.csv", true);
        }
        if (normalized.contains(" from account")) {
            String runId = UUID.randomUUID().toString();
            sessionContext.getQueryRuns().put(
                    runId,
                    new QueryRunState("mock/query/account-page-2.csv", false));
            return result(runId, "mock/query/account-page-1.csv", false);
        }
        throw new ApiException(ApiException.MALFORMED_QUERY, "Unsupported mock SOQL", HttpStatus.BAD_REQUEST);
    }

    @Override
    public QueryResultDto queryMore(String runId) {
        QueryRunState state = sessionContext.getQueryRuns().remove(runId);
        if (state == null) {
            throw new ApiException("INVALID_QUERY_RUN", "Query run not found", HttpStatus.NOT_FOUND);
        }
        return result(runId, state.nextResource(), true);
    }

    @Override
    public String exportCsv(String soql) {
        QueryResultDto result = query(soql);
        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", result.columns())).append("\n");
        appendRows(csv, result.columns(), result.rows());
        if (!result.done() && result.queryRunId() != null) {
            QueryResultDto next = queryMore(result.queryRunId());
            appendRows(csv, next.columns(), next.rows());
        }
        return csv.toString();
    }

    @Override
    public DescribeGlobalDto describeGlobal() {
        return readJson("mock/describe-global.json", DescribeGlobalDto.class);
    }

    @Override
    public DescribeSObjectDto describeSObject(String sobject) {
        return readJson("mock/describe/" + sobject + ".json", DescribeSObjectDto.class);
    }

    private QueryResultDto result(String runId, String path, boolean done) {
        CsvData csv = readCsv(path);
        return new QueryResultDto(runId, csv.columns(), csv.rows(), done);
    }

    private <T> T readJson(String path, Class<T> type) {
        try {
            return objectMapper.readValue(new ClassPathResource(path).getInputStream(), type);
        } catch (IOException e) {
            throw new ApiException("MOCK_DATA_NOT_FOUND", path, HttpStatus.NOT_FOUND);
        }
    }

    private CsvData readCsv(String path) {
        try {
            String text = new String(
                    new ClassPathResource(path).getInputStream().readAllBytes(),
                    StandardCharsets.UTF_8);
            String[] lines = text.strip().split("\\R");
            List<String> columns = List.of(lines[0].split(","));
            List<Map<String, String>> rows = new ArrayList<>();
            for (int i = 1; i < lines.length; i++) {
                String[] values = lines[i].split(",", -1);
                Map<String, String> row = new LinkedHashMap<>();
                for (int j = 0; j < columns.size(); j++) {
                    row.put(columns.get(j), j < values.length ? values[j] : "");
                }
                rows.add(row);
            }
            return new CsvData(columns, rows);
        } catch (IOException e) {
            throw new ApiException("MOCK_DATA_NOT_FOUND", path, HttpStatus.NOT_FOUND);
        }
    }

    private void appendRows(
            StringBuilder csv,
            List<String> columns,
            List<Map<String, String>> rows) {
        for (Map<String, String> row : rows) {
            List<String> values = columns.stream().map(row::get).toList();
            csv.append(String.join(",", values)).append("\n");
        }
    }

    private record CsvData(List<String> columns, List<Map<String, String>> rows) {}
}
