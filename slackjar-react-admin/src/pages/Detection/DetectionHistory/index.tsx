import React, {useCallback, useEffect, useState} from 'react';
import {
    Button,
    Card,
    DatePicker,
    Descriptions,
    Drawer,
    message,
    Popconfirm,
    Select,
    Space,
    Table,
    Tag,
} from 'antd';
import {
    DownloadOutlined,
    EyeOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type {DetectionTask, DetectionTaskPageQuery, PageResult, ResponseData, TaskMetrics} from '../../../apis';
import {exportDetectionHistory, getTaskMetrics, getTaskPage} from '../../../apis';
import styles from './index.module.scss';
import globalStyles from '../../global.module.scss';

const {RangePicker} = DatePicker;
const {Option} = Select;

const statusMap: Record<number, { text: string; class: string }> = {
    0: {text: '待处理', class: 'pending'},
    1: {text: '处理中', class: 'processing'},
    2: {text: '已完成', class: 'completed'},
    3: {text: '失败', class: 'failed'},
    4: {text: '已停止', class: 'stopped'},
};

const DetectionHistory: React.FC = () => {
    const [query, setQuery] = useState<DetectionTaskPageQuery>({pageNo: 1, pageSize: 10});
    const [tasks, setTasks] = useState<DetectionTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({current: 1, pageSize: 10, total: 0});

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<DetectionTask | null>(null);
    const [taskMetrics, setTaskMetrics] = useState<TaskMetrics | null>(null);
    const [metricsLoading, setMetricsLoading] = useState(false);

    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

    const fetchTasks = useCallback((searchQuery?: DetectionTaskPageQuery) => {
        const q = searchQuery || query;
        setLoading(true);
        getTaskPage(q)
            .then((res: ResponseData<PageResult<DetectionTask>>) => {
                if (res.code === 200 && res.data) {
                    const pageResult = res.data;
                    setTasks(pageResult.list || []);
                    setPagination({
                        current: pageResult.pageNo || q.pageNo || 1,
                        pageSize: pageResult.pageSize || q.pageSize || 10,
                        total: pageResult.total || 0,
                    });
                }
            })
            .finally(() => setLoading(false));
    }, [query]);

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleSearch = () => {
        const newQuery: DetectionTaskPageQuery = {
            ...query,
            pageNo: 1,
            startTime: dateRange ? dateRange[0].valueOf() : undefined,
            endTime: dateRange ? dateRange[1].valueOf() : undefined,
        };
        setQuery(newQuery);
        fetchTasks(newQuery);
    };

    const handleReset = () => {
        const resetQuery: DetectionTaskPageQuery = {
            pageNo: 1,
            pageSize: 10,
            taskName: undefined,
            status: undefined,
            channelIndexes: undefined,
            startTime: undefined,
            endTime: undefined,
        };
        setQuery(resetQuery);
        setDateRange(null);
        fetchTasks(resetQuery);
    };

    const handlePageChange = (page: number, pageSize: number) => {
        const newQuery = {...query, pageNo: page, pageSize};
        setQuery(newQuery);
        fetchTasks(newQuery);
    };

    const handleViewDetail = async (record: DetectionTask) => {
        setSelectedTask(record);
        setDrawerOpen(true);

        if (record.status === 2 || record.status === 4) {
            setMetricsLoading(true);
            try {
                const res = await getTaskMetrics(record.id);
                if (res.code === 200 && res.data) {
                    setTaskMetrics(res.data);
                }
            } catch (err) {
                console.error('加载任务指标失败', err);
            } finally {
                setMetricsLoading(false);
            }
        }
    };

    const handleExport = async (record: DetectionTask) => {
        try {
            const blob = await exportDetectionHistory(record.id, 'csv');
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `detection_history_${record.id}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            message.success('导出成功');
        } catch (err: any) {
            message.error('导出失败: ' + (err.message || '未知错误'));
        }
    };

    const formatDuration = (startTime?: number, endTime?: number) => {
        if (!startTime || !endTime) return '-';
        const duration = endTime - startTime;
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}小时${minutes % 60}分${seconds % 60}秒`;
        } else if (minutes > 0) {
            return `${minutes}分${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    };

    const formatBytes = (bytes?: number) => {
        if (!bytes) return '-';
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        let size = bytes;
        while (size >= 1024 && i < units.length - 1) {
            size /= 1024;
            i++;
        }
        return `${size.toFixed(2)} ${units[i]}`;
    };

    const columns = [
        {
            title: '任务名称',
            dataIndex: 'taskName',
            key: 'taskName',
            render: (text: string, record: DetectionTask) => (
                <Space direction="vertical" size={0}>
                    <span style={{fontWeight: 500}}>{text}</span>
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
            title: '置信度/IOU',
            key: 'params',
            render: (_: any, record: DetectionTask) => (
                <Space direction="vertical" size={0}>
                    <span style={{fontSize: 12}}>置信度: {((record.confThreshold || 0) * 100).toFixed(1)}%</span>
                    <span style={{fontSize: 12, color: '#666'}}>IOU: {((record.iouThreshold || 0) * 100).toFixed(1)}%</span>
                </Space>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => {
                const info = statusMap[status] || {text: '未知', class: ''};
                return (
                    <Tag className={`${styles.statusTag} ${styles[info.class]}`}>
                        {info.text}
                    </Tag>
                );
            },
        },
        {
            title: '检测统计',
            key: 'stats',
            render: (_: any, record: DetectionTask) => (
                <Space direction="vertical" size={0}>
                    <span style={{fontSize: 12}}>帧数: {record.processedFrames || 0} / {record.frameCount || '-'}</span>
                    <span style={{fontSize: 12, color: '#666'}}>目标数: {record.totalObjects || 0}</span>
                </Space>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'createTime',
            key: 'createTime',
            render: (time: number) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: any, record: DetectionTask) => (
                <Space size="small">
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined/>}
                        onClick={() => handleViewDetail(record)}
                    >
                        详情
                    </Button>
                    {(record.status === 2 || record.status === 4) && (
                        <Button
                            type="link"
                            size="small"
                            icon={<DownloadOutlined/>}
                            onClick={() => handleExport(record)}
                        >
                            导出
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className={`${globalStyles.pageContainer} ${styles.detectionHistoryPage}`}>
            <Card
                title="搜索条件"
                size="small"
                style={{marginBottom: 16}}
            >
                <Space wrap>
                    <Select
                        placeholder="任务状态"
                        value={query.status}
                        onChange={(val) => setQuery({...query, status: val})}
                        style={{width: 150}}
                        allowClear
                    >
                        <Option value={0}>待处理</Option>
                        <Option value={1}>处理中</Option>
                        <Option value={2}>已完成</Option>
                        <Option value={3}>失败</Option>
                        <Option value={4}>已停止</Option>
                    </Select>

                    <Select
                        placeholder="通道"
                        value={query.channelIndexes?.[0]}
                        onChange={(val) => setQuery({
                            ...query,
                            channelIndexes: val !== null ? [val] : undefined
                        })}
                        style={{width: 150}}
                        allowClear
                    >
                        <Option value={0}>通道 1</Option>
                        <Option value={1}>通道 2</Option>
                        <Option value={2}>通道 3</Option>
                        <Option value={3}>通道 4</Option>
                    </Select>

                    <RangePicker
                        value={dateRange}
                        onChange={(val) => setDateRange(val as [dayjs.Dayjs, dayjs.Dayjs])}
                        style={{width: 280}}
                        showTime
                    />

                    <Button type="primary" onClick={handleSearch}>
                        搜索
                    </Button>
                    <Button onClick={handleReset}>
                        重置
                    </Button>
                    <Button icon={<ReloadOutlined/>} onClick={() => fetchTasks()}>
                        刷新
                    </Button>
                </Space>
            </Card>

            <Card
                title="检测历史"
                size="small"
            >
                <Table
                    columns={columns}
                    dataSource={tasks}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        ...pagination,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                        onChange: handlePageChange,
                    }}
                />
            </Card>

            <Drawer
                title="检测任务详情"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={600}
                className={styles.detailDrawer}
            >
                {selectedTask && (
                    <>
                        <div className={styles.statusTag}>
                            <Tag className={`${styles.statusTag} ${styles[statusMap[selectedTask.status]?.class]}`}>
                                {statusMap[selectedTask.status]?.text || '未知'}
                            </Tag>
                        </div>

                        <Descriptions
                            title="基本信息"
                            column={1}
                            size="small"
                            bordered
                        >
                            <Descriptions.Item label="任务名称">{selectedTask.taskName}</Descriptions.Item>
                            <Descriptions.Item label="任务编码">{selectedTask.taskCode}</Descriptions.Item>
                            <Descriptions.Item label="使用模型">{selectedTask.modelName || '-'}</Descriptions.Item>
                            <Descriptions.Item label="通道">通道 {selectedTask.channelIndex !== null && selectedTask.channelIndex !== undefined ? selectedTask.channelIndex + 1 : '-'}</Descriptions.Item>
                            <Descriptions.Item label="视频URL">
                                {selectedTask.videoUrl || '-'}
                            </Descriptions.Item>
                        </Descriptions>

                        <Descriptions
                            title="检测参数"
                            column={2}
                            size="small"
                            bordered
                            style={{marginTop: 16}}
                        >
                            <Descriptions.Item label="置信度阈值">
                                {((selectedTask.confThreshold || 0) * 100).toFixed(1)}%
                            </Descriptions.Item>
                            <Descriptions.Item label="IOU阈值">
                                {((selectedTask.iouThreshold || 0) * 100).toFixed(1)}%
                            </Descriptions.Item>
                        </Descriptions>

                        <Descriptions
                            title="时间信息"
                            column={2}
                            size="small"
                            bordered
                            style={{marginTop: 16}}
                        >
                            <Descriptions.Item label="创建时间">
                                {selectedTask.createTime ? dayjs(selectedTask.createTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="开始时间">
                                {selectedTask.startTime ? dayjs(selectedTask.startTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="结束时间">
                                {selectedTask.endTime ? dayjs(selectedTask.endTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="持续时间">
                                {formatDuration(selectedTask.startTime, selectedTask.endTime)}
                            </Descriptions.Item>
                        </Descriptions>

                        <div className={styles.statsCard} style={{marginTop: 16}}>
                            <div className={styles.statsRow}>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>{selectedTask.processedFrames || 0}</div>
                                    <div className={styles.statLabel}>已处理帧数</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>{selectedTask.frameCount || 0}</div>
                                    <div className={styles.statLabel}>总帧数</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>{selectedTask.totalObjects || 0}</div>
                                    <div className={styles.statLabel}>检测目标数</div>
                                </div>
                            </div>
                        </div>

                        {taskMetrics && taskMetrics.classDistribution && Object.keys(taskMetrics.classDistribution).length > 0 && (
                            <Descriptions
                                title="目标分布统计"
                                column={2}
                                size="small"
                                bordered
                                style={{marginTop: 16}}
                            >
                                {Object.entries(taskMetrics.classDistribution).map(([className, count]) => (
                                    <Descriptions.Item key={className} label={className}>
                                        <Tag color="blue">{count}</Tag>
                                    </Descriptions.Item>
                                ))}
                            </Descriptions>
                        )}

                        {selectedTask.errorMsg && (
                            <Descriptions
                                title="错误信息"
                                column={1}
                                size="small"
                                bordered
                                style={{marginTop: 16}}
                            >
                                <Descriptions.Item label="错误详情">
                                    <span style={{color: '#ff4d4f'}}>{selectedTask.errorMsg}</span>
                                </Descriptions.Item>
                            </Descriptions>
                        )}

                        {(selectedTask.status === 2 || selectedTask.status === 4) && (
                            <div className={styles.actionRow}>
                                <Button
                                    type="primary"
                                    icon={<DownloadOutlined/>}
                                    onClick={() => handleExport(selectedTask)}
                                >
                                    导出检测结果
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Drawer>
        </div>
    );
};

export default DetectionHistory;
