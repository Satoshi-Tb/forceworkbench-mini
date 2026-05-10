package com.example.sfqry.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.sfqry.error.ApiException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;

@DisplayName("CSVエンコーディング")
class CsvEncodingTest {

    @Test
    @DisplayName("未指定または空白ならUTF-8を返す")
    void defaultsToUtf8WhenNullOrBlank() {
        assertThat(CsvEncoding.fromRequestValue(null)).isEqualTo(CsvEncoding.UTF_8);
        assertThat(CsvEncoding.fromRequestValue("")).isEqualTo(CsvEncoding.UTF_8);
        assertThat(CsvEncoding.fromRequestValue("  ")).isEqualTo(CsvEncoding.UTF_8);
    }

    @ParameterizedTest
    @CsvSource({
        "utf-8, UTF_8",
        "UTF-8, UTF_8",
        "shift_jis, SHIFT_JIS",
        "SHIFT_JIS, SHIFT_JIS"
    })
    @DisplayName("大文字小文字を無視して対応エンコーディングを解決する")
    void acceptsCanonicalUtf8AndShiftJisIgnoringCase(String value, CsvEncoding expected) {
        assertThat(CsvEncoding.fromRequestValue(value)).isEqualTo(expected);
        if (expected == CsvEncoding.UTF_8) {
            assertThat(expected.charset()).isEqualTo(StandardCharsets.UTF_8);
        } else {
            assertThat(expected.charset()).isEqualTo(Charset.forName("Windows-31J"));
        }
    }

    @Test
    @DisplayName("未対応のエンコーディングは400で拒否する")
    void rejectsUnsupportedEncodingWith400() {
        assertThatThrownBy(() -> CsvEncoding.fromRequestValue("euc-jp"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("INVALID_CSV_ENCODING");
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                });
    }
}
