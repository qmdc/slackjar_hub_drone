package com.slack.slackjarservice.foundation.model.request;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class DetectionStartRequest {

    private Integer channelIndex;

    private Long modelId;

    private String videoUrl;

    private String taskName;

    private BigDecimal confThreshold;

    private BigDecimal iouThreshold;

    private Boolean enableTracking;

    private Integer frameSkip;
}
