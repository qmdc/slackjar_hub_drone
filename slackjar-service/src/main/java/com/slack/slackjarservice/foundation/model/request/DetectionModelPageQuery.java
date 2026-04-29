package com.slack.slackjarservice.foundation.model.request;

import com.slack.slackjarservice.common.base.BasePagination;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class DetectionModelPageQuery extends BasePagination {

    private String modelName;

    private String modelCode;

    private String modelType;

    private Integer status;
}
