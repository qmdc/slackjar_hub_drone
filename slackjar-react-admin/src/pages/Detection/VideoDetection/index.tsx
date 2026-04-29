import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Button, Card, Divider, Form, InputNumber, message, Modal, Select, Space, Switch, Tag, Upload} from 'antd';
import {
    PlayCircleOutlined,
    PauseCircleOutlined,
    UploadOutlined,
    VideoCameraOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import type {
    ChannelStatus,
    DetectionModel,
    DetectionObject,
    DetectionStartRequest,
    DetectionTask,
    FrameDetectionResult,
} from '../../../apis';
import {
    getChannelStatus,
    listEnabledModels,
    startDetection,
    stopDetectionByChannel,
    uploadFile,
} from '../../../apis';
import {socketManager} from '../../../socketio';
import styles from './index.module.scss';
import globalStyles from '../../global.module.scss';

const {Option} = Select;

interface ChannelState {
    channelIndex: number;
    isActive: boolean;
    taskId: number | null;
    videoUrl: string | null;
    modelId: number | null;
    modelName: string | null;
    confThreshold: number;
    iouThreshold: number;
    frameSkip: number;
    enableTracking: boolean;
    videoFile: File | null;
    videoLoaded: boolean;
    detectionResults: FrameDetectionResult[];
    stats: {
        totalObjects: number;
        processedFrames: number;
        fps: number;
        classCounts: Record<string, number>;
    };
}

const initialChannelState = (index: number): ChannelState => ({
    channelIndex: index,
    isActive: false,
    taskId: null,
    videoUrl: null,
    modelId: null,
    modelName: null,
    confThreshold: 0.25,
    iouThreshold: 0.7,
    frameSkip: 1,
    enableTracking: true,
    videoFile: null,
    videoLoaded: false,
    detectionResults: [],
    stats: {
        totalObjects: 0,
        processedFrames: 0,
        fps: 0,
        classCounts: {},
    },
});

const VideoDetection: React.FC = () => {
    const [models, setModels] = useState<DetectionModel[]>([]);
    const [channels, setChannels] = useState<ChannelState[]>([
        initialChannelState(0),
        initialChannelState(1),
        initialChannelState(2),
        initialChannelState(3),
    ]);
    const [globalChannelStatus, setGlobalChannelStatus] = useState<ChannelStatus[]>([]);

    const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null, null]);
    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null]);
    const uploadRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

    useEffect(() => {
        loadModels();
        loadChannelStatus();
    }, []);

    useEffect(() => {
        const socket = socketManager.getSocket();
        if (!socket) {
            return;
        }

        socket.on('DETECTION_FRAME_RESULT', (data: any) => {
            const channelIndex = data.channelIndex;
            if (channelIndex >= 0 && channelIndex < 4) {
                handleFrameResult(channelIndex, data);
            }
        });

        socket.on('DETECTION_TASK_PROGRESS', (data: any) => {
            const channelIndex = data.channelIndex;
            if (channelIndex >= 0 && channelIndex < 4) {
                handleTaskProgress(channelIndex, data);
            }
        });

        socket.on('DETECTION_TASK_START', (data: any) => {
            const channelIndex = data.channelIndex;
            if (channelIndex >= 0 && channelIndex < 4) {
                setChannels(prev => {
                    const newChannels = [...prev];
                    newChannels[channelIndex] = {
                        ...newChannels[channelIndex],
                        isActive: true,
                        taskId: data.taskId,
                    };
                    return newChannels;
                });
            }
        });

        socket.on('DETECTION_TASK_COMPLETED', (data: any) => {
            const channelIndex = data.channelIndex;
            if (channelIndex >= 0 && channelIndex < 4) {
                setChannels(prev => {
                    const newChannels = [...prev];
                    newChannels[channelIndex] = {
                        ...newChannels[channelIndex],
                        isActive: false,
                    };
                    return newChannels;
                });
                message.info(`通道 ${channelIndex + 1} 检测完成`);
            }
        });

        socket.on('DETECTION_TASK_STOPPED', (data: any) => {
            const channelIndex = data.channelIndex;
            if (channelIndex >= 0 && channelIndex < 4) {
                setChannels(prev => {
                    const newChannels = [...prev];
                    newChannels[channelIndex] = {
                        ...newChannels[channelIndex],
                        isActive: false,
                    };
                    return newChannels;
                });
                message.info(`通道 ${channelIndex + 1} 检测已停止`);
            }
        });

        socket.on('DETECTION_TASK_ERROR', (data: any) => {
            const channelIndex = data.channelIndex;
            if (channelIndex >= 0 && channelIndex < 4) {
                setChannels(prev => {
                    const newChannels = [...prev];
                    newChannels[channelIndex] = {
                        ...newChannels[channelIndex],
                        isActive: false,
                    };
                    return newChannels;
                });
                message.error(`通道 ${channelIndex + 1} 检测出错: ${data.error}`);
            }
        });

        return () => {
            socket.off('DETECTION_FRAME_RESULT');
            socket.off('DETECTION_TASK_PROGRESS');
            socket.off('DETECTION_TASK_START');
            socket.off('DETECTION_TASK_COMPLETED');
            socket.off('DETECTION_TASK_STOPPED');
            socket.off('DETECTION_TASK_ERROR');
        };
    }, []);

    const loadModels = () => {
        listEnabledModels()
            .then((res) => {
                if (res.code === 200 && res.data) {
                    setModels(res.data);
                }
            })
            .catch((err) => {
                message.error('加载模型列表失败: ' + (err.message || '未知错误'));
            });
    };

    const loadChannelStatus = () => {
        getChannelStatus()
            .then((res) => {
                if (res.code === 200 && res.data) {
                    setGlobalChannelStatus(res.data);
                }
            })
            .catch(() => {
            });
    };

    const handleFrameResult = useCallback((channelIndex: number, data: any) => {
        setChannels(prev => {
            const newChannels = [...prev];
            const channel = {...newChannels[channelIndex]};

            const result: FrameDetectionResult = {
                taskId: data.taskId,
                channelIndex: data.channelIndex,
                frameIndex: data.frameIndex,
                frameTime: data.frameTime,
                objects: data.objects || [],
                objectCount: data.objectCount || 0,
            };

            channel.detectionResults = [...channel.detectionResults.slice(-100), result];
            channel.stats.totalObjects += result.objectCount;
            channel.stats.processedFrames += 1;

            result.objects.forEach((obj: DetectionObject) => {
                const className = obj.className || 'unknown';
                channel.stats.classCounts[className] = (channel.stats.classCounts[className] || 0) + 1;
            });

            newChannels[channelIndex] = channel;
            return newChannels;
        });

        drawDetections(channelIndex, data.objects || []);
    }, []);

    const handleTaskProgress = useCallback((channelIndex: number, data: any) => {
        setChannels(prev => {
            const newChannels = [...prev];
            newChannels[channelIndex] = {
                ...newChannels[channelIndex],
                stats: {
                    ...newChannels[channelIndex].stats,
                    fps: data.fps || 0,
                },
            };
            return newChannels;
        });
    }, []);

    const drawDetections = useCallback((channelIndex: number, objects: DetectionObject[]) => {
        const canvas = canvasRefs.current[channelIndex];
        const video = videoRefs.current[channelIndex];

        if (!canvas || !video || video.videoWidth === 0) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        objects.forEach((obj) => {
            const x = obj.x * scaleX;
            const y = obj.y * scaleY;
            const width = obj.width * scaleX;
            const height = obj.height * scaleY;

            const className = (obj.className || 'unknown').toLowerCase();
            const colorMap: Record<string, string> = {
                person: '#1890ff',
                car: '#52c41a',
                truck: '#722ed1',
                bus: '#eb2f96',
                motorcycle: '#fa8c16',
                bicycle: '#13c2c2',
                uav: '#ff4d4f',
                awning: '#8c8c8c',
                'awning-tricycle': '#8c8c8c',
                tricycle: '#8c8c8c',
                'motor-D': '#8c8c8c',
                'motor-T': '#8c8c8c',
            };

            const color = colorMap[className] || '#8c8c8c';

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            ctx.fillStyle = color;
            const label = obj.trackId
                ? `${obj.className} #${obj.trackId} ${(obj.confidence * 100).toFixed(0)}%`
                : `${obj.className} ${(obj.confidence * 100).toFixed(0)}%`;
            const labelWidth = ctx.measureText(label).width + 8;
            ctx.fillRect(x, y - 18, labelWidth, 18);

            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.fillText(label, x + 4, y - 5);
        });
    }, []);

    const handleModelChange = (channelIndex: number, modelId: number) => {
        const model = models.find(m => m.id === modelId);
        setChannels(prev => {
            const newChannels = [...prev];
            newChannels[channelIndex] = {
                ...newChannels[channelIndex],
                modelId: modelId,
                modelName: model?.modelName || null,
                confThreshold: model?.defaultConfThreshold || 0.25,
                iouThreshold: model?.defaultIouThreshold || 0.7,
            };
            return newChannels;
        });
    };

    const handleVideoUpload = async (channelIndex: number, file: File) => {
        try {
            const res = await uploadFile(file, 'video');
            if (res.code === 200 && res.data) {
                setChannels(prev => {
                    const newChannels = [...prev];
                    newChannels[channelIndex] = {
                        ...newChannels[channelIndex],
                        videoUrl: res.data!.fileUrl,
                        videoFile: file,
                        videoLoaded: false,
                    };
                    return newChannels;
                });
                message.success('视频上传成功');
            }
        } catch (err: any) {
            message.error('视频上传失败: ' + (err.message || '未知错误'));
        }
    };

    const handlePlaceholderClick = (channelIndex: number) => {
        if (uploadRefs.current[channelIndex]) {
            uploadRefs.current[channelIndex]!.click();
        }
    };

    const handleFileSelect = (channelIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            handleVideoUpload(channelIndex, files[0]);
        }
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleVideoLoaded = (channelIndex: number) => {
        setChannels(prev => {
            const newChannels = [...prev];
            newChannels[channelIndex] = {
                ...newChannels[channelIndex],
                videoLoaded: true,
            };
            return newChannels;
        });
    };

    const handleStartDetection = async (channelIndex: number) => {
        const channel = channels[channelIndex];

        if (!channel.videoUrl) {
            message.warning('请先上传视频');
            return;
        }

        if (!channel.modelId) {
            message.warning('请选择检测模型');
            return;
        }

        const request: DetectionStartRequest = {
            channelIndex: channelIndex,
            modelId: channel.modelId,
            videoUrl: channel.videoUrl,
            confThreshold: channel.confThreshold,
            iouThreshold: channel.iouThreshold,
            enableTracking: channel.enableTracking,
            frameSkip: channel.frameSkip,
        };

        try {
            const res = await startDetection(request);
            if (res.code === 200 && res.data) {
                setChannels(prev => {
                    const newChannels = [...prev];
                    newChannels[channelIndex] = {
                        ...newChannels[channelIndex],
                        isActive: true,
                        taskId: res.data!.id,
                        detectionResults: [],
                        stats: {
                            totalObjects: 0,
                            processedFrames: 0,
                            fps: 0,
                            classCounts: {},
                        },
                    };
                    return newChannels;
                });

                const video = videoRefs.current[channelIndex];
                if (video) {
                    video.play().catch(() => {});
                }

                message.success(`通道 ${channelIndex + 1} 检测已启动`);
            }
        } catch (err: any) {
            message.error('启动检测失败: ' + (err.message || '未知错误'));
        }
    };

    const handleStopDetection = async (channelIndex: number) => {
        try {
            await stopDetectionByChannel(channelIndex);
        } catch (err: any) {
            message.error('停止检测失败: ' + (err.message || '未知错误'));
        }
    };

    const handleParamChange = (channelIndex: number, field: string, value: number | boolean) => {
        setChannels(prev => {
            const newChannels = [...prev];
            newChannels[channelIndex] = {
                ...newChannels[channelIndex],
                [field]: value,
            };
            return newChannels;
        });
    };

    const getObjectClass = (className: string): string => {
        const normalized = (className || '').toLowerCase();
        const classMap: Record<string, string> = {
            person: 'person',
            car: 'car',
            truck: 'truck',
            bus: 'bus',
            motorcycle: 'motorcycle',
            bicycle: 'bicycle',
            uav: 'uav',
        };
        return classMap[normalized] || 'default';
    };

    const renderChannelCard = (channel: ChannelState) => {
        const channelIndex = channel.channelIndex;

        return (
            <Card
                key={channelIndex}
                className={styles.channelCard}
                title={
                    <div className={styles.cardHeader}>
                        <div className={styles.channelTitle}>
                            <span
                                className={`${styles.channelStatus} ${channel.isActive ? styles.active : ''}`}
                            />
                            通道 {channelIndex + 1}
                            {channel.isActive && (
                                <Tag color="success" style={{marginLeft: 8}}>检测中</Tag>
                            )}
                        </div>
                    </div>
                }
            >
                <input
                    ref={(el) => (uploadRefs.current[channelIndex] = el)}
                    type="file"
                    accept="video/*"
                    style={{display: 'none'}}
                    onChange={(e) => handleFileSelect(channelIndex, e)}
                />
                <div className={styles.cardBody}>
                    <div className={styles.videoContainer}>
                        {!channel.videoUrl ? (
                            <div
                                className={`${styles.videoPlaceholder} ${!channel.isActive ? styles.clickable : ''}`}
                                onClick={() => !channel.isActive && handlePlaceholderClick(channelIndex)}
                            >
                                <VideoCameraOutlined className={styles.placeholderIcon}/>
                                <div className={styles.placeholderText}>点击上传视频文件</div>
                                {!channel.isActive && (
                                    <div className={styles.placeholderHint}>或点击下方上传按钮</div>
                                )}
                            </div>
                        ) : (
                            <>
                                <video
                                    ref={(el) => (videoRefs.current[channelIndex] = el)}
                                    className={styles.videoElement}
                                    src={channel.videoUrl}
                                    controls={!channel.isActive}
                                    muted
                                    playsInline
                                    onLoadedData={() => handleVideoLoaded(channelIndex)}
                                />
                                <canvas
                                    ref={(el) => (canvasRefs.current[channelIndex] = el)}
                                    className={styles.canvasOverlay}
                                />
                                {channel.isActive && (
                                    <div className={styles.statsOverlay}>
                                        <div className={styles.statRow}>
                                            帧: {channel.stats.processedFrames}
                                        </div>
                                        <div className={styles.statRow}>
                                            目标: {channel.stats.totalObjects}
                                        </div>
                                        <div className={styles.statRow}>
                                            FPS: {channel.stats.fps}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className={styles.controlPanel}>
                        <div className={styles.row}>
                            <Select
                                className={styles.modelSelect}
                                placeholder="选择模型"
                                value={channel.modelId}
                                onChange={(val) => handleModelChange(channelIndex, val)}
                                disabled={channel.isActive}
                            >
                                {models.map((model) => (
                                    <Option key={model.id} value={model.id}>
                                        {model.modelName}
                                        {model.isDefault === 1 && ' (默认)'}
                                    </Option>
                                ))}
                            </Select>
                        </div>

                        <div className={styles.row}>
                            <span className={styles.paramLabel}>置信度:</span>
                            <InputNumber
                                className={styles.paramInput}
                                min={0}
                                max={1}
                                step={0.05}
                                value={channel.confThreshold}
                                onChange={(val) => handleParamChange(channelIndex, 'confThreshold', val as number)}
                                disabled={channel.isActive}
                            />
                            <span className={styles.paramLabel}>IOU:</span>
                            <InputNumber
                                className={styles.paramInput}
                                min={0}
                                max={1}
                                step={0.05}
                                value={channel.iouThreshold}
                                onChange={(val) => handleParamChange(channelIndex, 'iouThreshold', val as number)}
                                disabled={channel.isActive}
                            />
                            <span className={styles.paramLabel}>跳帧:</span>
                            <InputNumber
                                className={styles.paramInput}
                                min={1}
                                max={10}
                                step={1}
                                value={channel.frameSkip}
                                onChange={(val) => handleParamChange(channelIndex, 'frameSkip', val as number)}
                                disabled={channel.isActive}
                            />
                            <span className={styles.paramLabel}>跟踪:</span>
                            <Switch
                                checked={channel.enableTracking}
                                onChange={(val) => handleParamChange(channelIndex, 'enableTracking', val)}
                                disabled={channel.isActive}
                            />
                        </div>

                        <div className={styles.actionRow}>
                            <Upload
                                beforeUpload={(file) => {
                                    handleVideoUpload(channelIndex, file);
                                    return false;
                                }}
                                accept="video/*"
                                disabled={channel.isActive}
                            >
                                <Button
                                    className={styles.uploadBtn}
                                    icon={<UploadOutlined/>}
                                    disabled={channel.isActive}
                                >
                                    上传视频
                                </Button>
                            </Upload>

                            {!channel.isActive ? (
                                <Button
                                    className={styles.startBtn}
                                    type="primary"
                                    icon={<PlayCircleOutlined/>}
                                    onClick={() => handleStartDetection(channelIndex)}
                                    disabled={!channel.videoUrl || !channel.modelId}
                                >
                                    开始检测
                                </Button>
                            ) : (
                                <Button
                                    className={styles.startBtn}
                                    danger
                                    icon={<PauseCircleOutlined/>}
                                    onClick={() => handleStopDetection(channelIndex)}
                                >
                                    停止检测
                                </Button>
                            )}
                        </div>

                        {Object.keys(channel.stats.classCounts).length > 0 && (
                            <>
                                <Divider style={{margin: '8px 0'}}/>
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12}}>
                                    <span style={{color: '#666'}}>检测统计:</span>
                                    {Object.entries(channel.stats.classCounts).map(([className, count]) => (
                                        <Tag key={className} size="small">
                                            {className}: {count}
                                        </Tag>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </Card>
        );
    };

    return (
        <div className={`${globalStyles.pageContainer} ${styles.videoDetectionPage}`}>
            <div className={styles.controlBar}>
                <div className={styles.channelStatus}>
                    {channels.map((channel, index) => (
                        <div
                            key={index}
                            className={`${styles.statusTag} ${channel.isActive ? styles.active : styles.idle}`}
                        >
                            <span
                                className={`${styles.statusDot} ${channel.isActive ? styles.active : ''}`}
                            />
                            通道 {index + 1}: {channel.isActive ? '检测中' : '空闲'}
                        </div>
                    ))}
                </div>
                <div className={styles.globalActions}>
                    <Button icon={<ReloadOutlined/>} onClick={loadModels}>
                        刷新模型
                    </Button>
                </div>
            </div>

            <div className={styles.gridContainer}>
                {channels.map((channel) => renderChannelCard(channel))}
            </div>
        </div>
    );
};

export default VideoDetection;
