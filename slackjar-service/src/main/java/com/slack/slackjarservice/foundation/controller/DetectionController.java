package com.slack.slackjarservice.foundation.controller;

import cn.dev33.satoken.annotation.SaCheckLogin;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.slack.slackjarservice.common.base.BaseController;
import com.slack.slackjarservice.common.response.ApiResponse;
import com.slack.slackjarservice.common.response.PageResult;
import com.slack.slackjarservice.foundation.model.request.DetectionStartRequest;
import com.slack.slackjarservice.foundation.model.request.DetectionTaskPageQuery;
import com.slack.slackjarservice.foundation.model.response.DetectionTaskResponse;
import com.slack.slackjarservice.foundation.service.DetectionService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/detection")
@Validated
public class DetectionController extends BaseController {

    @Resource
    private DetectionService detectionService;

    @GetMapping("/task/page")
    @SaCheckLogin
    public ApiResponse<PageResult<DetectionTaskResponse>> pageQuery(@Valid DetectionTaskPageQuery query) {
        Page<DetectionTaskResponse> page = detectionService.pageQuery(query);
        return success(PageResult.of(page));
    }

    @GetMapping("/task/{taskId}")
    @SaCheckLogin
    public ApiResponse<DetectionTaskResponse> getTaskDetail(@PathVariable("taskId") Long taskId) {
        DetectionTaskResponse response = detectionService.getTaskDetail(taskId);
        return success(response);
    }

    @GetMapping("/task/active")
    @SaCheckLogin
    public ApiResponse<List<DetectionTaskResponse>> getActiveTasks() {
        List<DetectionTaskResponse> tasks = detectionService.getActiveTasks();
        return success(tasks);
    }

    @GetMapping("/task/channel/{channelIndex}")
    @SaCheckLogin
    public ApiResponse<DetectionTaskResponse> getChannelTask(@PathVariable("channelIndex") Integer channelIndex) {
        DetectionTaskResponse response = detectionService.getChannelTask(channelIndex);
        return success(response);
    }

    @PostMapping("/start")
    @SaCheckLogin
    public ApiResponse<DetectionTaskResponse> startDetection(@Valid @RequestBody DetectionStartRequest request) {
        DetectionTaskResponse response = detectionService.startDetection(request);
        return success(response);
    }

    @PostMapping("/stop/{taskId}")
    @SaCheckLogin
    public ApiResponse<Void> stopDetection(@PathVariable("taskId") Long taskId) {
        detectionService.stopDetection(taskId);
        return success();
    }

    @PostMapping("/stop-channel/{channelIndex}")
    @SaCheckLogin
    public ApiResponse<Void> stopDetectionByChannel(@PathVariable("channelIndex") Integer channelIndex) {
        detectionService.stopDetectionByChannel(channelIndex);
        return success();
    }

    @GetMapping("/export/{taskId}")
    @SaCheckLogin
    public ResponseEntity<byte[]> exportDetectionHistory(
            @PathVariable("taskId") Long taskId,
            @RequestParam(value = "type", defaultValue = "csv") String type) {

        byte[] fileContent = detectionService.getExportFile(taskId);

        String fileName = "detection_history_" + taskId + ".csv";
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8)
                .replace("+", "%20");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename*=UTF-8''" + encodedFileName)
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(fileContent);
    }
}
