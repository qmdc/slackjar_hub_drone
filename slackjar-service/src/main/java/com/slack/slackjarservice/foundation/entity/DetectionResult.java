package com.slack.slackjarservice.foundation.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.slack.slackjarservice.common.base.BaseModel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("detection_result")
public class DetectionResult extends BaseModel {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long taskId;

    private Integer frameIndex;

    private Long frameTime;

    private String objects;

    private Integer objectCount;

    private String summaryData;
}
