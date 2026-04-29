package com.slack.slackjarservice.foundation.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.slack.slackjarservice.common.base.BaseModel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("detection_task")
public class DetectionTask extends BaseModel {

    @TableId(type = IdType.AUTO)
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
}
