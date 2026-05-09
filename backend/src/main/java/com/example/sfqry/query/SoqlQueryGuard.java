package com.example.sfqry.query;

import com.example.sfqry.error.ApiException;
import org.springframework.http.HttpStatus;

final class SoqlQueryGuard {

    private SoqlQueryGuard() {}

    /*
     * このアプリは、ユーザーが任意の SOQL を直接実行できるツールである。
     * そのためバックエンドでは、SOQL のどの部分が「値」なのかを正確に特定できない。
     * クエリ文字列全体にクォートエスケープを適用すると、正当な SOQL 構文まで壊してしまう。
     *
     * 代わりに、Salesforce へ渡す前に allowlist 型の最小検査を行う。
     * - SELECT クエリのみ許可する
     * - 文字列リテラル外のステートメント区切りを拒否する
     * - 文字列リテラル外のコメント記号を拒否する
     * - 閉じていない文字列リテラルを拒否する
     *
     * 判定は 1 文字ずつ走査し、現在位置が文字列リテラルの内側か外側かを管理して行う。
     * 文字列リテラル内の ; や -- は値として扱うため許可する。
     *
     * 許可する例:
     *   SELECT Id FROM Account WHERE Name = 'Acme; Inc.'
     *   SELECT Id FROM Account WHERE Name = 'foo -- bar'
     *   SELECT Id FROM Account WHERE Name = 'O\'Brien'
     *
     * 拒否する例:
     *   FIND {Acme}
     *   SELECT Id FROM Account; SELECT Id FROM Contact
     *   SELECT Id FROM Account -- comment
     *   SELECT Id FROM Account / * comment * /
     *   SELECT Id FROM Account WHERE Name = 'Acme
     *
     * ビルダーが生成する条件値のエスケープはフロントエンド側で行う。
     */
    static void validateSelectQuery(String soql) {
        if (soql == null || soql.isBlank()) {
            throw malformedQuery("SOQL is required");
        }

        String trimmed = soql.stripLeading();
        if (!trimmed.regionMatches(true, 0, "SELECT", 0, "SELECT".length())) {
            throw malformedQuery("Only SELECT SOQL is allowed");
        }

        validateQueryText(trimmed);
    }

    private static void validateQueryText(String soql) {
        boolean inStringLiteral = false;
        boolean escaped = false;
        for (int i = 0; i < soql.length(); i++) {
            char ch = soql.charAt(i);

            // 文字列リテラル内では、区切り記号やコメント記号も単なる値として扱う。
            if (inStringLiteral) {
                if (escaped) {
                    escaped = false;
                } else if (ch == '\\') {
                    escaped = true;
                } else if (ch == '\'') {
                    // 文字列リテラルの終了
                    inStringLiteral = false;
                }
                continue;
            }

            // 文字列リテラル外では、文の追加やコメントによる後続 SOQL の隠蔽を拒否する。
            if (ch == '\'') {
                // 文字列リテラルの開始
                inStringLiteral = true;
            } else if (ch == ';') {
                throw malformedQuery("Multiple SOQL statements are not allowed");
            } else if (ch == '-' && nextIs(soql, i, '-')) {
                throw malformedQuery("SOQL comments are not allowed");
            } else if (ch == '/' && nextIs(soql, i, '*')) {
                throw malformedQuery("SOQL comments are not allowed");
            }
        }

        if (inStringLiteral) {
            throw malformedQuery("String literal is not closed");
        }
    }

    private static boolean nextIs(String value, int index, char expected) {
        return index + 1 < value.length() && value.charAt(index + 1) == expected;
    }

    private static ApiException malformedQuery(String message) {
        return new ApiException(ApiException.MALFORMED_QUERY, message, HttpStatus.BAD_REQUEST);
    }
}
