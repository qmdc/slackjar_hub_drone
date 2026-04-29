import React, {useCallback, useEffect, useState} from 'react';
import {Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Upload} from 'antd';
import {DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, UploadOutlined} from '@ant-design/icons';
import type {DetectionModel, DetectionModelPageQuery, PageResult, ResponseData} from '../../../apis';
import {createModel, deleteModel, getModelPage, listEnabledModels, setDefaultModel, updateModel} from '../../../apis';
import styles from './index.module.scss';
import globalStyles from '../../global.module.scss';

const {Option} = Select;
const {TextArea} = Input;

interface ModelFormData {
    modelName: string;
    modelCode: string;
    modelType: string;
    description: string;
    inputSize: number;
    defaultConfThreshold: number;
    defaultIouThreshold: number;
    maxDet: number;
    modelFile?: File;
}

const ModelManagement: React.FC = () => {
    const [query, setQuery] = useState<DetectionModelPageQuery>({pageNo: 1, pageSize: 10});
    const [models, setModels] = useState<DetectionModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({current: 1, pageSize: 10, total: 0});

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [editingModel, setEditingModel] = useState<DetectionModel | null>(null);
    const [form] = Form.useForm<ModelFormData>();

    const [uploading, setUploading] = useState(false);

    const fetchModels = useCallback((searchQuery?: DetectionModelPageQuery) => {
        const q = searchQuery || query;
        setLoading(true);
        getModelPage(q)
            .then((res: ResponseData<PageResult<DetectionModel>>) => {
                if (res.code === 200 && res.data) {
                    const pageResult = res.data;
                    setModels(pageResult.list || []);
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
        fetchModels();
    }, []);

    const handleSearch = () => {
        const newQuery = {...query, pageNo: 1};
        setQuery(newQuery);
        fetchModels(newQuery);
    };

    const handleReset = () => {
        const resetQuery = {pageNo: 1, pageSize: 10, modelName: undefined, modelCode: undefined, status: undefined};
        setQuery(resetQuery);
        fetchModels(resetQuery);
    };

    const handlePageChange = (page: number, pageSize: number) => {
        const newQuery = {...query, pageNo: page, pageSize};
        setQuery(newQuery);
        fetchModels(newQuery);
    };

    const handleAddModel = () => {
        setEditingModel(null);
        setModalTitle('新增模型');
        form.resetFields();
        form.setFieldsValue({
            modelType: 'yolov8',
            inputSize: 640,
            defaultConfThreshold: 0.25,
            defaultIouThreshold: 0.7,
            maxDet: 300,
        });
        setModalOpen(true);
    };

    const handleEditModel = (record: DetectionModel) => {
        setEditingModel(record);
        setModalTitle('编辑模型');
        form.setFieldsValue({
            modelName: record.modelName,
            modelCode: record.modelCode,
            modelType: record.modelType,
            description: record.description,
            inputSize: record.inputSize,
            defaultConfThreshold: record.defaultConfThreshold,
            defaultIouThreshold: record.defaultIouThreshold,
            maxDet: record.maxDet,
        });
        setModalOpen(true);
    };

    const handleDeleteModel = (record: DetectionModel) => {
        deleteModel(record.id)
            .then((res) => {
                if (res.code === 200) {
                    message.success('删除成功');
                    fetchModels();
                }
            })
            .catch((err) => {
                message.error('删除失败: ' + (err.message || '未知错误'));
            });
    };

    const handleSetDefault = (record: DetectionModel) => {
        setDefaultModel(record.id)
            .then((res) => {
                if (res.code === 200) {
                    message.success('设置默认模型成功');
                    fetchModels();
                }
            })
            .catch((err) => {
                message.error('设置默认模型失败: ' + (err.message || '未知错误'));
            });
    };

    const handleModalOk = () => {
        form.validateFields()
            .then((values) => {
                setUploading(true);
                if (editingModel) {
                    updateModel(editingModel.id, {
                        modelName: values.modelName,
                        description: values.description,
                        defaultConfThreshold: values.defaultConfThreshold,
                        defaultIouThreshold: values.defaultIouThreshold,
                        maxDet: values.maxDet,
                    })
                        .then((res) => {
                            if (res.code === 200) {
                                message.success('更新成功');
                                setModalOpen(false);
                                fetchModels();
                            }
                        })
                        .catch((err) => {
                            message.error('更新失败: ' + (err.message || '未知错误'));
                        })
                        .finally(() => setUploading(false));
                } else {
                    const formData = new FormData();
                    formData.append('modelName', values.modelName);
                    formData.append('modelCode', values.modelCode);
                    formData.append('modelType', values.modelType || 'yolov8');
                    if (values.description) {
                        formData.append('description', values.description);
                    }
                    if (values.inputSize) {
                        formData.append('inputSize', values.inputSize.toString());
                    }
                    if (values.defaultConfThreshold) {
                        formData.append('defaultConfThreshold', values.defaultConfThreshold.toString());
                    }
                    if (values.defaultIouThreshold) {
                        formData.append('defaultIouThreshold', values.defaultIouThreshold.toString());
                    }
                    if (values.maxDet) {
                        formData.append('maxDet', values.maxDet.toString());
                    }
                    if (values.modelFile) {
                        formData.append('modelFile', values.modelFile);
                    }

                    createModel(formData)
                        .then((res) => {
                            if (res.code === 200) {
                                message.success('创建成功');
                                setModalOpen(false);
                                fetchModels();
                            }
                        })
                        .catch((err) => {
                            message.error('创建失败: ' + (err.message || '未知错误'));
                        })
                        .finally(() => setUploading(false));
                }
            });
    };

    const handleModelUpload = (info: any) => {
        const {file, fileList} = info;
        if (file.status === 'done' || file.status === 'uploading') {
            return;
        }

        if (file.originFileObj) {
            form.setFieldsValue({modelFile: file.originFileObj});
        }
    };

    const columns = [
        {
            title: '模型名称',
            dataIndex: 'modelName',
            key: 'modelName',
            render: (text: string, record: DetectionModel) => (
                <Space>
                    <span>{text}</span>
                    {record.isDefault === 1 && (
                        <Tag color="gold">默认</Tag>
                    )}
                </Space>
            ),
        },
        {
            title: '模型编码',
            dataIndex: 'modelCode',
            key: 'modelCode',
        },
        {
            title: '模型类型',
            dataIndex: 'modelType',
            key: 'modelType',
            render: (text: string) => (
                <Tag color="blue">{text}</Tag>
            ),
        },
        {
            title: '输入尺寸',
            dataIndex: 'inputSize',
            key: 'inputSize',
        },
        {
            title: '默认置信度',
            dataIndex: 'defaultConfThreshold',
            key: 'defaultConfThreshold',
            render: (val: number) => `${(val * 100).toFixed(1)}%`,
        },
        {
            title: '默认IOU',
            dataIndex: 'defaultIouThreshold',
            key: 'defaultIouThreshold',
            render: (val: number) => `${(val * 100).toFixed(1)}%`,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => (
                <Tag color={status === 1 ? 'green' : 'red'}>
                    {status === 1 ? '启用' : '禁用'}
                </Tag>
            ),
        },
        {
            title: '操作',
            key: 'action',
            width: 250,
            render: (_: any, record: DetectionModel) => (
                <Space size="small">
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined/>}
                        onClick={() => handleEditModel(record)}
                    >
                        编辑
                    </Button>
                    {record.isDefault !== 1 && (
                        <Button
                            type="link"
                            size="small"
                            onClick={() => handleSetDefault(record)}
                        >
                            设为默认
                        </Button>
                    )}
                    <Popconfirm
                        title="确定删除该模型吗？"
                        onConfirm={() => handleDeleteModel(record)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined/>}
                        >
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className={`${globalStyles.pageContainer} ${styles.modelManagementPage}`}>
            <Card
                title="搜索条件"
                size="small"
                style={{marginBottom: 16}}
            >
                <Space wrap>
                    <Input
                        placeholder="模型名称"
                        value={query.modelName}
                        onChange={(e) => setQuery({...query, modelName: e.target.value})}
                        style={{width: 200}}
                        allowClear
                    />
                    <Input
                        placeholder="模型编码"
                        value={query.modelCode}
                        onChange={(e) => setQuery({...query, modelCode: e.target.value})}
                        style={{width: 200}}
                        allowClear
                    />
                    <Select
                        placeholder="状态"
                        value={query.status}
                        onChange={(val) => setQuery({...query, status: val})}
                        style={{width: 150}}
                        allowClear
                    >
                        <Option value={1}>启用</Option>
                        <Option value={0}>禁用</Option>
                    </Select>
                    <Button type="primary" onClick={handleSearch}>
                        搜索
                    </Button>
                    <Button onClick={handleReset}>
                        重置
                    </Button>
                    <Button icon={<ReloadOutlined/>} onClick={() => fetchModels()}>
                        刷新
                    </Button>
                </Space>
            </Card>

            <Card
                title="模型列表"
                size="small"
                extra={
                    <Button type="primary" icon={<PlusOutlined/>} onClick={handleAddModel}>
                        新增模型
                    </Button>
                }
            >
                <Table
                    columns={columns}
                    dataSource={models}
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

            <Modal
                title={modalTitle}
                open={modalOpen}
                onOk={handleModalOk}
                onCancel={() => setModalOpen(false)}
                confirmLoading={uploading}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    className={styles.modelFormModal}
                >
                    <Form.Item
                        name="modelName"
                        label="模型名称"
                        rules={[{required: true, message: '请输入模型名称'}]}
                    >
                        <Input placeholder="请输入模型名称"/>
                    </Form.Item>

                    {!editingModel && (
                        <>
                            <Form.Item
                                name="modelCode"
                                label="模型编码"
                                rules={[{required: true, message: '请输入模型编码'}]}
                            >
                                <Input placeholder="请输入模型编码，如 yolov8n_visdrone"/>
                            </Form.Item>

                            <Form.Item
                                name="modelType"
                                label="模型类型"
                                rules={[{required: true, message: '请选择模型类型'}]}
                            >
                                <Select placeholder="请选择模型类型">
                                    <Option value="yolov8">YOLOv8</Option>
                                    <Option value="yolov5">YOLOv5</Option>
                                    <Option value="custom">自定义</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="modelFile"
                                label="模型文件"
                                rules={[{required: true, message: '请上传模型文件'}]}
                            >
                                <Upload
                                    beforeUpload={() => false}
                                    onChange={handleModelUpload}
                                    maxCount={1}
                                    accept=".pt,.pth,.onnx,.engine"
                                >
                                    <Button icon={<UploadOutlined/>}>上传模型文件 (.pt, .pth, .onnx)</Button>
                                </Upload>
                            </Form.Item>
                        </>
                    )}

                    <Form.Item
                        name="inputSize"
                        label="输入尺寸"
                        rules={[{required: true, message: '请输入输入尺寸'}]}
                    >
                        <InputNumber
                            min={32}
                            max={2048}
                            style={{width: '100%'}}
                            placeholder="默认 640"
                        />
                    </Form.Item>

                    <Form.Item
                        name="defaultConfThreshold"
                        label="默认置信度阈值"
                        rules={[{required: true, message: '请输入置信度阈值'}]}
                    >
                        <InputNumber
                            min={0}
                            max={1}
                            step={0.05}
                            style={{width: '100%'}}
                            placeholder="默认 0.25"
                        />
                    </Form.Item>

                    <Form.Item
                        name="defaultIouThreshold"
                        label="默认IOU阈值"
                        rules={[{required: true, message: '请输入IOU阈值'}]}
                    >
                        <InputNumber
                            min={0}
                            max={1}
                            step={0.05}
                            style={{width: '100%'}}
                            placeholder="默认 0.7"
                        />
                    </Form.Item>

                    <Form.Item
                        name="maxDet"
                        label="最大检测数量"
                        rules={[{required: true, message: '请输入最大检测数量'}]}
                    >
                        <InputNumber
                            min={1}
                            max={10000}
                            style={{width: '100%'}}
                            placeholder="默认 300"
                        />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="描述"
                    >
                        <TextArea
                            rows={3}
                            placeholder="模型描述信息"
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ModelManagement;
