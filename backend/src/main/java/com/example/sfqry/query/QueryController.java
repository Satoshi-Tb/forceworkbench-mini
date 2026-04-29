package com.example.sfqry.query;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/query")
public class QueryController {

    private final QueryService queryService;

    public QueryController(QueryService queryService) {
        this.queryService = queryService;
    }

    @PostMapping
    public QueryResultDto query(@RequestBody QueryRequestDto request) {
        return queryService.query(request.soql());
    }

    @GetMapping("/runs/{id}/next")
    public QueryResultDto next(@PathVariable String id) {
        return queryService.queryMore(id);
    }

    @PostMapping("/csv")
    public ResponseEntity<String> csv(@RequestBody QueryRequestDto request) {
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"query.csv\"")
                .body(queryService.exportCsv(request.soql()));
    }
}
