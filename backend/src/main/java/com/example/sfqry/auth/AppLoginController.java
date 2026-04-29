package com.example.sfqry.auth;

import com.example.sfqry.common.LoginResult;
import com.example.sfqry.common.SalesforceClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AppLoginController {

    private final SalesforceClient salesforceClient;
    private final SessionContext sessionContext;

    public AppLoginController(SalesforceClient salesforceClient, SessionContext sessionContext) {
        this.salesforceClient = salesforceClient;
        this.sessionContext = sessionContext;
    }

    @PostMapping("/login")
    public ResponseEntity<UserInfo> login(@RequestBody LoginRequest req) {
        if (req == null || req.email() == null || req.password() == null) {
            return ResponseEntity.status(401).build();
        }
        LoginResult result = salesforceClient.login(req.email(), req.password());
        sessionContext.setSessionId(result.sessionId());
        sessionContext.setInstanceUrl(result.instanceUrl());
        sessionContext.setUserInfo(result.userInfo());
        return ResponseEntity.ok(result.userInfo());
    }
}
