package com.slack.slackjarservice.foundation.model.response;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class DetectionModelResponse {

    private Long id;

    private String modelName;

    private String modelCode;

    private String modelType;

    private String modelPath;

    private Long modelSize;

    private String classNames;

    private Integer inputSize;

    private String description;

    private Integer status;

    private Integer isDefault;

    private BigDecimal defaultConfThreshold;

    private BigDecimal defaultIouThreshold;

    private Integer maxDet;

    private Long createTime;

    private Long updateTime;
}
