package com.slack.slackjarservice.foundation.dao;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.slack.slackjarservice.foundation.entity.DetectionResult;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface DetectionResultDao extends BaseMapper<DetectionResult> {
}
