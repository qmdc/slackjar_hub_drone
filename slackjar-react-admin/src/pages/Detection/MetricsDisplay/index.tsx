import React, {useCallback, useEffect, useState} from 'react';
import {
    Button,
    Card,
    Descriptions,
    message,
    Space,
    Table,
    Tag,
} from 'antd';
import {
    BarChartOutlined,
    DashboardOutlined,
    HistoryOutlined,
    LoadingOutlined,
    PlayCircleOutlined,
    PlaySquareOutlined,
    ReloadOutlined,
    VideoCameraOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type {ChannelStatus, DetectionTask, OverviewMetrics} from '../../../apis';
import {
    getChannelStatus,
    getOverviewMetrics,
    getRecentTasks,
} from '../../../apis';
import styles from './index.module.scss';
import globalStyles from '../../global.module.scss';
import {useNavigate} from 'react-router';

const statusMap: Record<number, { text: string; color: string }> = {
    0: {text: '待处理', color: 'gold'},
    1: {text: '处理中', color: 'processing'},
    2: {text: '已完成', color: 'success'},
    3: {text: '失败', color: 'error'},
    4: {text: '已停止', color: 'default'},
};

const MetricsDisplay: React.FC = () => {
    const navigate = useNavigate();

    const [overview, setOverview] = useState<OverviewMetrics | null>(null);
    const [channelStatus, setChannelStatus] = useState<ChannelStatus[]>([]);
    const [recentTasks, setRecentTasks] = useState<DetectionTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [channelLoading, setChannelLoading] = useState(false);

    const loadOverview = useCallback(() => {
        setLoading(true);
        getOverviewMetrics()
            .then((res) => {
                if (res.code === 200 && res.data) {
                    setOverview(res.data);
                }
            })
            .catch((err) => {
                message.error('加载概览数据失败: ' + (err.message || '未知错误'));
            })
            .finally(() => setLoading(false));
    }, []);

    const loadChannelStatus = useCallback(() => {
        setChannelLoading(true);
        getChannelStatus()
            .then((res) => {
                if (res.code === 200 && res.data) {
                    setChannelStatus(res.data);
                }
            })
            .catch(() => {
            })
            .finally(() => setChannelLoading(false));
    }, []);

    const loadRecentTasks = useCallback(() => {
        getRecentTasks(10)
            .then((res) => {
                if (res.code === 200 && res.data) {
                    setRecentTasks(res.data);
                }
            })
            .catch(() => {
            });
    }, []);

    useEffect(() => {
        loadOverview();
        loadChannelStatus();
        loadRecentTasks();
    }, []);

    const handleRefresh = () => {
        loadOverview();
        loadChannelStatus();
        loadRecentTasks();
    };

    const handleChannelRefresh = () => {
        loadChannelStatus();
    };

    const handleViewHistory = () => {
        navigate('/detection/detection-history');
    };

    const handleViewVideoDetection = () => {
        navigate('/detection/video-detection');
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active':
                return '检测中';
            case 'idle':
                return '空闲';
            default:
                return status;
        }
    };

    const taskColumns = [
        {
            title: '任务名称',
            dataIndex: 'taskName',
            key: 'taskName',
            render: (text: string, record: DetectionTask) => (
                <Space direction="vertical" size={0}>
                    <span>{text}</span>
                    <span style={{fontSize: 12, color: '#999'}}>{record.taskCode}</span>
                </Space>
            ),
        },
        {
            title: '模型',
            dataIndex: 'modelName',
            key: 'modelName',
        },
        {
            title: '通道',
            dataIndex: 'channelIndex',
            key: 'channelIndex',
            render: (val: number) => (
                <Tag>通道 {val !== null && val !== undefined ? val + 1 : '-'}</Tag>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => {
                const info = statusMap[status] || {text: '未知', color: 'default'};
                return (
                    <Tag color={info.color}>{info.text}</Tag>
                );
            },
        },
        {
            title: '检测统计',
            key: 'stats',
            render: (_: any, record: DetectionTask) => (
                <Space direction="vertical" size={0}>
                    <span style={{fontSize: 12}}>帧数: {record.processedFrames || 0}</span>
                    <span style={{fontSize: 12, color: '#666'}}>目标: {record.totalObjects || 0}</span>
                </Space>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'createTime',
            key: 'createTime',
            render: (time: number) => time ? dayjs(time).format('MM-DD HH:mm') : '-',
        },
    ];

    return (
        <div className={`${globalStyles.pageContainer} ${styles.metricsDisplayPage}`}>
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>总检测任务</span>
                        <VideoCameraOutlined className={styles.statIcon}/>
                    </div>
                    <div className={styles.statValue}>
                        {loading ? <LoadingOutlined/> : overview?.totalTasks || 0}
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>已完成</span>
                        <BarChartOutlined className={styles.statIcon}/>
                    </div>
                    <div className={styles.statValue} style={{color: '#52c41a'}}>
                        {loading ? <LoadingOutlined/> : overview?.completedTasks || 0}
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>进行中</span>
                        <PlayCircleOutlined className={styles.statIcon}/>
                    </div>
                    <div className={styles.statValue} style={{color: '#1890ff'}}>
                        {loading ? <LoadingOutlined/> : overview?.activeTasks || 0}
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>失败任务</span>
                        <HistoryOutlined className={styles.statIcon}/>
                    </div>
                    <div className={styles.statValue} style={{color: '#ff4d4f'}}>
                        {loading ? <LoadingOutlined/> : overview?.failedTasks || 0}
                    </div>
                </div>
            </div>

            <div className={styles.channelStatusCard}>
                <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                        <DashboardOutlined style={{marginRight: 8}}/>
                        通道状态
                    </span>
                    <Space>
                        <span
                            className={styles.refreshButton}
                            onClick={handleChannelRefresh}
                        >
                            <ReloadOutlined style={{marginRight: 4}}/>
                            刷新
                        </span>
                        <Button
                            type="link"
                            size="small"
                            onClick={handleViewVideoDetection}
                        >
                            去视频检测
                        </Button>
                    </Space>
                </div>

                {channelLoading ? (
                    <div style={{textAlign: 'center', padding: 40, color: '#999'}}>
                        <LoadingOutlined style={{fontSize: 24}}/>
                    </div>
                ) : (
                    <div className={styles.channelList}>
                        {[0, 1, 2, 3].map((index) => {
                            const status = channelStatus.find(s => s.channelIndex === index);
                            const isActive = status?.status === 'active';

                            return (
                                <div
                                    key={index}
                                    className={`${styles.channelItem} ${isActive ? styles.active : styles.idle}`}
                                    onClick={handleViewVideoDetection}
                                    style={{cursor: 'pointer'}}
                                >
                                    <div className={styles.channelHeader}>
                                        <span className={styles.channelName}>通道 {index + 1}</span>
                                        <span
                                            className={`${styles.channelStatus} ${isActive ? styles.active : styles.idle}`}
                                        />
                                    </div>

                                    <div className={styles.channelInfo}>
                                        <div className={styles.infoRow}>
                                            <span className={styles.infoLabel}>状态</span>
                                            <Tag color={isActive ? 'success' : 'default'}>
                                                {getStatusText(status?.status || 'idle')}
                                            </Tag>
                                        </div>

                                        {status?.taskName && (
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>任务</span>
                                                <span>{status.taskName}</span>
                                            </div>
                                        )}

                                        {status?.modelName && (
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>模型</span>
                                                <span>{status.modelName}</span>
                                            </div>
                                        )}

                                        {(status?.processedFrames !== undefined && status.processedFrames > 0) && (
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>已处理</span>
                                                <span>{status.processedFrames} 帧</span>
                                            </div>
                                        )}

                                        {(status?.totalObjects !== undefined && status.totalObjects > 0) && (
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>检测目标</span>
                                                <span>{status.totalObjects} 个</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className={styles.recentTasksCard}>
                <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                        <HistoryOutlined style={{marginRight: 8}}/>
                        最近检测任务
                    </span>
                    <Space>
                        <Button
                            type="link"
                            size="small"
                            icon={<ReloadOutlined/>}
                            onClick={loadRecentTasks}
                        >
                            刷新
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            onClick={handleViewHistory}
                        >
                            查看全部
                        </Button>
                    </Space>
                </div>

                <Table
                    columns={taskColumns}
                    dataSource={recentTasks}
                    rowKey="id"
                    pagination={false}
                    size="small"
                />
            </div>

            <Card
                title={
                    <Space>
                        <BarChartOutlined/>
                        检测数据趋势
                    </Space>
                }
                style={{marginTop: 16}}
                extra={
                    <Button type="link" size="small" onClick={handleRefresh}>
                        <ReloadOutlined/> 刷新
                    </Button>
                }
            >
                <div className={styles.chartPlaceholder}>
                    <Space direction="vertical" style={{textAlign: 'center'}}>
                        <BarChartOutlined style={{fontSize: 48, color: '#d9d9d9'}}/>
                        <span style={{color: '#999'}}>
                            图表组件待接入（可使用 ECharts 实现以下图表）
                        </span>
                        <Descriptions size="small" column={1} style={{marginTop: 16}}>
                            <Descriptions.Item label="1. 每日检测任务数趋势图">折线图</Descriptions.Item>
                            <Descriptions.Item label="2. 各通道检测统计">柱状图</Descriptions.Item>
                            <Descriptions.Item label="3. 目标类别分布">饼图</Descriptions.Item>
                            <Descriptions.Item label="4. 置信度分布">直方图</Descriptions.Item>
                        </Descriptions>
                    </Space>
                </div>
            </Card>
        </div>
    );
};

export default MetricsDisplay;
