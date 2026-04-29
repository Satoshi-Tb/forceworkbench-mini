package com.example.sfqry.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class MeController {

    private final SessionContext sessionContext;

    public MeController(SessionContext sessionContext) {
        this.sessionContext = sessionContext;
    }

    @GetMapping("/me")
    public ResponseEntity<UserInfo> me() {
        UserInfo userInfo = sessionContext.getUserInfo();
        if (userInfo == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(userInfo);
    }
}
