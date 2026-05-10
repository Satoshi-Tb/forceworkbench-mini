package com.example.sfqry.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.sfqry.testsupport.MockMvcAuth;
import com.example.sfqry.testsupport.MockMvcAuth.AuthContext;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"mock", "test"})
@DisplayName("クエリAPI")
class QueryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("SOQL実行結果をJSONで返す")
    void postQueryReturnsResultJson() throws Exception {
        AuthContext auth = MockMvcAuth.login(mockMvc);

        mockMvc.perform(post("/api/query")
                        .session(auth.session())
                        .cookie(auth.csrfCookie())
                        .header("X-XSRF-TOKEN", auth.csrfCookie().getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"soql\":\"SELECT Id FROM Account\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.columns[0]").value("Id"))
                .andExpect(jsonPath("$.rows[0].Name").value("Acme Corporation"))
                .andExpect(jsonPath("$.limitExceeded").value(true));
    }

    @Test
    @DisplayName("CSVは未指定ならUTF-8で返す")
    void postCsvReturnsCsvWithUtf8ByDefault() throws Exception {
        AuthContext auth = MockMvcAuth.login(mockMvc);

        MvcResult result = mockMvc.perform(post("/api/query/csv")
                        .session(auth.session())
                        .cookie(auth.csrfCookie())
                        .header("X-XSRF-TOKEN", auth.csrfCookie().getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"soql\":\"SELECT Id FROM Contact\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "text/csv;charset=UTF-8"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"query.csv\""))
                .andReturn();

        String csv = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).startsWith("Id,FirstName,LastName,Email,AccountId\r\n");
    }

    @Test
    @DisplayName("CSVはshift_jis指定時にWindows-31Jでエンコードする")
    void postCsvWithShiftJisEncodesBodyInWindows31j() throws Exception {
        AuthContext auth = MockMvcAuth.login(mockMvc);

        MvcResult result = mockMvc.perform(post("/api/query/csv?encoding=shift_jis")
                        .session(auth.session())
                        .cookie(auth.csrfCookie())
                        .header("X-XSRF-TOKEN", auth.csrfCookie().getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"soql\":\"SELECT Id FROM Account\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "text/csv;charset=windows-31j"))
                .andReturn();

        String csv = new String(result.getResponse().getContentAsByteArray(), Charset.forName("Windows-31J"));
        assertThat(csv).contains("東京サンプル株式会社");
    }

    @Test
    @DisplayName("未対応CSVエンコーディングは400を返す")
    void postCsvWithUnsupportedEncodingReturns400() throws Exception {
        AuthContext auth = MockMvcAuth.login(mockMvc);

        mockMvc.perform(post("/api/query/csv?encoding=euc-jp")
                        .session(auth.session())
                        .cookie(auth.csrfCookie())
                        .header("X-XSRF-TOKEN", auth.csrfCookie().getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"soql\":\"SELECT Id FROM Account\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CSV_ENCODING"));
    }

    @Test
    @DisplayName("不正なSOQLは400のJSONを返す")
    void postQueryWithMalformedSoqlReturns400() throws Exception {
        AuthContext auth = MockMvcAuth.login(mockMvc);

        mockMvc.perform(post("/api/query")
                        .session(auth.session())
                        .cookie(auth.csrfCookie())
                        .header("X-XSRF-TOKEN", auth.csrfCookie().getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"soql\":\"DELETE FROM Account\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_QUERY"));
    }

}
