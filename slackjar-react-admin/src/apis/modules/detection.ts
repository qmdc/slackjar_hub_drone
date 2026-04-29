import request from '../request'
import type {PageResult, ResponseData} from './types'

export function getModelPage(query: DetectionModelPageQuery): Promise<ResponseData<PageResult<DetectionModel>>> {
    return request.get('/detection-model/page', {params: query})
}

export function getModelDetail(id: number): Promise<ResponseData<DetectionModel>> {
    return request.get(`/detection-model/${id}`)
}

export function listEnabledModels(): Promise<ResponseData<DetectionModel[]>> {
    return request.get('/detection-model/list-enabled')
}

export function createModel(formData: FormData): Promise<ResponseData<DetectionModel>> {
    return request.post('/detection-model/create', formData, {
        headers: {'Content-Type': 'multipart/form-data'}
    })
}

export function updateModel(id: number, data: Partial<DetectionModel>): Promise<ResponseData<DetectionModel>> {
    return request.put(`/detection-model/${id}`, null, {params: data})
}

export function deleteModel(id: number): Promise<ResponseData<void>> {
    return request.delete(`/detection-model/${id}`)
}

export function setDefaultModel(id: number): Promise<ResponseData<void>> {
    return request.post(`/detection-model/${id}/set-default`)
}

export function getTaskPage(query: DetectionTaskPageQuery): Promise<ResponseData<PageResult<DetectionTask>>> {
    return request.get('/detection/task/page', {params: query})
}

export function getTaskDetail(taskId: number): Promise<ResponseData<DetectionTask>> {
    return request.get(`/detection/task/${taskId}`)
}

export function getActiveTasks(): Promise<ResponseData<DetectionTask[]>> {
    return request.get('/detection/task/active')
}

export function getChannelTask(channelIndex: number): Promise<ResponseData<DetectionTask | null>> {
    return request.get(`/detection/task/channel/${channelIndex}`)
}

export function startDetection(data: DetectionStartRequest): Promise<ResponseData<DetectionTask>> {
    return request.post('/detection/start', data)
}

export function stopDetection(taskId: number): Promise<ResponseData<void>> {
    return request.post(`/detection/stop/${taskId}`)
}

export function stopDetectionByChannel(channelIndex: number): Promise<ResponseData<void>> {
    return request.post(`/detection/stop-channel/${channelIndex}`)
}

export function exportDetectionHistory(taskId: number, type?: string): Promise<Blob> {
    return request.get(`/detection/export/${taskId}`, {
        params: {type},
        responseType: 'blob'
    })
}

export function getOverviewMetrics(): Promise<ResponseData<OverviewMetrics>> {
    return request.get('/detection-metrics/overview')
}

export function getTaskMetrics(taskId: number): Promise<ResponseData<TaskMetrics>> {
    return request.get(`/detection-metrics/task/${taskId}`)
}

export function getChannelStatus(): Promise<ResponseData<ChannelStatus[]>> {
    return request.get('/detection-metrics/channel-status')
}

export function getRecentTasks(limit?: number): Promise<ResponseData<DetectionTask[]>> {
    return request.get('/detection-metrics/recent-tasks', {params: {limit}})
}

// ============================================
// 类型定义
// ============================================

export interface DetectionModel {
    id: number
    modelName: string
    modelCode: string
    modelType: string
    modelPath: string
    modelSize: number
    classNames: string
    inputSize: number
    description: string
    status: number
    isDefault: number
    defaultConfThreshold: number
    defaultIouThreshold: number
    maxDet: number
    createTime: number
    updateTime: number
}

export interface DetectionModelPageQuery {
    pageNo?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: string
    modelName?: string
    modelCode?: string
    modelType?: string
    status?: number
}

export interface DetectionTask {
    id: number
    taskCode: string
    taskName: string
    videoFileId: number
    videoUrl: string
    modelId: number
    modelName: string
    confThreshold: number
    iouThreshold: number
    status: number
    frameCount: number
    processedFrames: number
    totalObjects: number
    startTime: number
    endTime: number
    errorMsg: string
    userId: number
    channelIndex: number
    summaryData: string
    createTime: number
    updateTime: number
}

export interface DetectionTaskPageQuery {
    pageNo?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: string
    taskName?: string
    status?: number
    modelId?: number
    userId?: number
    channelIndexes?: number[]
    startTime?: number
    endTime?: number
}

export interface DetectionStartRequest {
    channelIndex: number
    modelId?: number
    videoUrl: string
    taskName?: string
    confThreshold?: number
    iouThreshold?: number
    enableTracking?: boolean
    frameSkip?: number
}

export interface DetectionObject {
    trackId?: number
    className: string
    confidence: number
    x: number
    y: number
    width: number
    height: number
}

export interface FrameDetectionResult {
    taskId: number
    channelIndex: number
    frameIndex: number
    frameTime: number
    objects: DetectionObject[]
    objectCount: number
}

export interface DetectionSummary {
    processedFrames: number
    totalObjects: number
    classCounts: Record<string, number>
    confidenceDistribution: number[]
    avgConfidence: number
    fps: number
}

export interface OverviewMetrics {
    totalTasks: number
    completedTasks: number
    activeTasks: number
    failedTasks: number
    totalResults: number
    channels: number
}

export interface TaskMetrics {
    taskId: number
    taskName: string
    status: number
    frameCount: number
    processedFrames: number
    totalObjects: number
    summary?: DetectionSummary
    classDistribution?: Record<string, number>
    confidenceDistribution?: Record<string, number>
    avgConfidence?: number
}

export interface ChannelStatus {
    channelIndex: number
    status: 'idle' | 'active'
    taskId?: number
    taskName?: string
    modelName?: string
    processedFrames?: number
    totalObjects?: number
}
