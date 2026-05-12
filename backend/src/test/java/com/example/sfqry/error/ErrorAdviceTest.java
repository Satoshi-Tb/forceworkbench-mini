package com.example.sfqry.error;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(ErrorAdviceTest.TestController.class)
// ErrorAdvice の例外変換だけを確認するため、認証・CSRF フィルタは通さない。
@AutoConfigureMockMvc(addFilters = false)
// 実 Controller に依存せず、必ず ApiException を投げるテスト用 Controller だけを登録する。
@Import({ErrorAdvice.class, ErrorAdviceTest.TestController.class})
@DisplayName("エラーレスポンス変換")
class ErrorAdviceTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("ApiExceptionをHTTPステータスとJSONに変換する")
    void mapsApiExceptionToJsonResponse() throws Exception {
        mockMvc.perform(get("/test/api-exception"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TEST_ERROR"))
                .andExpect(jsonPath("$.message").value("test message"));
    }

    // ErrorAdvice に ApiException を渡すためのテスト専用 Controller。
    // 実 API のルーティングや Service には依存させない。
    @RestController
    static class TestController {
        @GetMapping("/test/api-exception")
        void apiException() {
            throw new ApiException("TEST_ERROR", "test message", HttpStatus.BAD_REQUEST);
        }
    }
}
