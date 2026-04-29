#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YOLOv8 检测服务脚本
用于视频目标检测和跟踪，输出JSON格式的检测结果
"""

import argparse
import json
import sys
import time
import os
from pathlib import Path
from collections import defaultdict

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    print(json.dumps({
        "type": "error",
        "error": "ultralytics not installed. Please install with: pip install ultralytics"
    }), file=sys.stderr)
    sys.exit(1)

try:
    import torch
except ImportError:
    print(json.dumps({
        "type": "error",
        "error": "torch not installed. Please install PyTorch."
    }), file=sys.stderr)
    sys.exit(1)


class DetectionService:
    """YOLOv8 检测服务类"""

    def __init__(self, model_path, conf_threshold=0.25, iou_threshold=0.7,
                 max_det=300, enable_tracking=True, frame_skip=1,
                 channel_index=0, task_id=None):
        """
        初始化检测服务

        Args:
            model_path: 模型路径
            conf_threshold: 置信度阈值
            iou_threshold: IOU阈值
            max_det: 最大检测数量
            enable_tracking: 是否启用跟踪
            frame_skip: 跳帧数
            channel_index: 通道索引
            task_id: 任务ID
        """
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.max_det = max_det
        self.enable_tracking = enable_tracking
        self.frame_skip = frame_skip
        self.channel_index = channel_index
        self.task_id = task_id

        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self._print_info(f"Using device: {self.device}")

        self._load_model()

        self.frame_count = 0
        self.processed_frames = 0
        self.total_objects = 0
        self.class_counts = defaultdict(int)
        self.confidence_values = []

        self.start_time = None
        self.last_progress_time = 0

    def _load_model(self):
        """加载YOLO模型"""
        try:
            self._print_info(f"Loading model from: {self.model_path}")
            self.model = YOLO(self.model_path)
            self._print_info("Model loaded successfully")
        except Exception as e:
            self._print_error(f"Failed to load model: {e}")
            sys.exit(1)

    def _print_info(self, message):
        """打印信息到stderr"""
        print(json.dumps({"type": "info", "message": str(message)}), file=sys.stderr)
        sys.stderr.flush()

    def _print_error(self, message):
        """打印错误到stderr"""
        print(json.dumps({"type": "error", "error": str(message)}), file=sys.stderr)
        sys.stderr.flush()

    def _output_frame_result(self, frame_idx, frame_time, detections):
        """
        输出帧检测结果到stdout

        Args:
            frame_idx: 帧索引
            frame_time: 帧时间戳
            detections: 检测结果列表
        """
        objects = []
        for det in detections:
            obj = {
                "track_id": det.get("track_id"),
                "class_name": det["class_name"],
                "class_id": det["class_id"],
                "confidence": det["confidence"],
                "x": int(det["bbox"][0]),
                "y": int(det["bbox"][1]),
                "width": int(det["bbox"][2] - det["bbox"][0]),
                "height": int(det["bbox"][3] - det["bbox"][1])
            }
            objects.append(obj)

        result = {
            "type": "frame_result",
            "frame_index": frame_idx,
            "frame_time": frame_time,
            "object_count": len(objects),
            "objects": objects,
            "channel_index": self.channel_index,
            "task_id": self.task_id
        }

        print(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()

    def _output_progress(self, total_frames=None):
        """
        输出进度信息

        Args:
            total_frames: 总帧数
        """
        current_time = time.time()
        if current_time - self.last_progress_time < 0.5:
            return

        self.last_progress_time = current_time

        elapsed = time.time() - self.start_time if self.start_time else 0
        fps = self.processed_frames / elapsed if elapsed > 0 else 0

        progress = {
            "type": "progress",
            "processed_frames": self.processed_frames,
            "total_frames": total_frames,
            "fps": int(fps),
            "total_objects": self.total_objects,
            "channel_index": self.channel_index,
            "task_id": self.task_id
        }

        print(json.dumps(progress, ensure_ascii=False))
        sys.stdout.flush()

    def _output_summary(self):
        """输出检测摘要"""
        if len(self.confidence_values) > 0:
            avg_confidence = sum(self.confidence_values) / len(self.confidence_values)
        else:
            avg_confidence = 0

        summary = {
            "type": "summary",
            "summary": {
                "processed_frames": self.processed_frames,
                "total_objects": self.total_objects,
                "class_counts": dict(self.class_counts),
                "avg_confidence": avg_confidence,
                "channel_index": self.channel_index,
                "task_id": self.task_id
            }
        }

        print(json.dumps(summary, ensure_ascii=False))
        sys.stdout.flush()

    def _process_detections(self, results):
        """
        处理YOLO检测结果

        Args:
            results: YOLO结果对象

        Returns:
            处理后的检测列表
        """
        detections = []

        if results is None:
            return detections

        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for i, box in enumerate(boxes):
                try:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0].cpu().numpy())
                    class_id = int(box.cls[0].cpu().numpy())

                    class_name = result.names.get(class_id, f"class_{class_id}")

                    track_id = None
                    if hasattr(box, 'id') and box.id is not None:
                        track_id = int(box.id[0].cpu().numpy())

                    detections.append({
                        "bbox": [float(x1), float(y1), float(x2), float(y2)],
                        "confidence": confidence,
                        "class_id": class_id,
                        "class_name": class_name,
                        "track_id": track_id
                    })

                except Exception as e:
                    self._print_error(f"Error processing detection: {e}")
                    continue

        return detections

    def _update_statistics(self, detections):
        """
        更新统计信息

        Args:
            detections: 检测结果列表
        """
        self.total_objects += len(detections)

        for det in detections:
            class_name = det.get("class_name", "unknown")
            self.class_counts[class_name] += 1

            confidence = det.get("confidence", 0)
            self.confidence_values.append(confidence)

    def process_video(self, source):
        """
        处理视频源

        Args:
            source: 视频源路径或摄像头索引
        """
        self.start_time = time.time()

        try:
            if source.isdigit():
                cap = cv2.VideoCapture(int(source))
            else:
                cap = cv2.VideoCapture(source)

            if not cap.isOpened():
                self._print_error(f"Cannot open video source: {source}")
                sys.exit(1)

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)

            self._print_info(f"Video opened: total_frames={total_frames}, fps={fps}")

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                self.frame_count += 1

                if self.frame_count % self.frame_skip != 0:
                    continue

                self.processed_frames += 1
                frame_time = int(time.time() * 1000)

                try:
                    if self.enable_tracking:
                        results = self.model.track(
                            frame,
                            conf=self.conf_threshold,
                            iou=self.iou_threshold,
                            max_det=self.max_det,
                            device=self.device,
                            persist=True,
                            verbose=False
                        )
                    else:
                        results = self.model(
                            frame,
                            conf=self.conf_threshold,
                            iou=self.iou_threshold,
                            max_det=self.max_det,
                            device=self.device,
                            verbose=False
                        )

                    detections = self._process_detections(results)
                    self._update_statistics(detections)

                    self._output_frame_result(self.frame_count, frame_time, detections)
                    self._output_progress(total_frames if total_frames > 0 else None)

                except Exception as e:
                    self._print_error(f"Error processing frame {self.frame_count}: {e}")
                    continue

            cap.release()

            self._output_summary()
            self._print_info("Detection completed successfully")

        except KeyboardInterrupt:
            self._print_info("Detection interrupted by user")
            self._output_summary()
            sys.exit(0)
        except Exception as e:
            self._print_error(f"Fatal error: {e}")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='YOLOv8 Detection Service')
    parser.add_argument('--model', type=str, required=True, help='Path to YOLO model file')
    parser.add_argument('--source', type=str, required=True, help='Video source (file path or camera index)')
    parser.add_argument('--conf', type=float, default=0.25, help='Confidence threshold')
    parser.add_argument('--iou', type=float, default=0.7, help='IOU threshold')
    parser.add_argument('--max-det', type=int, default=300, help='Maximum detections per frame')
    parser.add_argument('--track', action='store_true', help='Enable object tracking')
    parser.add_argument('--frame-skip', type=int, default=1, help='Process every Nth frame')
    parser.add_argument('--channel', type=int, default=0, help='Channel index')
    parser.add_argument('--task-id', type=int, default=None, help='Task ID')

    args = parser.parse_args()

    service = DetectionService(
        model_path=args.model,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        max_det=args.max_det,
        enable_tracking=args.track,
        frame_skip=args.frame_skip,
        channel_index=args.channel,
        task_id=args.task_id
    )

    service.process_video(args.source)


if __name__ == '__main__':
    main()
