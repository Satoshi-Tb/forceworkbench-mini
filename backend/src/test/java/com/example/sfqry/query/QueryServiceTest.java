package com.example.sfqry.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.example.sfqry.auth.SessionContext;
import com.example.sfqry.auth.model.UserInfo;
import com.example.sfqry.error.ApiException;
import com.example.sfqry.infra.salesforce.MockSalesforceClient;
import com.example.sfqry.query.dto.QueryResultDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

@DisplayName("SOQLクエリサービス")
class QueryServiceTest {

    private final SessionContext sessionContext = new SessionContext();
    private final QueryService queryService = new QueryService(
            new MockSalesforceClient(new ObjectMapper(), "test@example.com", "test"),
            sessionContext);
    private final Logger auditLogger = (Logger) LoggerFactory.getLogger("audit");
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void setUp() {
        appender = new ListAppender<>();
        appender.start();
        auditLogger.addAppender(appender);
    }

    @AfterEach
    void tearDown() {
        auditLogger.detachAppender(appender);
        sessionContext.clear();
    }

    @Test
    @DisplayName("既知のSObjectなら行を返す")
    void queryReturnsRowsForKnownSObject() {
        QueryResultDto result = queryService.query("SELECT Id FROM Contact");

        assertThat(result.columns()).contains("Id", "FirstName", "LastName", "Email", "AccountId");
        assertThat(result.rows()).isNotEmpty();
        assertThat(result.limitExceeded()).isFalse();
    }

    @Test
    @DisplayName("SELECT以外は拒否する")
    void queryRejectsNonSelect() {
        assertMalformed(() -> queryService.query("DELETE FROM Account"));
    }

    @Test
    @DisplayName("複数ステートメントは拒否する")
    void queryRejectsMultipleStatements() {
        assertMalformed(() -> queryService.query("SELECT Id FROM Account; SELECT Id FROM Contact"));
    }

    @Test
    @DisplayName("CSVはヘッダとCRLF区切りの行を返す")
    void exportCsvReturnsHeaderAndCrlfRows() {
        String csv = queryService.exportCsv("SELECT Id FROM Contact");

        assertThat(csv).startsWith("Id,FirstName,LastName,Email,AccountId\r\n");
        assertThat(csv).contains("\r\n");
    }

    @Test
    @DisplayName("認証済みなら監査ログにメールアドレスを出力する")
    void auditLogsContainsCallerEmailWhenAuthenticated() {
        sessionContext.setUserInfo(new UserInfo(
                "test@example.com",
                "Test User",
                "00D000000000001",
                "005000000000001"));

        queryService.query("SELECT Id FROM Contact");

        assertThat(appender.list)
                .extracting(ILoggingEvent::getFormattedMessage)
                .anySatisfy(message -> assertThat(message).contains("user=test@example.com"));
    }

    @Test
    @DisplayName("未認証なら監査ログにanonymousを出力する")
    void auditLogsContainsAnonymousWhenNotAuthenticated() {
        queryService.query("SELECT Id FROM Contact");

        assertThat(appender.list)
                .extracting(ILoggingEvent::getFormattedMessage)
                .anySatisfy(message -> assertThat(message).contains("user=anonymous"));
    }

    private static void assertMalformed(ThrowingCallable callable) {
        assertThatThrownBy(callable::call)
                .isInstanceOfSatisfying(ApiException.class, e ->
                        assertThat(e.getCode()).isEqualTo(ApiException.MALFORMED_QUERY));
    }

    @FunctionalInterface
    private interface ThrowingCallable {
        void call();
    }
}
