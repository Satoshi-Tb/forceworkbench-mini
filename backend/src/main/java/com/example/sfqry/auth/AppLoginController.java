package com.example.sfqry.auth;

import jakarta.servlet.http.HttpSession;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AppLoginController {

    private final byte[] expectedEmail;
    private final byte[] expectedPassword;

    public AppLoginController(
            @Value("${app.login.email}") String email,
            @Value("${app.login.password}") String password) {
        this.expectedEmail = email.getBytes(StandardCharsets.UTF_8);
        this.expectedPassword = password.getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping("/login")
    public ResponseEntity<UserInfo> login(@RequestBody LoginRequest req, HttpSession session) {
        if (req == null || req.email() == null || req.password() == null) {
            return ResponseEntity.status(401).build();
        }
        byte[] email = req.email().getBytes(StandardCharsets.UTF_8);
        byte[] password = req.password().getBytes(StandardCharsets.UTF_8);
        boolean emailOk = MessageDigest.isEqual(email, expectedEmail);
        boolean passwordOk = MessageDigest.isEqual(password, expectedPassword);
        if (!emailOk || !passwordOk) {
            return ResponseEntity.status(401).build();
        }
        UserInfo userInfo = new UserInfo(req.email(), "Test User");
        session.setAttribute("userInfo", userInfo);
        return ResponseEntity.ok(userInfo);
    }
}
