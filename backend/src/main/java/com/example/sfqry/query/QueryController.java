package com.example.sfqry.query;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @PostMapping("/csv")
    public ResponseEntity<byte[]> csv(
            @RequestBody QueryRequestDto request,
            @RequestParam(name = "encoding", required = false) String encodingValue) {
        CsvEncoding encoding = CsvEncoding.fromRequestValue(encodingValue);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", encoding.charset()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"query.csv\"")
                .body(queryService.exportCsv(request.soql()).getBytes(encoding.charset()));
    }
}
