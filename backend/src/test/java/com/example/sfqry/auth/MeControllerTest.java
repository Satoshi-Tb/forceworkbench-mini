package com.example.sfqry.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.sfqry.testsupport.MockMvcAuth;
import com.example.sfqry.testsupport.MockMvcAuth.AuthContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"mock", "test"})
@DisplayName("ユーザ情報API")
class MeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("認証済みなら現在のユーザ情報を返す")
    void meReturnsCurrentUserWhenAuthenticated() throws Exception {
        AuthContext auth = MockMvcAuth.login(mockMvc);

        mockMvc.perform(get("/api/me").session(auth.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    @DisplayName("セッションがない場合は401を返す")
    void meReturnsUnauthorizedWhenNoSession() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized());
    }

}
