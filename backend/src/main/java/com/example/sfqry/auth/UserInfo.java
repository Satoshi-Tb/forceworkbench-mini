package com.example.sfqry.auth;

import java.io.Serializable;

public record UserInfo(String email, String name) implements Serializable {}
