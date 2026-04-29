package com.slack.slackjarservice.foundation.detection;

import com.alibaba.fastjson2.JSON;
import com.slack.slackjarservice.common.constant.DetectionConstants;
import com.slack.slackjarservice.common.enumtype.detection.DetectionSocketTypeEnum;
import com.slack.slackjarservice.common.enumtype.detection.DetectionStatusEnum;
import com.slack.slackjarservice.foundation.dao.DetectionResultDao;
import com.slack.slackjarservice.foundation.dao.DetectionTaskDao;
import com.slack.slackjarservice.foundation.entity.DetectionResult;
import com.slack.slackjarservice.foundation.entity.DetectionTask;
import com.slack.slackjarservice.foundation.model.dto.DetectionObject;
import com.slack.slackjarservice.foundation.model.dto.DetectionSummary;
import com.slack.slackjarservice.foundation.model.dto.FrameDetectionResult;
import com.slack.slackjarservice.foundation.model.dto.SocketMessageDTO;
import com.slack.slackjarservice.foundation.socketio.BackendMessagePush;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Component
public class DetectionProcessManager {

    @Resource
    private DetectionTaskDao detectionTaskDao;

    @Resource
    private DetectionResultDao detectionResultDao;

    @Resource
    private BackendMessagePush backendMessagePush;

    private final Map<Integer, ProcessInfo> channelProcesses = new ConcurrentHashMap<>();
    private final ExecutorService executorService = Executors.newCachedThreadPool();

    public static class ProcessInfo {
        public Process process;
        public Long taskId;
        public Integer channelIndex;
        public Thread outputReader;
        public Thread errorReader;
        public DetectionSummary summary;
        public int totalFrames;
        public int processedFrames;

        public ProcessInfo(Process process, Long taskId, Integer channelIndex) {
            this.process = process;
            this.taskId = taskId;
            this.channelIndex = channelIndex;
            this.summary = new DetectionSummary();
            this.summary.setClassCounts(new HashMap<>());
            this.summary.setConfidenceDistribution(new ArrayList<>());
        }
    }

    public boolean isChannelActive(Integer channelIndex) {
        ProcessInfo info = channelProcesses.get(channelIndex);
        return info != null && info.process.isAlive();
    }

    public ProcessInfo getChannelProcessInfo(Integer channelIndex) {
        return channelProcesses.get(channelIndex);
    }

    public void startDetection(Long taskId, Integer channelIndex, String modelPath,
                                String videoUrl, BigDecimal confThreshold, BigDecimal iouThreshold,
                                Integer maxDet, Boolean enableTracking, Integer frameSkip) {

        if (isChannelActive(channelIndex)) {
            throw new IllegalStateException("通道 " + channelIndex + " 已有检测任务运行中");
        }

        try {
            List<String> command = buildCommand(modelPath, videoUrl, confThreshold, iouThreshold,
                    maxDet, enableTracking, frameSkip, channelIndex, taskId);

            log.info("启动检测进程，任务ID: {}, 通道: {}, 命令: {}", taskId, channelIndex, command);

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(false);
            Process process = pb.start();

            ProcessInfo processInfo = new ProcessInfo(process, taskId, channelIndex);
            channelProcesses.put(channelIndex, processInfo);

            startOutputReader(processInfo);
            startErrorReader(processInfo);

            updateTaskStatus(taskId, DetectionStatusEnum.PROCESSING, "检测进程已启动");

            SocketMessageDTO startMsg = new SocketMessageDTO(
                    Map.of("taskId", taskId, "channelIndex", channelIndex, "status", "started"),
                    DetectionSocketTypeEnum.DETECTION_TASK_START.getCode()
            );
            backendMessagePush.broadcastMessage(startMsg);

        } catch (Exception e) {
            log.error("启动检测进程失败，任务ID: {}, 通道: {}", taskId, channelIndex, e);
            updateTaskStatus(taskId, DetectionStatusEnum.FAILED, e.getMessage());
            throw new RuntimeException("启动检测进程失败: " + e.getMessage(), e);
        }
    }

