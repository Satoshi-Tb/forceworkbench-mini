package com.example.sfqry.auth.dto;

import com.example.sfqry.auth.model.UserInfo;

public record LoginResultDto(String sessionId, String instanceUrl, UserInfo userInfo) {}
