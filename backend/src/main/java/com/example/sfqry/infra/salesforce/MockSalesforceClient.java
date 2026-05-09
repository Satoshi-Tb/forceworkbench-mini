package com.example.sfqry.infra.salesforce;

import com.example.sfqry.auth.dto.LoginResultDto;
import com.example.sfqry.auth.model.UserInfo;
import com.example.sfqry.describe.dto.DescribeGlobalDto;
import com.example.sfqry.describe.dto.DescribeSObjectDto;
import com.example.sfqry.error.ApiException;
import com.example.sfqry.query.dto.QueryResultDto;
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

    private static final String CSV_LINE_SEPARATOR = "\r\n";

    private final ObjectMapper objectMapper;
    private final byte[] expectedEmail;
    private final byte[] expectedPassword;

    public MockSalesforceClient(
            ObjectMapper objectMapper,
            @Value("${app.login.email}") String email,
            @Value("${app.login.password}") String password) {
        this.objectMapper = objectMapper;
        this.expectedEmail = email.getBytes(StandardCharsets.UTF_8);
        this.expectedPassword = password.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public LoginResultDto login(String email, String password) {
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
        return new LoginResultDto(
                "MOCK_SESSION_" + UUID.randomUUID(),
                "https://mock.example.salesforce.com",
                userInfo);
    }

    @Override
    public QueryResultDto query(String soql) {
        String normalized = soql == null ? "" : soql.toLowerCase(Locale.ROOT);
        if (isCountOnlyQuery(normalized)) {
            return countResult(normalized);
        }
        return result(csvPath(normalized), normalized.contains("from account"));
    }

    @Override
    public String exportCsv(String soql) {
        String normalized = soql == null ? "" : soql.toLowerCase(Locale.ROOT);
        if (isCountOnlyQuery(normalized)) {
            QueryResultDto result = countResult(normalized);
            StringBuilder csv = new StringBuilder();
            csv.append(String.join(",", result.columns())).append(CSV_LINE_SEPARATOR);
            appendRows(csv, result.columns(), result.rows());
            return csv.toString();
        }
        QueryResultDto result = result(csvPath(normalized), false);
        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", result.columns())).append(CSV_LINE_SEPARATOR);
        appendRows(csv, result.columns(), result.rows());
        if (normalized.contains("from account")) {
            QueryResultDto next = result("mock/query/account-page-2.csv", false);
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

    private QueryResultDto result(String path, boolean limitExceeded) {
        CsvData csv = readCsv(path);
        return new QueryResultDto(csv.columns(), csv.rows(), limitExceeded);
    }

    private QueryResultDto countResult(String normalizedSoql) {
        return new QueryResultDto(
                List.of("COUNT()"),
                List.of(Map.of("COUNT()", String.valueOf(countRows(normalizedSoql)))),
                false);
    }

    private int countRows(String normalizedSoql) {
        if (normalizedSoql.contains("from account")) {
            return readCsv("mock/query/account-page-1.csv").rows().size()
                    + readCsv("mock/query/account-page-2.csv").rows().size();
        }
        return readCsv(csvPath(normalizedSoql)).rows().size();
    }

    private boolean isCountOnlyQuery(String normalizedSoql) {
        return normalizedSoql.matches("^\\s*select\\s+count\\s*\\(\\s*\\)\\s+from\\b[\\s\\S]*$");
    }

    private String csvPath(String normalizedSoql) {
        if (normalizedSoql.contains("from contact")) {
            return "mock/query/contact-basic.csv";
        }
        if (normalizedSoql.contains("from invoice__c")) {
            return "mock/query/invoice-basic.csv";
        }
        if (normalizedSoql.contains("from opportunity")) {
            return "mock/query/opportunity-basic.csv";
        }
        if (normalizedSoql.contains("from account")) {
            return "mock/query/account-page-1.csv";
        }
        throw new ApiException(ApiException.MALFORMED_QUERY, "Unsupported mock SOQL", HttpStatus.BAD_REQUEST);
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
            csv.append(String.join(",", values)).append(CSV_LINE_SEPARATOR);
        }
    }

    private record CsvData(List<String> columns, List<Map<String, String>> rows) {}
}
