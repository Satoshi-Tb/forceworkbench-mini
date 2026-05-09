package com.example.sfqry.auth.model;

import java.io.Serializable;

public record UserInfo(String email, String name, String organizationId, String userId)
        implements Serializable {}
