-- ============================================================
-- 无人机群目标检测与跟踪系统 数据库初始化脚本
-- 适用于 MySQL 8.0+
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS slackjar DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE slackjar;

-- ============================================================
-- 检测模型表
-- ============================================================
CREATE TABLE IF NOT EXISTS detection_model (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    model_name VARCHAR(100) NOT NULL COMMENT '模型名称',
    model_code VARCHAR(100) NOT NULL COMMENT '模型编码',
    model_type VARCHAR(50) DEFAULT 'yolov8' COMMENT '模型类型',
    model_path VARCHAR(500) NOT NULL COMMENT '模型文件路径',
    model_size BIGINT DEFAULT 0 COMMENT '模型文件大小（字节）',
    class_names TEXT COMMENT '检测类别名称（JSON格式）',
    input_size INT DEFAULT 640 COMMENT '输入尺寸',
    description VARCHAR(500) COMMENT '描述',
    status TINYINT DEFAULT 1 COMMENT '状态（0-禁用，1-启用）',
    is_default TINYINT DEFAULT 0 COMMENT '是否默认模型（0-否，1-是）',
    default_conf_threshold DECIMAL(3, 2) DEFAULT 0.25 COMMENT '默认置信度阈值',
    default_iou_threshold DECIMAL(3, 2) DEFAULT 0.70 COMMENT '默认IOU阈值',
    max_det INT DEFAULT 300 COMMENT '最大检测数量',
    create_time BIGINT COMMENT '创建时间',
    update_time BIGINT COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除（0-未删，1-已删）',
    version BIGINT DEFAULT 1 COMMENT '版本号',
    PRIMARY KEY (id),
    UNIQUE KEY uk_model_code (model_code),
    KEY idx_status (status),
    KEY idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测模型表';

-- ============================================================
-- 检测任务表
-- ============================================================
CREATE TABLE IF NOT EXISTS detection_task (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    task_code VARCHAR(50) NOT NULL COMMENT '任务编码',
    task_name VARCHAR(200) COMMENT '任务名称',
    video_file_id BIGINT COMMENT '视频文件ID',
    video_url VARCHAR(500) COMMENT '视频URL',
    model_id BIGINT COMMENT '使用的模型ID',
    model_name VARCHAR(100) COMMENT '模型名称',
    conf_threshold DECIMAL(3, 2) DEFAULT 0.25 COMMENT '置信度阈值',
    iou_threshold DECIMAL(3, 2) DEFAULT 0.70 COMMENT 'IOU阈值',
    status TINYINT DEFAULT 0 COMMENT '状态（0-待处理，1-处理中，2-已完成，3-失败，4-已停止）',
    frame_count INT DEFAULT 0 COMMENT '总帧数',
    processed_frames INT DEFAULT 0 COMMENT '已处理帧数',
    total_objects INT DEFAULT 0 COMMENT '总检测目标数',
    start_time BIGINT COMMENT '开始时间',
    end_time BIGINT COMMENT '结束时间',
    error_msg TEXT COMMENT '错误信息',
    user_id BIGINT COMMENT '用户ID',
    channel_index TINYINT COMMENT '通道索引（0-3）',
    summary_data TEXT COMMENT '摘要数据（JSON格式）',
    create_time BIGINT COMMENT '创建时间',
    update_time BIGINT COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除（0-未删，1-已删）',
    version BIGINT DEFAULT 1 COMMENT '版本号',
    PRIMARY KEY (id),
    UNIQUE KEY uk_task_code (task_code),
    KEY idx_status (status),
    KEY idx_user_id (user_id),
    KEY idx_channel_index (channel_index),
    KEY idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测任务表';

-- ============================================================
-- 检测结果表
-- ============================================================
CREATE TABLE IF NOT EXISTS detection_result (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    task_id BIGINT NOT NULL COMMENT '任务ID',
    frame_index INT COMMENT '帧索引',
    frame_time BIGINT COMMENT '帧时间戳',
    objects TEXT COMMENT '检测目标（JSON格式）',
    object_count INT DEFAULT 0 COMMENT '目标数量',
    summary_data TEXT COMMENT '摘要数据（JSON格式）',
    create_time BIGINT COMMENT '创建时间',
    update_time BIGINT COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除（0-未删，1-已删）',
    version BIGINT DEFAULT 1 COMMENT '版本号',
    PRIMARY KEY (id),
    KEY idx_task_id (task_id),
    KEY idx_frame_index (frame_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测结果表';

-- ============================================================
-- 初始化默认模型数据（可选）
-- 注意：需要将实际的模型文件路径替换为您的实际路径
-- ============================================================
-- 插入 yolov8n_visdrone 模型
INSERT INTO detection_model (
    model_name, model_code, model_type, 
    model_path, class_names, input_size,
    description, status, is_default,
    default_conf_threshold, default_iou_threshold, max_det,
    create_time, update_time
) VALUES (
    'YOLOv8n VisDrone', 'yolov8n_visdrone', 'yolov8',
    '/path/to/yolov-model/yolov8n_visdrone/weights/yolov8n.pt',
    '["pedestrian","car","bicycle","truck","motorcycle","bus","awning_tricycle","tricycle","motor_D","motor_T"]',
    640,
    'YOLOv8-nano 模型，基于 VisDrone 数据集训练，适用于无人机视角目标检测',
    1, 1,
    0.25, 0.70, 300,
    UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000
);

-- 插入 yolov8m_visdrone 模型
INSERT INTO detection_model (
    model_name, model_code, model_type, 
    model_path, class_names, input_size,
    description, status, is_default,
    default_conf_threshold, default_iou_threshold, max_det,
    create_time, update_time
) VALUES (
    'YOLOv8m VisDrone', 'yolov8m_visdrone', 'yolov8',
    '/path/to/yolov-model/yolov8m_visdrone/weights/yolov8m.pt',
    '["pedestrian","car","bicycle","truck","motorcycle","bus","awning_tricycle","tricycle","motor_D","motor_T"]',
    640,
    'YOLOv8-medium 模型，基于 VisDrone 数据集训练，精度更高，速度稍慢',
    1, 0,
    0.25, 0.70, 300,
    UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000
);
