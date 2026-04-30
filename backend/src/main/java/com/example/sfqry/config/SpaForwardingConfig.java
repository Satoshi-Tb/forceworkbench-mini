package com.example.sfqry.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class SpaForwardingConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        String forward = "forward:/index.html";
        registry.addViewController("/login").setViewName(forward);
        registry.addViewController("/query").setViewName(forward);
        registry.addViewController("/describe").setViewName(forward);
        registry.addViewController("/describe/{sobject}").setViewName(forward);
    }
}
