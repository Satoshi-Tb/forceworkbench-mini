package com.example.sfqry.describe;

import com.example.sfqry.describe.dto.DescribeGlobalDto;
import com.example.sfqry.describe.dto.DescribeSObjectDto;
import org.springframework.cache.CacheManager;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DescribeController {

    private final DescribeService describeService;
    private final CacheManager cacheManager;

    public DescribeController(DescribeService describeService, CacheManager cacheManager) {
        this.describeService = describeService;
        this.cacheManager = cacheManager;
    }

    @GetMapping("/describe/global")
    public DescribeGlobalDto global() {
        return describeService.describeGlobal();
    }

    @GetMapping("/describe/{sobject}")
    public DescribeSObjectDto sobject(@PathVariable String sobject) {
        return describeService.describeSObject(sobject);
    }

    @PostMapping("/cache/clear")
    public ResponseEntity<Void> clearCache() {
        cacheManager.getCacheNames().forEach(name -> {
            if (cacheManager.getCache(name) != null) {
                cacheManager.getCache(name).clear();
            }
        });
        return ResponseEntity.noContent().build();
    }
}
