import axios from 'axios';
import {nanoid} from 'nanoid';
import {useAuthStore} from '../store/authStore';
import {message} from 'antd';

/**
 * 创建 axios 实例
 */
const request = axios.create({
    baseURL: '/api',
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json'
    }
})

/**
 * 请求拦截器
 */
request.interceptors.request.use(
    (config) => {
        // 注入认证 token
        const jwt = useAuthStore.getState().jwt
        if (jwt) {
            config.headers.token = jwt
        }

        // 注入请求追踪ID
        config.headers['X-Trace-Id'] = nanoid()

        // 调试日志
        console.log('>>>>> axios request:', config.method?.toUpperCase(), `${config.baseURL}${config.url || ''}`, config.headers)
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

/**
 * 响应拦截器
 */
request.interceptors.response.use(
    (response) => {
        console.log('<<<<< axios success response:', response, response.data)
        const customData = response.data;
        if (customData.code === 401) {
            message.error('登录已失效，请重新登录').then(r => {})
            useAuthStore.getState().loggedOut()
            setTimeout(() => {
                window.location.href = '/login'
            }, 800)
            return;
        }
        return customData;
    },
    (error) => {
        if (error.response) {
            console.log('<<<<< axios error response:', error.response)
            switch (error.response.status) {
                case 401:
                    message.error('登录已失效，请重新登录').then(r => {})
                    useAuthStore.getState().loggedOut()
                    setTimeout(() => {
                        window.location.href = '/login'
                    }, 800)
                    break
                case 403:
                    console.error('没有权限访问')
                    break
                case 500:
                    console.error('服务器错误')
                    break
                default:
                    console.error('请求失败:', error.response.data?.message || error.message)
            }
        }
        return Promise.reject(error)
    }
)

export default request
