package com.example.sfqry.query;

import com.example.sfqry.error.ApiException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;

public enum CsvEncoding {
    UTF_8("utf-8", StandardCharsets.UTF_8),
    SHIFT_JIS("shift_jis", Charset.forName("Windows-31J"));

    private final String requestValue;
    private final Charset charset;

    CsvEncoding(String requestValue, Charset charset) {
        this.requestValue = requestValue;
        this.charset = charset;
    }

    public Charset charset() {
        return charset;
    }

    public static CsvEncoding fromRequestValue(String value) {
        if (value == null || value.isBlank()) {
            return UTF_8;
        }
        for (CsvEncoding encoding : values()) {
            if (encoding.requestValue.equalsIgnoreCase(value)) {
                return encoding;
            }
        }
        throw new ApiException("INVALID_CSV_ENCODING", "Unsupported CSV encoding", HttpStatus.BAD_REQUEST);
    }
}
