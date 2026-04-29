package com.example.sfqry.common;

import com.example.sfqry.auth.UserInfo;

public record LoginResult(String sessionId, String instanceUrl, UserInfo userInfo) {}
