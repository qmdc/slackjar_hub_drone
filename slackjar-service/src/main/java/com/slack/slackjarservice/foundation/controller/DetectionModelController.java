package com.slack.slackjarservice.foundation.controller;

import cn.dev33.satoken.annotation.SaCheckLogin;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.slack.slackjarservice.common.base.BaseController;
import com.slack.slackjarservice.common.response.ApiResponse;
import com.slack.slackjarservice.common.response.PageResult;
import com.slack.slackjarservice.foundation.model.request.DetectionModelPageQuery;
import com.slack.slackjarservice.foundation.model.response.DetectionModelResponse;
import com.slack.slackjarservice.foundation.service.DetectionModelService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/detection-model")
@Validated
public class DetectionModelController extends BaseController {

    @Resource
    private DetectionModelService detectionModelService;

    @GetMapping("/page")
    @SaCheckLogin
    public ApiResponse<PageResult<DetectionModelResponse>> pageQuery(@Valid DetectionModelPageQuery query) {
        Page<DetectionModelResponse> page = detectionModelService.pageQuery(query);
        return success(PageResult.of(page));
    }

    @GetMapping("/{id}")
    @SaCheckLogin
    public ApiResponse<DetectionModelResponse> getDetail(@PathVariable("id") Long id) {
        DetectionModelResponse response = detectionModelService.getDetail(id);
        return success(response);
    }

    @GetMapping("/list-enabled")
    @SaCheckLogin
    public ApiResponse<List<DetectionModelResponse>> listEnabledModels() {
        List<DetectionModelResponse> models = detectionModelService.listEnabledModels();
        return success(models);
    }

    @PostMapping(value = "/create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @SaCheckLogin
    public ApiResponse<DetectionModelResponse> createModel(
            @RequestParam("modelName") String modelName,
            @RequestParam("modelCode") String modelCode,
            @RequestParam(value = "modelType", required = false, defaultValue = "yolov8") String modelType,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam("modelFile") MultipartFile modelFile,
            @RequestParam(value = "classNames", required = false) String classNames,
            @RequestParam(value = "inputSize", required = false) Integer inputSize,
            @RequestParam(value = "defaultConfThreshold", required = false) BigDecimal defaultConfThreshold,
            @RequestParam(value = "defaultIouThreshold", required = false) BigDecimal defaultIouThreshold,
            @RequestParam(value = "maxDet", required = false) Integer maxDet) {

        DetectionModelResponse response = detectionModelService.createModel(
                modelName, modelCode, modelType, description, modelFile,
                classNames, inputSize, defaultConfThreshold, defaultIouThreshold, maxDet);

        return success(response);
    }

    @PutMapping("/{id}")
    @SaCheckLogin
    public ApiResponse<DetectionModelResponse> updateModel(
            @PathVariable("id") Long id,
            @RequestParam(value = "modelName", required = false) String modelName,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "defaultConfThreshold", required = false) BigDecimal defaultConfThreshold,
            @RequestParam(value = "defaultIouThreshold", required = false) BigDecimal defaultIouThreshold,
            @RequestParam(value = "maxDet", required = false) Integer maxDet,
            @RequestParam(value = "status", required = false) Integer status) {

        DetectionModelResponse response = detectionModelService.updateModel(
                id, modelName, description, defaultConfThreshold, defaultIouThreshold, maxDet, status);

        return success(response);
    }

    @DeleteMapping("/{id}")
    @SaCheckLogin
    public ApiResponse<Void> deleteModel(@PathVariable("id") Long id) {
        detectionModelService.deleteModel(id);
        return success();
    }

    @PostMapping("/{id}/set-default")
    @SaCheckLogin
    public ApiResponse<Void> setDefaultModel(@PathVariable("id") Long id) {
        detectionModelService.setDefaultModel(id);
        return success();
    }
}
