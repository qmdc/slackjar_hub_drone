package com.slack.slackjarservice.foundation.controller;

import cn.dev33.satoken.annotation.SaCheckLogin;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.slack.slackjarservice.common.base.BaseController;
import com.slack.slackjarservice.common.enumtype.detection.DetectionStatusEnum;
import com.slack.slackjarservice.common.response.ApiResponse;
import com.slack.slackjarservice.foundation.dao.DetectionResultDao;
import com.slack.slackjarservice.foundation.dao.DetectionTaskDao;
import com.slack.slackjarservice.foundation.entity.DetectionResult;
import com.slack.slackjarservice.foundation.entity.DetectionTask;
import com.slack.slackjarservice.foundation.model.dto.DetectionSummary;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.lang.reflect.Type;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/detection-metrics")
@Validated
public class DetectionMetricsController extends BaseController {

    @Resource
    private DetectionTaskDao detectionTaskDao;

    @Resource
    private DetectionResultDao detectionResultDao;

    @GetMapping("/overview")
    @SaCheckLogin
    public ApiResponse<Map<String, Object>> getOverviewMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        Long totalTasks = detectionTaskDao.selectCount(
                new LambdaQueryWrapper<DetectionTask>()
        );
        metrics.put("totalTasks", totalTasks);

        Long completedTasks = detectionTaskDao.selectCount(
                new LambdaQueryWrapper<DetectionTask>()
                        .eq(DetectionTask::getStatus, DetectionStatusEnum.COMPLETED.getCode())
        );
        metrics.put("completedTasks", completedTasks);

        Long activeTasks = detectionTaskDao.selectCount(
                new LambdaQueryWrapper<DetectionTask>()
                        .in(DetectionTask::getStatus,
                                DetectionStatusEnum.PENDING.getCode(),
                                DetectionStatusEnum.PROCESSING.getCode())
        );
        metrics.put("activeTasks", activeTasks);

        Long failedTasks = detectionTaskDao.selectCount(
                new LambdaQueryWrapper<DetectionTask>()
                        .eq(DetectionTask::getStatus, DetectionStatusEnum.FAILED.getCode())
        );
        metrics.put("failedTasks", failedTasks);

        Long totalResults = detectionResultDao.selectCount(
                new LambdaQueryWrapper<DetectionResult>()
        );
        metrics.put("totalResults", totalResults);

        metrics.put("channels", 4);

        return success(metrics);
    }

    @GetMapping("/task/{taskId}")
    @SaCheckLogin
    public ApiResponse<Map<String, Object>> getTaskMetrics(@PathVariable("taskId") Long taskId) {
        DetectionTask task = detectionTaskDao.selectById(taskId);
        if (task == null) {
            return success(new HashMap<>());
        }

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("taskId", taskId);
        metrics.put("taskName", task.getTaskName());
        metrics.put("status", task.getStatus());
        metrics.put("frameCount", task.getFrameCount());
        metrics.put("processedFrames", task.getProcessedFrames());
        metrics.put("totalObjects", task.getTotalObjects());

        if (task.getSummaryData() != null) {
            try {
                DetectionSummary summary = com.alibaba.fastjson2.JSON.parseObject(
                        task.getSummaryData(), DetectionSummary.class);
                metrics.put("summary", summary);
            } catch (Exception e) {
                log.warn("解析摘要数据失败，任务ID: {}", taskId, e);
            }
        }

        List<DetectionResult> results = detectionResultDao.selectList(
                new LambdaQueryWrapper<DetectionResult>()
                        .eq(DetectionResult::getTaskId, taskId)
                        .orderByAsc(DetectionResult::getFrameIndex)
        );

        if (!results.isEmpty()) {
            Map<String, Integer> classDistribution = new HashMap<>();
            List<Double> confidenceList = new ArrayList<>();

            for (DetectionResult result : results) {
                if (result.getObjects() != null) {
                    try {
                        List<Map<String, Object>> objects = com.alibaba.fastjson2.JSON.parseArray(
                                result.getObjects(), (Type) Map.class);
                        for (Map<String, Object> obj : objects) {
                            String className = (String) obj.get("className");
                            if (className != null) {
                                classDistribution.put(className,
                                        classDistribution.getOrDefault(className, 0) + 1);
                            }
                            Object confidence = obj.get("confidence");
                            if (confidence != null) {
                                if (confidence instanceof Number) {
                                    confidenceList.add(((Number) confidence).doubleValue());
                                }
                            }
                        }
                    } catch (Exception e) {
                        log.warn("解析检测结果失败", e);
                    }
                }
            }

            metrics.put("classDistribution", classDistribution);

            if (!confidenceList.isEmpty()) {
                Collections.sort(confidenceList);
                Map<String, Integer> confidenceDistribution = new LinkedHashMap<>();
                int[] ranges = {0, 20, 40, 60, 80, 100};
                for (int i = 0; i < ranges.length - 1; i++) {
                    int start = ranges[i];
                    int end = ranges[i + 1];
                    String key = start + "-" + end + "%";
                    long count = confidenceList.stream()
                            .filter(c -> c >= start / 100.0 && c < end / 100.0)
                            .count();
                    confidenceDistribution.put(key, (int) count);
                }
                metrics.put("confidenceDistribution", confidenceDistribution);

                double avgConfidence = confidenceList.stream()
                        .mapToDouble(Double::doubleValue)
                        .average()
                        .orElse(0.0);
                metrics.put("avgConfidence", avgConfidence);
            }
        }

        return success(metrics);
    }

    @GetMapping("/channel-status")
    @SaCheckLogin
    public ApiResponse<List<Map<String, Object>>> getChannelStatus() {
        List<Map<String, Object>> channels = new ArrayList<>();

        for (int i = 0; i < 4; i++) {
            Map<String, Object> channel = new HashMap<>();
            channel.put("channelIndex", i);
            channel.put("status", "idle");
            channel.put("taskId", null);
            channel.put("taskName", null);
            channels.add(channel);
        }

        List<DetectionTask> activeTasks = detectionTaskDao.selectList(
                new LambdaQueryWrapper<DetectionTask>()
                        .in(DetectionTask::getStatus,
                                DetectionStatusEnum.PENDING.getCode(),
                                DetectionStatusEnum.PROCESSING.getCode())
        );

        for (DetectionTask task : activeTasks) {
            if (task.getChannelIndex() != null && task.getChannelIndex() >= 0 && task.getChannelIndex() < 4) {
                Map<String, Object> channel = channels.get(task.getChannelIndex());
                channel.put("status", "active");
                channel.put("taskId", task.getId());
                channel.put("taskName", task.getTaskName());
                channel.put("modelName", task.getModelName());
                channel.put("processedFrames", task.getProcessedFrames());
                channel.put("totalObjects", task.getTotalObjects());
            }
        }

        return success(channels);
    }

    @GetMapping("/recent-tasks")
    @SaCheckLogin
    public ApiResponse<List<DetectionTask>> getRecentTasks(
            @RequestParam(value = "limit", defaultValue = "10") Integer limit) {
        List<DetectionTask> tasks = detectionTaskDao.selectList(
                new LambdaQueryWrapper<DetectionTask>()
                        .orderByDesc(DetectionTask::getCreateTime)
                        .last("LIMIT " + limit)
        );
        return success(tasks);
    }
}
