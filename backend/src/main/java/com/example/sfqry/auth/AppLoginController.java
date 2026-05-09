package com.example.sfqry.auth;

import com.example.sfqry.auth.dto.LoginRequestDto;
import com.example.sfqry.auth.dto.LoginResultDto;
import com.example.sfqry.auth.model.UserInfo;
import com.example.sfqry.infra.salesforce.SalesforceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AppLoginController {

    private static final Logger audit = LoggerFactory.getLogger("audit");

    private final SalesforceClient salesforceClient;
    private final SessionContext sessionContext;

    public AppLoginController(SalesforceClient salesforceClient, SessionContext sessionContext) {
        this.salesforceClient = salesforceClient;
        this.sessionContext = sessionContext;
    }

    @PostMapping("/login")
    public ResponseEntity<UserInfo> login(@RequestBody LoginRequestDto req) {
        if (req == null || req.email() == null || req.password() == null) {
            return ResponseEntity.status(401).build();
        }
        LoginResultDto result = salesforceClient.login(req.email(), req.password());
        sessionContext.setSessionId(result.sessionId());
        sessionContext.setInstanceUrl(result.instanceUrl());
        sessionContext.setUserInfo(result.userInfo());
        audit.info("LOGIN user={}", result.userInfo().email());
        return ResponseEntity.ok(result.userInfo());
    }
}
