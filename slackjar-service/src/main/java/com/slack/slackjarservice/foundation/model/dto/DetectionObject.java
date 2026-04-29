package com.slack.slackjarservice.foundation.model.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class DetectionObject {

    private Integer trackId;

    private String className;

    private BigDecimal confidence;

    private Integer x;

    private Integer y;

    private Integer width;

    private Integer height;
}
