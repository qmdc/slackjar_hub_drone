package com.slack.slackjarservice.common.constant;

public interface DetectionConstants {

    String MODEL_DIR = "yolov-model";
    String PYTHON_SCRIPT = "detection_service.py";
    int MAX_CHANNELS = 4;
    double DEFAULT_CONF_THRESHOLD = 0.25;
    double DEFAULT_IOU_THRESHOLD = 0.7;
    int DEFAULT_MAX_DET = 300;
    int DEFAULT_FRAME_SKIP = 1;
    String EXPORT_TYPE_CSV = "csv";
    String EXPORT_TYPE_JSON = "json";
    String EXPORT_TYPE_EXCEL = "excel";
}
