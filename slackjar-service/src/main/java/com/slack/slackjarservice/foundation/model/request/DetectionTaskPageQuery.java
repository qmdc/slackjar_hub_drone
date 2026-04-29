package com.slack.slackjarservice.foundation.model.request;

import com.slack.slackjarservice.common.base.BasePagination;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class DetectionTaskPageQuery extends BasePagination {

    private String taskName;

    private Integer status;

    private Long modelId;

    private Long userId;

    private List<Integer> channelIndexes;

    private Long startTime;

    private Long endTime;
}
