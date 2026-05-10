package com.example.sfqry.describe;

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
@DisplayName("Describe API")
class DescribeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("グローバルDescribeを200で返す")
    void getDescribeGlobalReturns200() throws Exception {
        AuthContext auth = MockMvcAuth.login(mockMvc);

        mockMvc.perform(get("/api/describe/global").session(auth.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sobjects[0].name").exists());
    }

    @Test
    @DisplayName("既知のSObject Describeを200で返す")
    void getDescribeSObjectReturns200ForKnownObject() throws Exception {
        AuthContext auth = MockMvcAuth.login(mockMvc);

        mockMvc.perform(get("/api/describe/Account").session(auth.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Account"))
                .andExpect(jsonPath("$.fields[0].name").exists());
    }

    @Test
    @DisplayName("未知のSObject Describeは404を返す")
    void getDescribeSObjectReturns404ForUnknownObject() throws Exception {
        AuthContext auth = MockMvcAuth.login(mockMvc);

        mockMvc.perform(get("/api/describe/Unknown__c").session(auth.session()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MOCK_DATA_NOT_FOUND"));
    }

}
