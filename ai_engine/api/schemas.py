"""
Pydantic Schemas for Local AI Attendance Backend API.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# Health
class HealthResponse(BaseModel):
    status: str = "ok"
    ai_engine_active: bool
    model_loaded: bool
    camera_status: str
    camera_type: str
    enrolled_count: int
    pending_sync_count: int
    version: str = "1.0.0"

# Student & Enrollment
class StudentBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    studentId: str = Field(..., description="Unique student identifier")
    fullName: str
    rollNumber: str
    className: str = Field(..., alias="class")
    section: str
    email: Optional[str] = None
    contactNumber: Optional[str] = None
    enrollmentStatus: Optional[str] = "Not Enrolled"

class StudentEnrollRequest(BaseModel):
    studentId: str
    photosBase64: List[str] = Field(..., description="List of base64 encoded JPG/PNG images")

class StudentEnrollResponse(BaseModel):
    success: bool
    status: str
    studentId: str
    photosProcessed: int
    message: str
    error: Optional[str] = None

# Attendance Sessions
class AttendanceStartRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    className: str = Field(..., alias="class")
    section: str
    date: str
    createdBy: str
    title: Optional[str] = None
    allowDuplicate: Optional[bool] = False

class AttendanceStopRequest(BaseModel):
    sessionId: str

class ManualAttendanceRequest(BaseModel):
    sessionId: str
    studentId: str
    status: str # 'present', 'absent', 'late', 'manually_added'
    userId: str
    reason: str

class FinalizeSessionRequest(BaseModel):
    sessionId: str
    finalizedBy: str
    enrolledStudents: List[Dict[str, Any]]

# Student Directory & Section Management
class StudentRecordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    studentId: Optional[str] = None
    fullName: str
    rollNumber: str
    enrollmentNumber: Optional[str] = None
    className: str = Field("10", alias="class")
    section: str = "A"
    email: Optional[str] = ""
    contactNumber: Optional[str] = ""
    enrollmentStatus: Optional[str] = "Not Enrolled"

class SectionRecordRequest(BaseModel):
    className: str
    sectionName: str
    room: Optional[str] = ""

class SectionAssignRequest(BaseModel):
    studentId: str
    className: str
    sectionName: str


# Camera
class CameraConnectRequest(BaseModel):
    cameraType: str = Field(..., description="MOCK, VIDEO_FILE, RTSP, WEBCAM")
    name: Optional[str] = "Camera"
    ip: Optional[str] = None
    port: Optional[int] = 554
    streamPath: Optional[str] = None
    rtspUrl: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    transport: Optional[str] = "tcp"
    filePath: Optional[str] = None
    deviceIndex: Optional[int] = 0
    width: Optional[int] = 1280
    height: Optional[int] = 720
    fps: Optional[float] = 30.0

class CameraTestRequest(BaseModel):
    cameraType: str
    ip: Optional[str] = None
    port: Optional[int] = 554
    streamPath: Optional[str] = None
    rtspUrl: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    transport: Optional[str] = "tcp"
    filePath: Optional[str] = None
    deviceIndex: Optional[int] = 0
    width: Optional[int] = 1280
    height: Optional[int] = 720

class FrameIngestRequest(BaseModel):
    image: str

# Review
class ReviewResolveRequest(BaseModel):
    action: str = Field(..., description="CONFIRM, REJECT, MANUAL_SELECT, DISMISS")
    assignedStudentId: Optional[str] = None

# Authentication & User Management
class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Email or username")
    password: str

class UserCreateRequest(BaseModel):
    email: str
    password: str
    fullName: str
    role: Optional[str] = "teacher"
    department: Optional[str] = "Faculty of Science"

class UserUpdateRequest(BaseModel):
    fullName: Optional[str] = None
    department: Optional[str] = None
    password: Optional[str] = None
