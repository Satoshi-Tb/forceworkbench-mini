package com.example.sfqry.auth;

import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AppLogoutController {

    private final SessionContext sessionContext;

    public AppLogoutController(SessionContext sessionContext) {
        this.sessionContext = sessionContext;
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpSession session) {
        sessionContext.clear();
        session.invalidate();
        return ResponseEntity.noContent().build();
    }
}
