package com.example.sfqry.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.sfqry.testsupport.MockMvcAuth;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"mock", "test"})
@DisplayName("ログインAPI")
class AppLoginControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("正しい認証情報ならユーザ情報を返してセッションを作成する")
    void loginWithValidCredentialsReturnsUserInfoAndCreatesSession() throws Exception {
        Cookie xsrf = MockMvcAuth.csrfCookie(mockMvc);

        MvcResult result = mockMvc.perform(post("/api/login")
                        .cookie(xsrf)
                        .header("X-XSRF-TOKEN", xsrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"test@example.com\",\"password\":\"test\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@example.com"))
                .andExpect(jsonPath("$.name").value("Test User"))
                .andExpect(jsonPath("$.organizationId").value("00D000000000001"))
                .andExpect(jsonPath("$.userId").value("005000000000001"))
                .andReturn();
        assertThat(result.getRequest().getSession(false)).isNotNull();
    }

    @Test
    @DisplayName("必須項目が欠けている場合は401を返す")
    void loginWithMissingFieldsReturns401() throws Exception {
        Cookie xsrf = MockMvcAuth.csrfCookie(mockMvc);

        mockMvc.perform(post("/api/login")
                        .cookie(xsrf)
                        .header("X-XSRF-TOKEN", xsrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"test@example.com\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("認証情報が不正な場合は401を返す")
    void loginWithInvalidCredentialsReturns401() throws Exception {
        Cookie xsrf = MockMvcAuth.csrfCookie(mockMvc);

        mockMvc.perform(post("/api/login")
                        .cookie(xsrf)
                        .header("X-XSRF-TOKEN", xsrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"test@example.com\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_LOGIN"));
    }

}
