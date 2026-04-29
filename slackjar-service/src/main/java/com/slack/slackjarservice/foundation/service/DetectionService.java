package com.slack.slackjarservice.foundation.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.slack.slackjarservice.foundation.entity.DetectionTask;
import com.slack.slackjarservice.foundation.model.request.DetectionStartRequest;
import com.slack.slackjarservice.foundation.model.request.DetectionTaskPageQuery;
import com.slack.slackjarservice.foundation.model.response.DetectionTaskResponse;

import java.util.List;

public interface DetectionService extends IService<DetectionTask> {

    Page<DetectionTaskResponse> pageQuery(DetectionTaskPageQuery query);

    DetectionTaskResponse getTaskDetail(Long taskId);

    DetectionTaskResponse startDetection(DetectionStartRequest request);

    void stopDetection(Long taskId);

    void stopDetectionByChannel(Integer channelIndex);

    DetectionTaskResponse getChannelTask(Integer channelIndex);

    List<DetectionTaskResponse> getActiveTasks();

    void exportDetectionHistory(Long taskId, String exportType);

    byte[] getExportFile(Long taskId);
}
