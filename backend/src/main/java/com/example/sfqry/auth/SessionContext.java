package com.example.sfqry.auth;

import com.example.sfqry.auth.model.UserInfo;
import java.io.Serializable;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.SessionScope;

// 本クラスは UserInfo と Salesforce セッション値をセッションライフサイクルに紐づけて保持するための、
// セッションスコープのステートフル Bean。
@Component
@SessionScope
public class SessionContext implements Serializable {

    private String sessionId;
    private String instanceUrl;
    private UserInfo userInfo;

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

    public void clear() {
        sessionId = null;
        instanceUrl = null;
        userInfo = null;
    }
}