    private List<String> buildCommand(String modelPath, String videoUrl,
                                        BigDecimal confThreshold, BigDecimal iouThreshold,
                                        Integer maxDet, Boolean enableTracking, Integer frameSkip,
                                        Integer channelIndex, Long taskId) {
        List<String> command = new ArrayList<>();

        String pythonExe = "python";
        String scriptPath = System.getProperty("user.dir") + "/" + DetectionConstants.PYTHON_SCRIPT;

        command.add(pythonExe);
        command.add(scriptPath);

        command.add("--model");
        command.add(modelPath);

        command.add("--source");
        command.add(videoUrl);

        command.add("--conf");
        command.add(confThreshold.toString());

        command.add("--iou");
        command.add(iouThreshold.toString());

        if (maxDet != null) {
            command.add("--max-det");
            command.add(maxDet.toString());
        }

        if (enableTracking != null && enableTracking) {
            command.add("--track");
        }

        if (frameSkip != null && frameSkip > 1) {
            command.add("--frame-skip");
            command.add(frameSkip.toString());
        }

        command.add("--channel");
        command.add(channelIndex.toString());

        command.add("--task-id");
        command.add(taskId.toString());

        return command;
    }

    private void startOutputReader(ProcessInfo processInfo) {
        processInfo.outputReader = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(processInfo.process.getInputStream(), StandardCharsets.UTF_8))) {

                String line;
                while ((line = reader.readLine()) != null) {
                    try {
                        processOutputLine(line, processInfo);
                    } catch (Exception e) {
                        log.warn("处理检测输出行失败: {}", line, e);
                    }
                }

                int exitCode = processInfo.process.waitFor();
                handleProcessExit(processInfo, exitCode);

            } catch (Exception e) {
                log.error("读取检测进程输出失败，任务ID: {}", processInfo.taskId, e);
                updateTaskStatus(processInfo.taskId, DetectionStatusEnum.FAILED, e.getMessage());
            }
        });
        processInfo.outputReader.setName("detection-reader-" + processInfo.channelIndex);
        processInfo.outputReader.start();
    }

    private void startErrorReader(ProcessInfo processInfo) {
        processInfo.errorReader = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(processInfo.process.getErrorStream(), StandardCharsets.UTF_8))) {

                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("检测进程错误输出 [通道{}]: {}", processInfo.channelIndex, line);
                }

            } catch (Exception e) {
                log.error("读取检测进程错误输出失败，任务ID: {}", processInfo.taskId, e);
            }
        });
        processInfo.errorReader.setName("detection-error-reader-" + processInfo.channelIndex);
        processInfo.errorReader.start();
    }

    @SuppressWarnings("unchecked")
    private void processOutputLine(String line, ProcessInfo processInfo) {
        if (line == null || line.trim().isEmpty()) {
            return;
        }

        try {
            Map<String, Object> data = JSON.parseObject(line);
            if (data == null) {
                return;
            }

            String type = (String) data.get("type");
            if (type == null) {
                return;
            }

            switch (type) {
                case "frame_result":
                    handleFrameResult(data, processInfo);
                    break;
                case "progress":
                    handleProgress(data, processInfo);
                    break;
                case "summary":
                    handleSummary(data, processInfo);
                    break;
                default:
                    log.debug("未知的检测输出类型: {}", type);
            }

        } catch (Exception e) {
            log.debug("解析检测输出失败: {}", line, e);
        }
    }

    @SuppressWarnings("unchecked")
    private void handleFrameResult(Map<String, Object> data, ProcessInfo processInfo) {
        Long taskId = processInfo.taskId;
        Integer channelIndex = processInfo.channelIndex;

        Integer frameIndex = getIntValue(data.get("frame_index"));
        Long frameTime = getLongValue(data.get("frame_time"));

        List<Map<String, Object>> objectsData = (List<Map<String, Object>>) data.get("objects");
        List<DetectionObject> objects = new ArrayList<>();

        if (objectsData != null) {
            for (Map<String, Object> objData : objectsData) {
                DetectionObject obj = new DetectionObject();
                obj.setTrackId(getIntValue(objData.get("track_id")));
                obj.setClassName((String) objData.get("class_name"));
                obj.setConfidence(objData.get("confidence") != null ?
                        BigDecimal.valueOf(((Number) objData.get("confidence")).doubleValue()) : BigDecimal.ZERO);
                obj.setX(getIntValue(objData.get("x"), 0));
                obj.setY(getIntValue(objData.get("y"), 0));
                obj.setWidth(getIntValue(objData.get("width"), 0));
                obj.setHeight(getIntValue(objData.get("height"), 0));
                objects.add(obj);

                Map<String, Integer> classCounts = processInfo.summary.getClassCounts();
                if (obj.getClassName() != null) {
                    classCounts.put(obj.getClassName(),
                            classCounts.getOrDefault(obj.getClassName(), 0) + 1);
                }

                if (obj.getConfidence() != null) {
                    processInfo.summary.getConfidenceDistribution().add(obj.getConfidence().doubleValue());
                }
            }
        }

        FrameDetectionResult frameResult = new FrameDetectionResult();
        frameResult.setTaskId(taskId);
        frameResult.setFrameIndex(frameIndex);
        frameResult.setFrameTime(frameTime);
        frameResult.setObjects(objects);
        frameResult.setObjectCount(objects.size());

        processInfo.summary.setTotalObjects(processInfo.summary.getTotalObjects() + objects.size());
        processInfo.processedFrames++;

        Map<String, Object> resultMap = new HashMap<>();
        resultMap.put("taskId", taskId);
        resultMap.put("channelIndex", channelIndex);
        resultMap.put("frameIndex", frameIndex);
        resultMap.put("frameTime", frameTime);
        resultMap.put("objects", objects);
        resultMap.put("objectCount", objects.size());

        SocketMessageDTO msg = new SocketMessageDTO(resultMap,
                DetectionSocketTypeEnum.DETECTION_FRAME_RESULT.getCode());
        backendMessagePush.broadcastMessage(msg);

        saveDetectionResult(processInfo, frameResult);
    }

    private void handleProgress(Map<String, Object> data, ProcessInfo processInfo) {
        Integer totalFrames = getIntValue(data.get("total_frames"));
        Integer processedFrames = getIntValue(data.get("processed_frames"), 0);
        Integer fps = getIntValue(data.get("fps"), 0);

        if (totalFrames != null) {
            processInfo.totalFrames = totalFrames;
        }
        if (fps != null) {
            processInfo.summary.setFps(fps);
        }

        Map<String, Object> progressMap = new HashMap<>();
        progressMap.put("taskId", processInfo.taskId);
        progressMap.put("channelIndex", processInfo.channelIndex);
        progressMap.put("totalFrames", totalFrames);
        progressMap.put("processedFrames", processedFrames);
        progressMap.put("fps", fps);

        SocketMessageDTO msg = new SocketMessageDTO(progressMap,
                DetectionSocketTypeEnum.DETECTION_TASK_PROGRESS.getCode());
        backendMessagePush.broadcastMessage(msg);

        updateTaskProgress(processInfo.taskId, processedFrames, totalFrames);
    }

    @SuppressWarnings("unchecked")
    private void handleSummary(Map<String, Object> data, ProcessInfo processInfo) {
        Map<String, Object> summaryData = (Map<String, Object>) data.get("summary");
        if (summaryData != null) {
            processInfo.summary.setProcessedFrames(getIntValue(summaryData.get("processed_frames"), 0));
            processInfo.summary.setTotalObjects(getIntValue(summaryData.get("total_objects"), 0));

            Map<String, Integer> classCounts = (Map<String, Integer>) summaryData.get("class_counts");
            if (classCounts != null) {
                processInfo.summary.getClassCounts().putAll(classCounts);
            }
        }
    }

    private void handleProcessExit(ProcessInfo processInfo, int exitCode) {
        Long taskId = processInfo.taskId;

        channelProcesses.remove(processInfo.channelIndex);

        if (exitCode == 0) {
            DetectionSummary summary = processInfo.summary;
            summary.setProcessedFrames(processInfo.processedFrames);

            if (!summary.getConfidenceDistribution().isEmpty()) {
                double avg = summary.getConfidenceDistribution().stream()
                        .mapToDouble(Double::doubleValue)
                        .average()
                        .orElse(0.0);
                summary.setAvgConfidence(avg);
            }

            String summaryJson = JSON.toJSONString(summary);

            DetectionTask task = new DetectionTask();
            task.setId(taskId);
            task.setStatus(DetectionStatusEnum.COMPLETED.getCode());
            task.setEndTime(System.currentTimeMillis());
            task.setProcessedFrames(processInfo.processedFrames);
            task.setTotalObjects(summary.getTotalObjects());
            task.setSummaryData(summaryJson);
            detectionTaskDao.updateById(task);

            SocketMessageDTO msg = new SocketMessageDTO(
                    Map.of("taskId", taskId, "channelIndex", processInfo.channelIndex,
                            "summary", summary),
                    DetectionSocketTypeEnum.DETECTION_TASK_COMPLETED.getCode()
            );
            backendMessagePush.broadcastMessage(msg);

            log.info("检测任务完成，任务ID: {}, 退出码: {}", taskId, exitCode);
        } else {
            updateTaskStatus(taskId, DetectionStatusEnum.FAILED, "进程退出码: " + exitCode);

            SocketMessageDTO msg = new SocketMessageDTO(
                    Map.of("taskId", taskId, "channelIndex", processInfo.channelIndex,
                            "error", "进程异常退出，退出码: " + exitCode),
                    DetectionSocketTypeEnum.DETECTION_TASK_ERROR.getCode()
            );
            backendMessagePush.broadcastMessage(msg);

            log.error("检测任务失败，任务ID: {}, 退出码: {}", taskId, exitCode);
        }
    }

    private void saveDetectionResult(ProcessInfo processInfo, FrameDetectionResult frameResult) {
        DetectionResult result = new DetectionResult();
        result.setTaskId(processInfo.taskId);
        result.setFrameIndex(frameResult.getFrameIndex());
        result.setFrameTime(frameResult.getFrameTime());
        result.setObjects(JSON.toJSONString(frameResult.getObjects()));
        result.setObjectCount(frameResult.getObjectCount());
        detectionResultDao.insert(result);
    }

    private void updateTaskStatus(Long taskId, DetectionStatusEnum status, String message) {
        DetectionTask task = new DetectionTask();
        task.setId(taskId);
        task.setStatus(status.getCode());
        if (status == DetectionStatusEnum.COMPLETED || status == DetectionStatusEnum.FAILED
                || status == DetectionStatusEnum.STOPPED) {
            task.setEndTime(System.currentTimeMillis());
        }
        if (status == DetectionStatusEnum.PROCESSING) {
            task.setStartTime(System.currentTimeMillis());
        }
        if (status == DetectionStatusEnum.FAILED) {
            task.setErrorMsg(message);
        }
        detectionTaskDao.updateById(task);
    }

    private void updateTaskProgress(Long taskId, Integer processedFrames, Integer totalFrames) {
        DetectionTask task = new DetectionTask();
        task.setId(taskId);
        task.setProcessedFrames(processedFrames);
        if (totalFrames != null && totalFrames > 0) {
            task.setFrameCount(totalFrames);
        }
        detectionTaskDao.updateById(task);
    }

    public void stopDetection(Integer channelIndex) {
        ProcessInfo processInfo = channelProcesses.get(channelIndex);
        if (processInfo == null) {
            return;
        }

        try {
            if (processInfo.process.isAlive()) {
                processInfo.process.destroy();
                boolean terminated = processInfo.process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
                if (!terminated) {
                    processInfo.process.destroyForcibly();
                }
            }

            channelProcesses.remove(channelIndex);

            updateTaskStatus(processInfo.taskId, DetectionStatusEnum.STOPPED, "用户手动停止");

            SocketMessageDTO msg = new SocketMessageDTO(
                    Map.of("taskId", processInfo.taskId, "channelIndex", channelIndex),
                    DetectionSocketTypeEnum.DETECTION_TASK_STOPPED.getCode()
            );
            backendMessagePush.broadcastMessage(msg);

            log.info("检测任务已停止，任务ID: {}, 通道: {}", processInfo.taskId, channelIndex);

        } catch (Exception e) {
            log.error("停止检测任务失败，任务ID: {}, 通道: {}",
                    processInfo.taskId, channelIndex, e);
            throw new RuntimeException("停止检测任务失败: " + e.getMessage(), e);
        }
    }

    @PreDestroy
    public void shutdown() {
        log.info("正在关闭所有检测进程...");
        for (Integer channelIndex : new ArrayList<>(channelProcesses.keySet())) {
            try {
                stopDetection(channelIndex);
            } catch (Exception e) {
                log.error("关闭通道 {} 的检测进程失败", channelIndex, e);
            }
        }
        executorService.shutdown();
        log.info("所有检测进程已关闭");
    }

    private Integer getIntValue(Object value) {
        return getIntValue(value, null);
    }

    private Integer getIntValue(Object value, Integer defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    private Long getLongValue(Object value) {
        return getLongValue(value, null);
    }

    private Long getLongValue(Object value, Long defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value instanceof String) {
            try {
                return Long.parseLong((String) value);
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }
}
