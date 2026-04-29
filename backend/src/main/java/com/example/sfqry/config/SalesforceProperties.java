package com.example.sfqry.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("sf")
public record SalesforceProperties(
        String username,
        String password,
        String securityToken,
        String loginUrl,
        String apiVersion) {}
