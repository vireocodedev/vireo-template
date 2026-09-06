package com.vireocode.startertemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "springdoc.api-docs.enabled=true",
        "springdoc.swagger-ui.enabled=false",
        "vireo.starter.auth.docs-matchers="
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiCompatibilityIntegrationTest {

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;

    @Autowired
    OpenApiCompatibilityIntegrationTest(MockMvc mockMvc, ObjectMapper objectMapper) {
        this.mockMvc = mockMvc;
        this.objectMapper = objectMapper;
    }

    @Test
    @DisplayName("Generated OpenAPI retains reviewed paths, statuses, schemas, and security semantics")
    void generatedContractMatchesReviewedBaseline() throws Exception {
        String body = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode actual = objectMapper.readTree(body);
        assertThat(actual.isObject()).as("OpenAPI response is a JSON object").isTrue();
        JsonNode expected = readContract();

        assertOperationsRetainBaseline(
                normalizeOperations(actual),
                readStringMap(expected.path("operations")));
        assertSchemaNamesRetainBaseline(
                sortedFieldNames(actual.path("components").path("schemas")),
                readStrings(expected.path("schemaNames")));
        assertSchemaContracts(actual.path("components").path("schemas"), expected.path("schemas"));
        assertThat(normalizeSecuritySchemes(actual.path("components").path("securitySchemes")))
                .isEqualTo(readStringMap(expected.path("securitySchemes")));
    }

    @Test
    @DisplayName("Reviewed OpenAPI baseline permits additive generated capabilities")
    void reviewedBaselinePermitsAdditiveGeneratedCapabilities() {
        Map<String, Object> reviewedOperations = Map.of(
                "GET /api/items", Map.of("responses", List.of("200")));
        Map<String, Object> generatedOperations = new TreeMap<>(reviewedOperations);
        generatedOperations.put(
                "POST /api/purchase-orders",
                Map.of("responses", List.of("200", "400")));

        assertOperationsRetainBaseline(generatedOperations, reviewedOperations);
        assertSchemaNamesRetainBaseline(
                List.of("ItemResponse", "PurchaseOrderDTO"),
                List.of("ItemResponse"));
    }

    @Test
    @DisplayName("Reviewed OpenAPI baseline still rejects removed operations and schemas")
    void reviewedBaselineRejectsBreakingRemovals() {
        Map<String, Object> reviewedOperations = Map.of(
                "GET /api/items", Map.of("responses", List.of("200")));

        assertThatThrownBy(() -> assertOperationsRetainBaseline(Map.of(), reviewedOperations))
                .isInstanceOf(AssertionError.class);
        assertThatThrownBy(() -> assertSchemaNamesRetainBaseline(List.of(), List.of("ItemResponse")))
                .isInstanceOf(AssertionError.class);
    }

    private JsonNode readContract() throws Exception {
        try (InputStream source = getClass().getResourceAsStream("/contracts/openapi-compatibility.json")) {
            if (source == null) {
                throw new IllegalStateException("OpenAPI compatibility contract is missing");
            }
            return objectMapper.readTree(source);
        }
    }

    private Map<String, Object> normalizeOperations(JsonNode document) {
        Map<String, Object> operations = new TreeMap<>();
        document.path("paths").properties().forEach(path ->
                path.getValue().properties().forEach(method -> {
                    JsonNode operation = method.getValue();
                    Map<String, Object> contract = new TreeMap<>();
                    contract.put("request", requestSchema(operation));
                    contract.put("responses", sortedFieldNames(operation.path("responses")));
                    contract.put("security", securityNames(operation.path("security")));
                    operations.put(method.getKey().toUpperCase() + " " + path.getKey(), contract);
                }));
        return operations;
    }

    private String requestSchema(JsonNode operation) {
        String reference = operation.path("requestBody").path("content").path("application/json")
                .path("schema").path("$ref").asText(null);
        return reference == null ? null : reference.substring(reference.lastIndexOf('/') + 1);
    }

    private List<String> securityNames(JsonNode security) {
        List<String> names = new ArrayList<>();
        security.forEach(requirement -> requirement.propertyNames().forEach(names::add));
        return names.stream().distinct().sorted().toList();
    }

    private Map<String, Object> normalizeSecuritySchemes(JsonNode schemes) {
        Map<String, Object> normalized = new TreeMap<>();
        schemes.properties().forEach(entry -> {
            Map<String, Object> values = new TreeMap<>();
            for (String field : List.of("in", "name", "type")) {
                values.put(field, entry.getValue().path(field).asText());
            }
            normalized.put(entry.getKey(), values);
        });
        return normalized;
    }

    private void assertOperationsRetainBaseline(
            Map<String, Object> actual,
            Map<String, Object> expected) {
        assertThat(actual).containsAllEntriesOf(expected);
    }

    private void assertSchemaNamesRetainBaseline(
            List<String> actual,
            List<String> expected) {
        assertThat(actual).containsAll(expected);
    }

    private void assertSchemaContracts(JsonNode actualSchemas, JsonNode expectedSchemas) {
        expectedSchemas.properties().forEach(entry -> {
            JsonNode actual = actualSchemas.path(entry.getKey());
            JsonNode expected = entry.getValue();
            assertThat(readStrings(actual.path("required"))).as("%s required", entry.getKey())
                    .isEqualTo(readStrings(expected.path("required")));
            assertThat(sortedFieldNames(actual.path("properties"))).as("%s properties", entry.getKey())
                    .isEqualTo(readStrings(expected.path("properties")));

            expected.path("constraints").properties().forEach(constraint -> {
                String[] path = constraint.getKey().split("\\.", 2);
                JsonNode value = actual.path("properties").path(path[0]).path(path[1]);
                Object normalized = value.isArray() ? readStrings(value) : value.numberValue();
                Object expectedValue = constraint.getValue().isArray()
                        ? readStrings(constraint.getValue())
                        : constraint.getValue().numberValue();
                assertThat(normalized).as("%s %s", entry.getKey(), constraint.getKey()).isEqualTo(expectedValue);
            });
        });
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readStringMap(JsonNode value) {
        return objectMapper.convertValue(value, TreeMap.class);
    }

    private List<String> readStrings(JsonNode value) {
        List<String> values = new ArrayList<>();
        value.forEach(entry -> values.add(entry.asText()));
        return values.stream().sorted().toList();
    }

    private List<String> sortedFieldNames(JsonNode value) {
        List<String> fields = new ArrayList<>();
        value.propertyNames().forEach(fields::add);
        return fields.stream().sorted().toList();
    }
}
