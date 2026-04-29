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
@TableName("detection_model")
public class DetectionModel extends BaseModel {

    @TableId(type = IdType.AUTO)
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
}
