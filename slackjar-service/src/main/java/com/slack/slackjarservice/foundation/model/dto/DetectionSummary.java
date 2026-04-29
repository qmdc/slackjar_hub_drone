package com.slack.slackjarservice.foundation.model.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class DetectionSummary {

    private Integer totalObjects;

    private Map<String, Integer> classCounts;

    private List<Double> confidenceDistribution;

    private Double avgConfidence;

    private Integer processedFrames;

    private Integer fps;
}
