package com.slack.slackjarservice.foundation.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.alibaba.fastjson2.JSON;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.slack.slackjarservice.common.constant.DetectionConstants;
import com.slack.slackjarservice.common.enumtype.detection.ModelStatusEnum;
import com.slack.slackjarservice.common.enumtype.foundation.ResponseEnum;
import com.slack.slackjarservice.common.exception.BusinessException;
import com.slack.slackjarservice.common.util.AssertUtil;
import com.slack.slackjarservice.common.util.StringUtil;
import com.slack.slackjarservice.foundation.dao.DetectionModelDao;
import com.slack.slackjarservice.foundation.entity.DetectionModel;
import com.slack.slackjarservice.foundation.model.request.DetectionModelPageQuery;
import com.slack.slackjarservice.foundation.model.response.DetectionModelResponse;
import com.slack.slackjarservice.foundation.service.DetectionModelService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DetectionModelServiceImpl extends ServiceImpl<DetectionModelDao, DetectionModel>
        implements DetectionModelService {

    @Resource
    private DetectionModelDao detectionModelDao;

    @Override
    public Page<DetectionModelResponse> pageQuery(DetectionModelPageQuery query) {
        Page<DetectionModel> page = new Page<>(query.getPageNo(), query.getPageSize());

        LambdaQueryWrapper<DetectionModel> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(query.getModelName())) {
            wrapper.like(DetectionModel::getModelName, query.getModelName());
        }
        if (StringUtils.hasText(query.getModelCode())) {
            wrapper.eq(DetectionModel::getModelCode, query.getModelCode());
        }
        if (StringUtils.hasText(query.getModelType())) {
            wrapper.eq(DetectionModel::getModelType, query.getModelType());
        }
        if (query.getStatus() != null) {
            wrapper.eq(DetectionModel::getStatus, query.getStatus());
        }

        wrapper.orderByDesc(DetectionModel::getCreateTime);

        Page<DetectionModel> resultPage = detectionModelDao.selectPage(page, wrapper);

        Page<DetectionModelResponse> responsePage = new Page<>();
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
    public DetectionModelResponse getDetail(Long id) {
        DetectionModel model = detectionModelDao.selectById(id);
        AssertUtil.notNull(model, ResponseEnum.NOT_FOUND_ERROR);
        return toResponse(model);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DetectionModelResponse createModel(String modelName, String modelCode, String modelType,
                                                String description, MultipartFile modelFile,
                                                String classNames, Integer inputSize,
                                                BigDecimal defaultConfThreshold,
                                                BigDecimal defaultIouThreshold,
                                                Integer maxDet) {

        Long count = lambdaQuery().eq(DetectionModel::getModelCode, modelCode).count();
        if (count > 0) {
            throw new BusinessException(ResponseEnum.DATA_EXISTS.getCode(), "模型编码已存在");
        }

        String modelPath = saveModelFile(modelCode, modelFile);

        DetectionModel model = new DetectionModel();
        model.setModelName(modelName);
        model.setModelCode(modelCode);
        model.setModelType(modelType);
        model.setModelPath(modelPath);
        model.setModelSize(modelFile.getSize());
        model.setClassNames(classNames);
        model.setInputSize(inputSize != null ? inputSize : 640);
        model.setDescription(description);
        model.setStatus(ModelStatusEnum.ENABLED.getCode());
        model.setIsDefault(0);
        model.setDefaultConfThreshold(defaultConfThreshold != null ?
                defaultConfThreshold : BigDecimal.valueOf(DetectionConstants.DEFAULT_CONF_THRESHOLD));
        model.setDefaultIouThreshold(defaultIouThreshold != null ?
                defaultIouThreshold : BigDecimal.valueOf(DetectionConstants.DEFAULT_IOU_THRESHOLD));
        model.setMaxDet(maxDet != null ? maxDet : DetectionConstants.DEFAULT_MAX_DET);

        detectionModelDao.insert(model);

        log.info("模型创建成功，模型名称: {}, 模型编码: {}", modelName, modelCode);

        return toResponse(model);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DetectionModelResponse updateModel(Long id, String modelName, String description,
                                                BigDecimal defaultConfThreshold,
                                                BigDecimal defaultIouThreshold,
                                                Integer maxDet, Integer status) {

        DetectionModel model = detectionModelDao.selectById(id);
        AssertUtil.notNull(model, ResponseEnum.NOT_FOUND_ERROR);

        if (StringUtils.hasText(modelName)) {
            model.setModelName(modelName);
        }
        if (description != null) {
            model.setDescription(description);
        }
        if (defaultConfThreshold != null) {
            model.setDefaultConfThreshold(defaultConfThreshold);
        }
        if (defaultIouThreshold != null) {
            model.setDefaultIouThreshold(defaultIouThreshold);
        }
        if (maxDet != null) {
            model.setMaxDet(maxDet);
        }
        if (status != null) {
            model.setStatus(status);
        }

        detectionModelDao.updateById(model);

        log.info("模型更新成功，模型ID: {}", id);

        return toResponse(model);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteModel(Long id) {
        DetectionModel model = detectionModelDao.selectById(id);
        AssertUtil.notNull(model, ResponseEnum.NOT_FOUND_ERROR);

        if (model.getIsDefault() != null && model.getIsDefault() == 1) {
            throw new BusinessException("默认模型不能删除");
        }

        String modelPath = model.getModelPath();
        if (StringUtils.hasText(modelPath)) {
            try {
                Files.deleteIfExists(Paths.get(modelPath));
            } catch (IOException e) {
                log.warn("删除模型文件失败，路径: {}", modelPath, e);
            }
        }

        detectionModelDao.deleteById(id);

        log.info("模型删除成功，模型ID: {}", id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void setDefaultModel(Long id) {
        DetectionModel model = detectionModelDao.selectById(id);
        AssertUtil.notNull(model, ResponseEnum.NOT_FOUND_ERROR);

        if (ModelStatusEnum.DISABLED.getCode() == model.getStatus()) {
            throw new BusinessException("已禁用的模型不能设为默认");
        }

        lambdaUpdate().set(DetectionModel::getIsDefault, 0).update();

        lambdaUpdate().set(DetectionModel::getIsDefault, 1).eq(DetectionModel::getId, id).update();

        log.info("设置默认模型成功，模型ID: {}", id);
    }

    @Override
    public List<DetectionModelResponse> listEnabledModels() {
        List<DetectionModel> models = lambdaQuery()
                .eq(DetectionModel::getStatus, ModelStatusEnum.ENABLED.getCode())
                .orderByDesc(DetectionModel::getIsDefault)
                .orderByDesc(DetectionModel::getCreateTime)
                .list();

        return models.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    public DetectionModel getDefaultModel() {
        return lambdaQuery()
                .eq(DetectionModel::getIsDefault, 1)
                .eq(DetectionModel::getStatus, ModelStatusEnum.ENABLED.getCode())
                .one();
    }

    private String saveModelFile(String modelCode, MultipartFile file) {
        String baseDir = System.getProperty("user.dir") + File.separator + DetectionConstants.MODEL_DIR;
        Path basePath = Paths.get(baseDir);

        try {
            if (!Files.exists(basePath)) {
                Files.createDirectories(basePath);
            }

            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }

            String fileName = modelCode + "_" + System.currentTimeMillis() + extension;
            Path filePath = basePath.resolve(fileName);

            Files.copy(file.getInputStream(), filePath);

            log.info("模型文件保存成功，路径: {}", filePath.toAbsolutePath());

            return filePath.toAbsolutePath().toString();

        } catch (IOException e) {
            log.error("保存模型文件失败", e);
            throw new BusinessException("保存模型文件失败: " + e.getMessage());
        }
    }

    private DetectionModelResponse toResponse(DetectionModel model) {
        DetectionModelResponse response = new DetectionModelResponse();
        BeanUtils.copyProperties(model, response);
        return response;
    }
}
