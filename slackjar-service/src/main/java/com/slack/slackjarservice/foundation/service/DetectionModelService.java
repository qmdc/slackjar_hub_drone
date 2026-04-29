package com.slack.slackjarservice.foundation.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.slack.slackjarservice.foundation.entity.DetectionModel;
import com.slack.slackjarservice.foundation.model.request.DetectionModelPageQuery;
import com.slack.slackjarservice.foundation.model.response.DetectionModelResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface DetectionModelService extends IService<DetectionModel> {

    Page<DetectionModelResponse> pageQuery(DetectionModelPageQuery query);

    DetectionModelResponse getDetail(Long id);

    DetectionModelResponse createModel(String modelName, String modelCode, String modelType,
                                        String description, MultipartFile modelFile,
                                        String classNames, Integer inputSize,
                                        java.math.BigDecimal defaultConfThreshold,
                                        java.math.BigDecimal defaultIouThreshold,
                                        Integer maxDet);

    DetectionModelResponse updateModel(Long id, String modelName, String description,
                                        java.math.BigDecimal defaultConfThreshold,
                                        java.math.BigDecimal defaultIouThreshold,
                                        Integer maxDet, Integer status);

    void deleteModel(Long id);

    void setDefaultModel(Long id);

    List<DetectionModelResponse> listEnabledModels();

    DetectionModel getDefaultModel();
}
