package com.example.sfqry.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.sfqry.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class SoqlQueryGuardTest {

    @Test
    void acceptsSelectQueryWithEscapedQuoteAndSemicolonInString() {
        assertThatCode(() -> SoqlQueryGuard.validateSelectQuery(
                        "SELECT Id FROM Account WHERE Name = 'O\\'Brien; Inc.'"))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsBlankQuery() {
        assertMalformed(" ");
    }

    @Test
    void rejectsNonSelectQuery() {
        assertMalformed("FIND {Acme}");
    }

    @Test
    void rejectsMultipleStatements() {
        assertMalformed("SELECT Id FROM Account; SELECT Id FROM Contact");
    }

    @Test
    void rejectsLineCommentOutsideString() {
        assertMalformed("SELECT Id FROM Account -- comment");
    }

    @Test
    void rejectsBlockCommentOutsideString() {
        assertMalformed("SELECT Id FROM Account /* comment */");
    }

    @Test
    void rejectsUnclosedStringLiteral() {
        assertMalformed("SELECT Id FROM Account WHERE Name = 'Acme");
    }

    private static void assertMalformed(String soql) {
        assertThatThrownBy(() -> SoqlQueryGuard.validateSelectQuery(soql))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getCode()).isEqualTo(ApiException.MALFORMED_QUERY);
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                });
    }
}
