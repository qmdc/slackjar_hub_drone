package com.slack.slackjarservice.common.enumtype.detection;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum DetectionSocketTypeEnum {

    DETECTION_FRAME_RESULT("DETECTION_FRAME_RESULT", "检测帧结果"),
    DETECTION_TASK_START("DETECTION_TASK_START", "检测任务开始"),
    DETECTION_TASK_PROGRESS("DETECTION_TASK_PROGRESS", "检测任务进度"),
    DETECTION_TASK_COMPLETED("DETECTION_TASK_COMPLETED", "检测任务完成"),
    DETECTION_TASK_STOPPED("DETECTION_TASK_STOPPED", "检测任务停止"),
    DETECTION_TASK_ERROR("DETECTION_TASK_ERROR", "检测任务错误");

    private final String code;
    private final String description;
}
