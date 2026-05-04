package com.example.sfqry.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.sforce.soap.partner.sobject.SObject;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("SOAP Salesforceクライアント")
class SoapSalesforceClientTest {

    @Test
    @DisplayName("全レコードのIdに値がある場合はId列を保持する")
    void keepsIdColumnWhenAllIdsArePresent() throws Exception {
        List<String> columns = extractColumns(
                account("001000000000001AAA", "Edge Communications"),
                account("001000000000002AAA", "Burlington Textiles Corp of America"));

        assertThat(columns).containsExactly("Id", "Name");
    }

    @Test
    @DisplayName("1レコードでもIdがnullの場合はId列を除外する")
    void excludesIdColumnWhenAnyIdIsNull() throws Exception {
        List<String> columns = extractColumns(
                account(null, "Edge Communications"),
                account("001000000000002AAA", "Burlington Textiles Corp of America"));

        assertThat(columns).containsExactly("Name");
    }

    private static SObject account(String id, String name) {
        SObject record = new SObject();
        record.addField("Id", id);
        record.addField("Name", name);
        return record;
    }

    @SuppressWarnings("unchecked")
    private static List<String> extractColumns(SObject... records) throws Exception {
        SoapSalesforceClient client = new SoapSalesforceClient(null, null, null);
        Method method = SoapSalesforceClient.class.getDeclaredMethod("extractColumns", SObject[].class);
        method.setAccessible(true);
        return (List<String>) method.invoke(client, (Object) records);
    }
}
