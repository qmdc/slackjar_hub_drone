package com.slack.slackjarservice.foundation.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.alibaba.fastjson2.JSON;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.slack.slackjarservice.common.constant.DetectionConstants;
import com.slack.slackjarservice.common.enumtype.detection.DetectionStatusEnum;
import com.slack.slackjarservice.common.enumtype.foundation.ResponseEnum;
import com.slack.slackjarservice.common.exception.BusinessException;
import com.slack.slackjarservice.common.util.AssertUtil;
import com.slack.slackjarservice.common.util.RandomUtil;
import com.slack.slackjarservice.foundation.dao.DetectionResultDao;
import com.slack.slackjarservice.foundation.dao.DetectionTaskDao;
import com.slack.slackjarservice.foundation.detection.DetectionProcessManager;
import com.slack.slackjarservice.foundation.entity.DetectionModel;
import com.slack.slackjarservice.foundation.entity.DetectionResult;
import com.slack.slackjarservice.foundation.entity.DetectionTask;
import com.slack.slackjarservice.foundation.model.dto.DetectionSummary;
import com.slack.slackjarservice.foundation.model.request.DetectionStartRequest;
import com.slack.slackjarservice.foundation.model.request.DetectionTaskPageQuery;
import com.slack.slackjarservice.foundation.model.response.DetectionModelResponse;
import com.slack.slackjarservice.foundation.model.response.DetectionTaskResponse;
import com.slack.slackjarservice.foundation.service.DetectionModelService;
import com.slack.slackjarservice.foundation.service.DetectionService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DetectionServiceImpl extends ServiceImpl<DetectionTaskDao, DetectionTask>
        implements DetectionService {

    @Resource
    private DetectionTaskDao detectionTaskDao;

    @Resource
    private DetectionResultDao detectionResultDao;

    @Resource
    private DetectionModelService detectionModelService;

    @Resource
    private DetectionProcessManager detectionProcessManager;

    @Override
    public Page<DetectionTaskResponse> pageQuery(DetectionTaskPageQuery query) {
        Page<DetectionTask> page = new Page<>(query.getPageNo(), query.getPageSize());

        LambdaQueryWrapper<DetectionTask> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(query.getTaskName())) {
            wrapper.like(DetectionTask::getTaskName, query.getTaskName());
        }
        if (query.getStatus() != null) {
            wrapper.eq(DetectionTask::getStatus, query.getStatus());
        }
        if (query.getModelId() != null) {
            wrapper.eq(DetectionTask::getModelId, query.getModelId());
        }
        if (query.getUserId() != null) {
            wrapper.eq(DetectionTask::getUserId, query.getUserId());
        }
        if (!CollectionUtils.isEmpty(query.getChannelIndexes())) {
            wrapper.in(DetectionTask::getChannelIndex, query.getChannelIndexes());
        }
        if (query.getStartTime() != null) {
            wrapper.ge(DetectionTask::getCreateTime, query.getStartTime());
        }
        if (query.getEndTime() != null) {
            wrapper.le(DetectionTask::getCreateTime, query.getEndTime());
        }

        wrapper.orderByDesc(DetectionTask::getCreateTime);

        Page<DetectionTask> resultPage = detectionTaskDao.selectPage(page, wrapper);

        Page<DetectionTaskResponse> responsePage = new Page<>();
        responsePage.setCurrent(resultPage.getCurrent());
        responsePage.setSize(resultPage.getSize());
        responsePage.setTotal(resultPage.getTotal());
        responsePage.setPages(resultPage.getPages());
        responsePage.setRecords(resultPage.getRecords().stream()
                .map(this::toResponse)
                .collect(Collectors.toList()));

        return responsePage;
    }

    @Override
    public DetectionTaskResponse getTaskDetail(Long taskId) {
        DetectionTask task = detectionTaskDao.selectById(taskId);
        AssertUtil.notNull(task, ResponseEnum.NOT_FOUND_ERROR);
        return toResponse(task);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DetectionTaskResponse startDetection(DetectionStartRequest request) {
        Integer channelIndex = request.getChannelIndex();
        if (channelIndex == null || channelIndex < 0 || channelIndex >= DetectionConstants.MAX_CHANNELS) {
            throw new BusinessException("无效的通道索引，范围: 0-" + (DetectionConstants.MAX_CHANNELS - 1));
        }

        if (detectionProcessManager.isChannelActive(channelIndex)) {
            throw new BusinessException("通道 " + channelIndex + " 已有检测任务运行中");
        }

        Long modelId = request.getModelId();
        DetectionModel model;
        if (modelId == null) {
            model = detectionModelService.getDefaultModel();
            if (model == null) {
                throw new BusinessException("未找到可用的模型，请先配置模型");
            }
            modelId = model.getId();
        } else {
            DetectionModelResponse modelResponse = detectionModelService.getDetail(modelId);
            AssertUtil.notNull(modelResponse, ResponseEnum.NOT_FOUND_ERROR);
            model = new DetectionModel();
            BeanUtils.copyProperties(modelResponse, model);
        }

        String videoUrl = request.getVideoUrl();
        if (!StringUtils.hasText(videoUrl)) {
            throw new BusinessException("视频URL不能为空");
        }

        String taskCode = "DET-" + System.currentTimeMillis() + "-" + RandomUtil.getRandomDigits(4);

        DetectionTask task = new DetectionTask();
        task.setTaskCode(taskCode);
        task.setTaskName(StringUtils.hasText(request.getTaskName()) ?
                request.getTaskName() : "检测任务-" + taskCode);
        task.setVideoUrl(videoUrl);
        task.setModelId(modelId);
        task.setModelName(model.getModelName());
        task.setConfThreshold(request.getConfThreshold() != null ?
                request.getConfThreshold() : model.getDefaultConfThreshold());
        task.setIouThreshold(request.getIouThreshold() != null ?
                request.getIouThreshold() : model.getDefaultIouThreshold());
        task.setStatus(DetectionStatusEnum.PENDING.getCode());
        task.setChannelIndex(channelIndex);
        task.setUserId(StpUtil.getLoginIdAsLong());
        task.setFrameCount(0);
        task.setProcessedFrames(0);
        task.setTotalObjects(0);

        detectionTaskDao.insert(task);

        try {
            detectionProcessManager.startDetection(
                    task.getId(),
                    channelIndex,
                    model.getModelPath(),
                    videoUrl,
                    task.getConfThreshold(),
                    task.getIouThreshold(),
                    model.getMaxDet(),
                    request.getEnableTracking() != null ? request.getEnableTracking() : true,
                    request.getFrameSkip() != null ? request.getFrameSkip() : DetectionConstants.DEFAULT_FRAME_SKIP
            );

            log.info("检测任务已启动，任务ID: {}, 通道: {}", task.getId(), channelIndex);

        } catch (Exception e) {
            task.setStatus(DetectionStatusEnum.FAILED.getCode());
            task.setErrorMsg(e.getMessage());
            detectionTaskDao.updateById(task);
            throw e;
        }

        return toResponse(task);
    }

    @Override
    public void stopDetection(Long taskId) {
        DetectionTask task = detectionTaskDao.selectById(taskId);
        AssertUtil.notNull(task, ResponseEnum.NOT_FOUND_ERROR);

        if (task.getChannelIndex() == null) {
            throw new BusinessException("该任务没有关联的通道");
        }

        detectionProcessManager.stopDetection(task.getChannelIndex());

        log.info("检测任务已停止，任务ID: {}", taskId);
    }

    @Override
    public void stopDetectionByChannel(Integer channelIndex) {
        if (channelIndex == null || channelIndex < 0 || channelIndex >= DetectionConstants.MAX_CHANNELS) {
            throw new BusinessException("无效的通道索引");
        }

        detectionProcessManager.stopDetection(channelIndex);

        log.info("通道检测任务已停止，通道: {}", channelIndex);
    }

    @Override
    public DetectionTaskResponse getChannelTask(Integer channelIndex) {
        if (channelIndex == null || channelIndex < 0 || channelIndex >= DetectionConstants.MAX_CHANNELS) {
            throw new BusinessException("无效的通道索引");
        }

        DetectionProcessManager.ProcessInfo processInfo = detectionProcessManager.getChannelProcessInfo(channelIndex);
        if (processInfo != null) {
            DetectionTask task = detectionTaskDao.selectById(processInfo.taskId);
            if (task != null) {
                return toResponse(task);
            }
        }

        DetectionTask task = lambdaQuery()
                .eq(DetectionTask::getChannelIndex, channelIndex)
                .in(DetectionTask::getStatus, DetectionStatusEnum.PENDING.getCode(), DetectionStatusEnum.PROCESSING.getCode())
                .orderByDesc(DetectionTask::getCreateTime)
                .last("LIMIT 1")
                .one();

        return task != null ? toResponse(task) : null;
    }

    @Override
    public List<DetectionTaskResponse> getActiveTasks() {
        List<DetectionTask> tasks = lambdaQuery()
                .in(DetectionTask::getStatus, DetectionStatusEnum.PENDING.getCode(), DetectionStatusEnum.PROCESSING.getCode())
                .orderByDesc(DetectionTask::getCreateTime)
                .list();

        return tasks.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    public void exportDetectionHistory(Long taskId, String exportType) {
        DetectionTask task = detectionTaskDao.selectById(taskId);
        AssertUtil.notNull(task, ResponseEnum.NOT_FOUND_ERROR);

        if (!DetectionConstants.EXPORT_TYPE_CSV.equals(exportType) &&
                !DetectionConstants.EXPORT_TYPE_JSON.equals(exportType)) {
            throw new BusinessException("不支持的导出类型: " + exportType);
        }

        List<DetectionResult> results = detectionResultDao.selectList(
                new LambdaQueryWrapper<DetectionResult>()
                        .eq(DetectionResult::getTaskId, taskId)
                        .orderByAsc(DetectionResult::getFrameIndex)
        );

        log.info("导出检测历史，任务ID: {}, 导出类型: {}, 结果数量: {}", taskId, exportType, results.size());
    }

    @Override
    public byte[] getExportFile(Long taskId) {
        DetectionTask task = detectionTaskDao.selectById(taskId);
        AssertUtil.notNull(task, ResponseEnum.NOT_FOUND_ERROR);

        List<DetectionResult> results = detectionResultDao.selectList(
                new LambdaQueryWrapper<DetectionResult>()
                        .eq(DetectionResult::getTaskId, taskId)
                        .orderByAsc(DetectionResult::getFrameIndex)
        );

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            OutputStreamWriter writer = new OutputStreamWriter(baos, StandardCharsets.UTF_8);

            writer.write("frame_index,frame_time,object_count,objects\n");

            for (DetectionResult result : results) {
                writer.write(String.format("%d,%d,%d,%s\n",
                        result.getFrameIndex(),
                        result.getFrameTime() != null ? result.getFrameTime() : 0,
                        result.getObjectCount() != null ? result.getObjectCount() : 0,
                        result.getObjects() != null ?
                                "\"" + result.getObjects().replace("\"", "\"\"") + "\"" : ""
                ));
            }

            writer.flush();
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("生成导出文件失败，任务ID: {}", taskId, e);
            throw new BusinessException("生成导出文件失败: " + e.getMessage());
        }
    }

    private DetectionTaskResponse toResponse(DetectionTask task) {
        DetectionTaskResponse response = new DetectionTaskResponse();
        BeanUtils.copyProperties(task, response);
        return response;
    }
}
