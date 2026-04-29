package com.slack.slackjarservice.foundation.model.response;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class DetectionTaskResponse {

    private Long id;

    private String taskCode;

    private String taskName;

    private Long videoFileId;

    private String videoUrl;

    private Long modelId;

    private String modelName;

    private BigDecimal confThreshold;

    private BigDecimal iouThreshold;

    private Integer status;

    private Integer frameCount;

    private Integer processedFrames;

    private Integer totalObjects;

    private Long startTime;

    private Long endTime;

    private String errorMsg;

    private Long userId;

    private Integer channelIndex;

    private String summaryData;

    private Long createTime;

    private Long updateTime;
}
