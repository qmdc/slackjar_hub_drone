import {
    AimOutlined,
    HistoryOutlined,
    SlidersOutlined,
    DashboardOutlined,
} from "@ant-design/icons";
import lazyLoad from "../lazyLoad";
import React, {lazy} from "react";
import {MenuRouteObject} from "../router";

const detection: MenuRouteObject = {
    path: "detection",
    label: "menu.detection management",
    icon: <AimOutlined/>,
    children: [
        {
            path: "video-detection",
            label: "menu.video detection",
            icon: <SlidersOutlined/>,
            element: lazyLoad(lazy(() => import("../../pages/Detection/VideoDetection")))
        },
        {
            path: "detection-history",
            label: "menu.detection history",
            icon: <HistoryOutlined/>,
            element: lazyLoad(lazy(() => import("../../pages/Detection/DetectionHistory")))
        },
        {
            path: "model-management",
            label: "menu.model management",
            icon: <SlidersOutlined/>,
            element: lazyLoad(lazy(() => import("../../pages/Detection/ModelManagement")))
        },
        {
            path: "metrics-display",
            label: "menu.metrics display",
            icon: <DashboardOutlined/>,
            element: lazyLoad(lazy(() => import("../../pages/Detection/MetricsDisplay")))
        }
    ] as MenuRouteObject[]
}

export default detection
