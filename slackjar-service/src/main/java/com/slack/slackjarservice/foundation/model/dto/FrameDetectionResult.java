package com.slack.slackjarservice.foundation.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class FrameDetectionResult {

    private Long taskId;

    private Integer frameIndex;

    private Long frameTime;

    private List<DetectionObject> objects;

    private Integer objectCount;

    private String frameData;
}
