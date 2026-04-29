package com.example.sfqry.auth;

import com.example.sfqry.query.QueryRunState;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.SessionScope;

@Component
@SessionScope
public class SessionContext implements Serializable {

    private String sessionId;
    private String instanceUrl;
    private UserInfo userInfo;
    private final Map<String, QueryRunState> queryRuns = new HashMap<>();

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getInstanceUrl() {
        return instanceUrl;
    }

    public void setInstanceUrl(String instanceUrl) {
        this.instanceUrl = instanceUrl;
    }

    public UserInfo getUserInfo() {
        return userInfo;
    }

    public void setUserInfo(UserInfo userInfo) {
        this.userInfo = userInfo;
    }

    public Map<String, QueryRunState> getQueryRuns() {
        return queryRuns;
    }

    public void clear() {
        sessionId = null;
        instanceUrl = null;
        userInfo = null;
        queryRuns.clear();
    }
}
