import React, {useState} from 'react';
import {
    Avatar,
    Badge,
    Button,
    Card,
    Col,
    Descriptions,
    Form,
    Input,
    message,
    Modal,
    Row,
    Space,
    Table,
    Tag,
    Typography,
    Upload
} from 'antd';
import type {UploadProps} from 'antd';
import {
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
    ClockCircleOutlined,
    EditOutlined,
    SafetyOutlined,
    KeyOutlined,
    MenuOutlined,
    DesktopOutlined,
    ApiOutlined,
    PlusOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {useAuthStore} from "../../../store/authStore";
import {getUserInfo, updateUserInfo, uploadFile} from "../../../apis";

const {Title, Text} = Typography;
type UploadFileType = Parameters<NonNullable<UploadProps['beforeUpload']>>[0];
const previewImageStyle = {width: '100%', height: '100%', objectFit: 'cover' as const};

interface EditFormValues {
    nickname?: string
}

/**
 * 个人中心账号信息页
 */
const AccountInfo: React.FC = () => {
    const userInfo = useAuthStore((state) => state.userInfo);
    const roles = useAuthStore((state) => state.roles);
    const permissions = useAuthStore((state) => state.permissions);
    const setUserInfo = useAuthStore((state) => state.setUserInfo);

    // 状态映射
    const statusMap: Record<number, { text: string; color: string }> = {
        0: {text: '正常', color: 'green'},
        1: {text: '禁用', color: 'red'},
    };

    // 角色类型映射
    const roleTypeMap: Record<number, string> = {
        1: '系统角色',
        2: '自定义角色',
    };

    // 角色状态映射
    const roleStatusMap: Record<number, { text: string; color: string }> = {
        0: {text: '启用', color: 'green'},
        1: {text: '禁用', color: 'red'},
    };

    // 权限类型映射
    const permissionTypeMap: Record<number, { text: string; color: string; icon: React.ReactNode }> = {
        1: {text: '菜单', color: 'blue', icon: <MenuOutlined/>},
        2: {text: '按钮', color: 'green', icon: <DesktopOutlined/>},
        3: {text: '接口', color: 'orange', icon: <ApiOutlined/>},
    };

    // Modal 状态管理
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalPermissions, setModalPermissions] = useState<any[]>([]);

    // 编辑资料弹窗状态
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string>('');
    const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string>('');
    const [form] = Form.useForm<EditFormValues>();

    if (!userInfo) {
        return <div>暂无用户信息</div>;
    }

    // 按角色分组权限
    const getPermissionsByRole = (roleId: number, roleCode: string) => {
        // 先尝试用 roleIdCode 匹配
        let perms = permissions.filter(p => p.roleId === roleId.toString());

        // 如果没找到，尝试用 roleCode 匹配
        if (perms.length === 0) {
            perms = permissions.filter(p => p.roleCode === roleCode);
        }

        // 如果还是没找到，尝试用 roleIdCode 包含 roleCode 的方式匹配
        if (perms.length === 0) {
            perms = permissions.filter(p => p.roleCode && p.roleCode.includes(roleCode));
        }

        return perms;
    };

    // 按权限类型过滤并排序
    const filterPermissionsByType = (perms: any[], type: number) => {
        return perms.filter(p => p.permissionType === type)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    };

    // 打开权限弹窗
    const handleShowPermissions = (role: any, type: number) => {
        const rolePerms = getPermissionsByRole(role.id, role.roleCode);
        const filteredPerms = filterPermissionsByType(rolePerms, type);

        setModalTitle(`${role.roleName} - ${permissionTypeMap[type].text}权限`);
        setModalPermissions(filteredPerms);
        setIsModalOpen(true);
    };

    /**
     * 打开编辑资料弹窗并初始化表单数据
     */
    const handleOpenEditModal = () => {
        form.setFieldsValue({
            nickname: userInfo.nickname,
        });
        setAvatarFile(null);
        setBackgroundFile(null);
        setAvatarPreviewUrl(userInfo.avatarUrl || '');
        setBackgroundPreviewUrl(userInfo.backgroundUrl || '');
        setIsEditModalOpen(true);
    };

    /**
     * 关闭编辑资料弹窗并重置临时状态
     */
    const handleCancelEditModal = () => {
        setIsEditModalOpen(false);
        setAvatarFile(null);
        setBackgroundFile(null);
        setAvatarPreviewUrl('');
        setBackgroundPreviewUrl('');
        form.resetFields();
    };

    /**
     * 处理图片选择并生成本地预览
     *
     * @param file 选择的文件
     * @param field 文件字段
     * @returns 阻止 antd 自动上传
     */
    const handleSelectImage = (file: UploadFileType, field: 'avatar' | 'background') => {
        const previewUrl = URL.createObjectURL(file);
        if (field === 'avatar') {
            setAvatarFile(file);
            setAvatarPreviewUrl(previewUrl);
        } else {
            setBackgroundFile(file);
            setBackgroundPreviewUrl(previewUrl);
        }
        return false;
    };

    /**
     * 上传用户图片并返回文件 ID
     *
     * @param file 待上传文件
     * @param bizType 业务类型
     * @returns 文件 ID
     */
    const uploadUserImage = async (file: File, bizType: 'avatar' | 'background') => {
        const result = await uploadFile(file, bizType);
        if (result.code !== 200 || !result.data?.fileId) {
            throw new Error(result.message || '文件上传失败');
        }
        return result.data.fileId;
    };

    /**
     * 提交编辑资料
     */
    const handleEditSubmit = async () => {
        try {
            const values = await form.validateFields();
            setIsSubmitting(true);

            const payload = {
                nickname: values.nickname?.trim(),
                avatarId: userInfo.avatarId,
                backgroundId: userInfo.backgroundId,
            };

            if (avatarFile) {
                payload.avatarId = await uploadUserImage(avatarFile, 'avatar');
            }
            if (backgroundFile) {
                payload.backgroundId = await uploadUserImage(backgroundFile, 'background');
            }

            const result = await updateUserInfo(payload);
            if (result.code !== 200) {
                message.error(result.message|| '修改失败');
                return;
            }

            const updatedUserInfo = await getUserInfo(userInfo.id);
            if (updatedUserInfo.code !== 200) {
                message.error(updatedUserInfo.message || '获取用户信息失败');
                return
            }

            setUserInfo(updatedUserInfo.data || null);
            message.success('修改成功');
            handleCancelEditModal();
        } catch (error) {
            const validationError = error as { errorFields?: unknown[] };
            if (validationError.errorFields) {
                return;
            }
            // 安全地获取错误消息
            const errorMessage = error instanceof Error ? error.message : '修改失败，请稍后重试';
            message.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 弹窗表格列定义
    const permissionColumns = [
        {
            title: '权限名称',
            dataIndex: 'permissionName',
            key: 'permissionName',
        },
        {
            title: '权限编码',
            dataIndex: 'permissionCode',
            key: 'permissionCode',
            render: (text: string) => {
                return (
                    <Tag color=''>
                        {text}
                    </Tag>
                );
            },
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            render: (text: string) => text || '暂无描述',
        },
        {
            title: '排序',
            dataIndex: 'sortOrder',
            key: 'sortOrder',
            width: 80,
        },
    ];

    // 角色表格列定义
    const roleColumns = [
        {
            title: '角色编码',
            dataIndex: 'roleCode',
            key: 'roleCode',
            width: 150,
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: '角色名称',
            dataIndex: 'roleName',
            key: 'roleName',
            width: 150,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: number) => (
                <Tag color={roleStatusMap[status]?.color || 'default'}>
                    {roleStatusMap[status]?.text || '未知'}
                </Tag>
            ),
        },
        {
            title: '类型',
            dataIndex: 'roleType',
            key: 'roleType',
            width: 120,
            render: (type: number) => roleTypeMap[type] || '未知',
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: '权限操作',
            key: 'actions',
            width: 350,
            render: (_: any, record: any) => {
                const rolePerms = getPermissionsByRole(record.id, record.roleCode);
                const menuCount = filterPermissionsByType(rolePerms, 1).length;
                const buttonCount = filterPermissionsByType(rolePerms, 2).length;
                const apiCount = filterPermissionsByType(rolePerms, 3).length;

                return (
                    <Space>
                        <Button
                            size="small"
                            icon={<MenuOutlined/>}
                            onClick={() => handleShowPermissions(record, 1)}
                        >
                            菜单权限 ({menuCount})
                        </Button>
                        <Button
                            size="small"
                            icon={<DesktopOutlined/>}
                            onClick={() => handleShowPermissions(record, 2)}
                        >
                            按钮权限 ({buttonCount})
                        </Button>
                        <Button
                            size="small"
                            icon={<ApiOutlined/>}
                            onClick={() => handleShowPermissions(record, 3)}
                        >
                            接口权限 ({apiCount})
                        </Button>
                    </Space>
                );
            },
        },
    ];

    return (
        <div style={{padding: '24px'}}>
            {/* 个人信息卡片 */}
            <Card
                style={{marginBottom: 24}}
                styles={{body: {padding: '24px'}}}
            >
                <Row gutter={24} align="middle">
                    {/* 左侧：头像和用户信息 */}
                    <Col span={3}>
                        <Badge dot={userInfo.status === 0} color='green'>
                            <Avatar
                                size={120}
                                src={userInfo.avatarUrl}
                                icon={!userInfo.avatarUrl ? <UserOutlined/> : undefined}
                                style={{
                                    border: '3px solid #f0f0f0',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                }}
                            />
                        </Badge>
                    </Col>
                    <Col span={5}>
                        <Space orientation="vertical" size="large" style={{width: '100%'}}>
                            <div>
                                <Title level={3} style={{margin: 0}}>
                                    {userInfo.nickname || userInfo.username}
                                </Title>
                                <Text type="secondary">@{userInfo.username}</Text>
                            </div>
                            <Space>
                                <Tag icon={<SafetyOutlined/>} color="blue">
                                    ID: {userInfo.id}
                                </Tag>
                                <Tag color={statusMap[userInfo.status]?.color || 'default'}>
                                    {statusMap[userInfo.status]?.text || '未知'}
                                </Tag>
                            </Space>
                            <Button icon={<EditOutlined/>} type="primary" onClick={handleOpenEditModal}>
                                编辑资料
                            </Button>
                        </Space>
                    </Col>
                    {/* 右侧：基本信息 */}
                    <Col span={16}>
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="邮箱">
                                <Space>
                                    <MailOutlined/>
                                    {userInfo.email || '未设置'}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="手机号">
                                <Space>
                                    <PhoneOutlined/>
                                    {userInfo.phone || '未设置'}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="注册日期">
                                <Space>
                                    <ClockCircleOutlined/>
                                    {dayjs(userInfo.createTime).format('YYYY-MM-DD HH:mm:ss')}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="IP属地">
                                <Space>
                                    <EnvironmentOutlined/>
                                    {userInfo.city || '-'}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="最后登录IP">
                                <Space>
                                    <EnvironmentOutlined/>
                                    {userInfo.ip || '-'}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="最后登录时间">
                                <Space>
                                    <ClockCircleOutlined/>
                                    {userInfo.lastLoginTime
                                        ? dayjs(userInfo.lastLoginTime).format('YYYY-MM-DD HH:mm:ss')
                                        : '-'}
                                </Space>
                            </Descriptions.Item>
                        </Descriptions>
                    </Col>
                </Row>
            </Card>

            {/* 角色信息 */}
            <Card
                title={
                    <Space>
                        <SafetyOutlined/>
                        <span>角色信息</span>
                    </Space>
                }
            >
                {roles.length > 0 ? (
                    <Table
                        dataSource={roles}
                        columns={roleColumns}
                        rowKey="id"
                        pagination={false}
                        size="middle"
                    />
                ) : (
                    <Text type="secondary">暂无角色信息</Text>
                )}
            </Card>

            {/* 权限详情弹窗 */}
            <Modal
                title={
                    <Space>
                        <KeyOutlined/>
                        <span>{modalTitle}</span>
                    </Space>
                }
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                width={800}
            >
                <Table
                    dataSource={modalPermissions}
                    columns={permissionColumns}
                    rowKey="id"
                    pagination={{pageSize: 10}}
                    size="small"
                    locale={{emptyText: '暂无权限数据'}}
                />
            </Modal>

            {/* 编辑资料弹窗 */}
            <Modal
                title={
                    <Space>
                        <EditOutlined/>
                        <span>编辑资料</span>
                    </Space>
                }
                open={isEditModalOpen}
                onCancel={handleCancelEditModal}
                onOk={handleEditSubmit}
                confirmLoading={isSubmitting}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    style={{marginTop: 24}}
                >
                    <Form.Item
                        label="昵称"
                        name="nickname"
                        rules={[{max: 50, message: '昵称长度不能超过50个字符'}]}
                    >
                        <Input placeholder="请输入昵称"/>
                    </Form.Item>

                    <Form.Item label="头像">
                        <Upload
                            listType="picture-card"
                            showUploadList={false}
                            accept=".jpg,.jpeg,.png"
                            maxCount={1}
                            style={{width: 104, height: 104}}
                            beforeUpload={(file) => handleSelectImage(file, 'avatar')}
                        >
                            {avatarPreviewUrl ? (
                                <img src={avatarPreviewUrl} alt="avatar" style={previewImageStyle}/>
                            ) : (
                                <div>
                                    <PlusOutlined/>
                                    <div style={{marginTop: 8}}>上传头像</div>
                                </div>
                            )}
                        </Upload>
                    </Form.Item>

                    <Form.Item label="背景图">
                        <Upload
                            listType="picture-card"
                            showUploadList={false}
                            accept=".jpg,.jpeg,.png,.webp"
                            maxCount={1}
                            style={{width: 180, height: 120}}
                            beforeUpload={(file) => handleSelectImage(file, 'background')}
                        >
                            {backgroundPreviewUrl ? (
                                <img src={backgroundPreviewUrl} alt="background" style={previewImageStyle}/>
                            ) : (
                                <div>
                                    <PlusOutlined/>
                                    <div style={{marginTop: 8}}>上传背景图</div>
                                </div>
                            )}
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AccountInfo;
