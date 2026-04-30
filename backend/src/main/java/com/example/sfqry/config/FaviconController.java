package com.example.sfqry.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
public class FaviconController {

    private static final String FAVICON = """
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="6" fill="#1976d2"/>
              <path d="M9 10h14v3H9zm0 5h14v3H9zm0 5h10v3H9z" fill="#fff"/>
            </svg>
            """;

    @ResponseBody
    @GetMapping(value = {"/favicon.ico", "/favicon.svg"}, produces = "image/svg+xml")
    public String favicon() {
        return FAVICON;
    }
}
