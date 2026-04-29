package com.slack.slackjarservice.common.enumtype.detection;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum DetectionStatusEnum {

    PENDING(0, "待处理"),
    PROCESSING(1, "处理中"),
    COMPLETED(2, "已完成"),
    FAILED(3, "已失败"),
    STOPPED(4, "已停止");

    private final int code;
    private final String message;

    public static DetectionStatusEnum getByCode(int code) {
        for (DetectionStatusEnum status : values()) {
            if (status.getCode() == code) {
                return status;
            }
        }
        return null;
    }
}
