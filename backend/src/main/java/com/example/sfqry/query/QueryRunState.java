package com.example.sfqry.query;

import java.io.Serializable;

public record QueryRunState(String nextResource, boolean done) implements Serializable {}
