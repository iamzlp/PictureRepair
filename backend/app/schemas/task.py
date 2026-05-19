from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

# -------------------------------------------------------------------
# 1. 核心业务枚举 (我们的语言)
# -------------------------------------------------------------------
class TaskStatus(str, Enum):
    """任务状态机 - 控制整个生成流程"""
    PENDING = "pending"         # 已创建，等待提交
    SUBMITTED = "submitted"     # 已提交给即梦AI，获得 task_id
    PROCESSING = "processing"   # 生成中 (轮询中)
    DOWNLOADING = "downloading" # 生成成功，正在转存 OSS
    COMPLETED = "completed"     # 全部完成
    FAILED = "failed"           # 失败

class ArtStyle(str, Enum):
    """风格预设 - 前端只传这个，不需要知道具体 Prompt"""
    JAPANESE_ANIME = "japanese_anime"  # 日系动漫
    REALISTIC = "realistic"            # 写实摄影
    CLAY_3D = "clay_3d"                # 3D 黏土风
    CYBERPUNK = "cyberpunk"            # 赛博朋克

class AspectRatio(str, Enum):
    """画幅比例 - 映射到底层的 width/height"""
    SQUARE = "1:1"
    PORTRAIT = "3:4"
    LANDSCAPE = "16:9"
    STORY = "9:16"  # 适合手机全屏


# -------------------------------------------------------------------
# 2. 对外统一接口 (前端契约)
# -------------------------------------------------------------------
class GenerationRequest(BaseModel):
    """前端发起生成的请求体"""
    prompt: str = Field(..., description="用户输入的自然语言描述", max_length=500)
    style: ArtStyle = Field(default=ArtStyle.REALISTIC, description="风格预设")
    aspect_ratio: AspectRatio = Field(default=AspectRatio.STORY, description="画幅比例")
    reference_image_url: Optional[str] = Field(None, description="参考图URL (可选)")
    reference_image_urls: Optional[list[str]] = Field(None, description="参考图URL列表，最多4张（可选）")

class GenerationTaskResponse(BaseModel):
    """返回给前端的任务详情"""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    task_id: str = Field(..., alias="id") # Map DB 'id' to 'task_id'
    batch_id: Optional[str] = None
    status: TaskStatus
    progress: int = Field(0, ge=0, le=100)
    task_type: Optional[str] = None
    reference_image_url: Optional[str] = None
    result_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
