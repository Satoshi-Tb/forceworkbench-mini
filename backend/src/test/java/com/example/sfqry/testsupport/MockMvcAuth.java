package com.example.sfqry.testsupport;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

public final class MockMvcAuth {

    private MockMvcAuth() {}

    public static AuthContext login(MockMvc mockMvc) throws Exception {
        Cookie xsrf = csrfCookie(mockMvc);
        MvcResult result = mockMvc.perform(post("/api/login")
                        .cookie(xsrf)
                        .header("X-XSRF-TOKEN", xsrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"test@example.com\",\"password\":\"test\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return new AuthContext((MockHttpSession) result.getRequest().getSession(false), xsrf);
    }

    public static Cookie csrfCookie(MockMvc mockMvc) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/me")).andReturn();
        return result.getResponse().getCookie("XSRF-TOKEN");
    }

    public record AuthContext(MockHttpSession session, Cookie csrfCookie) {}
}
