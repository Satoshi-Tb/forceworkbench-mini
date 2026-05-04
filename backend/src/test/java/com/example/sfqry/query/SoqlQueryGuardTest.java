package com.example.sfqry.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.sfqry.common.ApiException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

@DisplayName("SOQL実行ガード")
class SoqlQueryGuardTest {

    @Test
    @DisplayName("文字列内のエスケープ済み引用符とセミコロンを許可する")
    void acceptsSelectQueryWithEscapedQuoteAndSemicolonInString() {
        assertThatCode(() -> SoqlQueryGuard.validateSelectQuery(
                        "SELECT Id FROM Account WHERE Name = 'O\\'Brien; Inc.'"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("空文字のSOQLを拒否する")
    void rejectsBlankQuery() {
        assertMalformed(" ");
    }

    @Test
    @DisplayName("SELECT以外のSOQLを拒否する")
    void rejectsNonSelectQuery() {
        assertMalformed("FIND {Acme}");
    }

    @Test
    @DisplayName("複数ステートメントを拒否する")
    void rejectsMultipleStatements() {
        assertMalformed("SELECT Id FROM Account; SELECT Id FROM Contact");
    }

    @Test
    @DisplayName("文字列外の行コメントを拒否する")
    void rejectsLineCommentOutsideString() {
        assertMalformed("SELECT Id FROM Account -- comment");
    }

    @Test
    @DisplayName("文字列外のブロックコメントを拒否する")
    void rejectsBlockCommentOutsideString() {
        assertMalformed("SELECT Id FROM Account /* comment */");
    }

    @Test
    @DisplayName("未閉じの文字列リテラルを拒否する")
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
