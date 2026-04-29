package com.example.sfqry.config;

import com.sforce.soap.partner.PartnerConnection;
import com.sforce.ws.ConnectionException;
import com.sforce.ws.ConnectorConfig;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Profile("!mock")
@Component
public class PartnerConnectionFactory {

    private final SalesforceProperties props;

    public PartnerConnectionFactory(SalesforceProperties props) {
        this.props = props;
    }

    public PartnerConnection createForLogin(String username, String password) throws ConnectionException {
        ConnectorConfig config = new ConnectorConfig();
        config.setUsername(username);
        config.setPassword(password);
        config.setAuthEndpoint(authEndpoint());
        return new PartnerConnection(config);
    }

    public PartnerConnection createForSession(String sessionId, String instanceUrl) throws ConnectionException {
        ConnectorConfig config = new ConnectorConfig();
        config.setSessionId(sessionId);
        config.setServiceEndpoint(instanceUrl + "/services/Soap/u/" + props.apiVersion());
        return new PartnerConnection(config);
    }

    private String authEndpoint() {
        String loginUrl = props.loginUrl();
        if (loginUrl == null || loginUrl.isBlank()) {
            throw new IllegalStateException("sf.login-url is not configured");
        }
        return loginUrl.replaceAll("/$", "") + "/services/Soap/u/" + props.apiVersion();
    }

    public String loginEndpoint() {
        return authEndpoint();
    }
}
