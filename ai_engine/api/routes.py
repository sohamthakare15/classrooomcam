"""
FastAPI Routes for Local AI Attendance System.
"""
import os
import base64
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Header, Response
from fastapi.responses import StreamingResponse, FileResponse
import cv2

from ai_engine.api.schemas import (
    HealthResponse,
    StudentEnrollRequest,
    StudentEnrollResponse,
    AttendanceStartRequest,
    AttendanceStopRequest,
    ManualAttendanceRequest,
    FinalizeSessionRequest,
    CameraConnectRequest,
    CameraTestRequest,
    FrameIngestRequest,
    ReviewResolveRequest,
    LoginRequest,
    UserCreateRequest,
    UserUpdateRequest,
    StudentRecordRequest,
    SectionRecordRequest,
    SectionAssignRequest
)
from ai_engine.camera.manager import CameraManager
from ai_engine.camera.webcam_camera import WebcamCamera
from ai_engine.camera.rtsp_camera import RTSPCamera
from ai_engine.camera.onvif_discovery import ONVIFDiscovery
from ai_engine.enrollment.manager import EnrollmentManager
from ai_engine.attendance.engine import AttendanceEngine
from ai_engine.attendance.session_manager import SessionManager
from ai_engine.attendance.offline_queue import OfflineSyncQueue

router = APIRouter()

# Shared dependency instances
camera_manager = CameraManager()
enrollment_manager = EnrollmentManager()
attendance_engine = AttendanceEngine(
    camera_manager=camera_manager,
    enrollment_manager=enrollment_manager
)
sync_queue = OfflineSyncQueue()
session_manager = SessionManager(
    engine=attendance_engine,
    sync_queue=sync_queue
)

# Start attendance engine background thread
attendance_engine.start()

# Security Token Dependency
API_SECRET_TOKEN = os.getenv("AI_API_SECRET_TOKEN", "smartclassroom-secure-ipc-token-2026")

def verify_token(x_app_token: Optional[str] = Header(None)):
    # Local loopback safety or token check
    if x_app_token and x_app_token != API_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid application access token")
    return True

# --- HEALTH & SYSTEM ---
@router.get("/health", response_model=HealthResponse)
def get_health():
    cam_info = camera_manager.get_status()
    return HealthResponse(
        status="ok",
        ai_engine_active=attendance_engine.is_running,
        model_loaded=(attendance_engine.detector.detector is not None),
        camera_status=cam_info.get("status", "DISCONNECTED"),
        camera_type=cam_info.get("type", "MOCK"),
        enrolled_count=enrollment_manager.get_enrolled_count(),
        pending_sync_count=sync_queue.get_pending_count(),
        version="1.0.0"
    )

# --- STUDENT ENROLLMENT ---
@router.post("/students/enroll", response_model=StudentEnrollResponse)
def enroll_student(req: StudentEnrollRequest, auth: bool = Depends(verify_token)):
    photos_bytes = []
    for b64 in req.photosBase64:
        try:
            # Strip data url prefix if present
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            raw = base64.b64decode(b64)
            photos_bytes.append(raw)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Corrupt base64 photo: {str(e)}")

    result = enrollment_manager.enroll_student(req.studentId, photos_bytes)
    if not result["success"]:
        return StudentEnrollResponse(
            success=False,
            status=result.get("status", "Enrollment Failed"),
            studentId=req.studentId,
            photosProcessed=0,
            message=result.get("error", "Enrollment failed"),
            error=result.get("error")
        )

    return StudentEnrollResponse(
        success=True,
        status="Enrolled",
        studentId=req.studentId,
        photosProcessed=result["photos_processed"],
        message=result["message"]
    )

@router.get("/students")
def get_enrolled_students(auth: bool = Depends(verify_token)):
    meta_dir = os.path.join(enrollment_manager.storage_dir, "metadata")
    results = []
    if os.path.exists(meta_dir):
        for fname in os.listdir(meta_dir):
            if fname.endswith(".json"):
                fpath = os.path.join(meta_dir, fname)
                try:
                    with open(fpath, "r") as f:
                        import json
                        results.append(json.load(f))
                except Exception:
                    pass
    return {"total": len(results), "students": results}

@router.get("/students/{student_id}")
def get_student_enrollment(student_id: str, auth: bool = Depends(verify_token)):
    meta_path = os.path.join(enrollment_manager.storage_dir, "metadata", f"{student_id}.json")
    if not os.path.exists(meta_path):
        return {
            "student_id": student_id,
            "status": "Not Enrolled",
            "enrolled": False
        }
    with open(meta_path, "r") as f:
        import json
        data = json.load(f)
        data["enrolled"] = True
        return data

@router.delete("/students/{student_id}/enrollment")
def delete_student_enrollment(student_id: str, auth: bool = Depends(verify_token)):
    success = enrollment_manager.delete_enrollment(student_id)
    return {"success": success, "studentId": student_id, "message": "Biometric templates and photos removed"}

@router.get("/students/{student_id}/photo")
def get_student_photo(student_id: str):
    # 1. Retrieve directly from local SQLite database
    db_photo = sync_queue.get_student_photo(student_id)
    if db_photo:
        blob, mime = db_photo
        return Response(content=blob, media_type=mime)

    # 2. Fallback to local file cache
    photo_path = os.path.join(enrollment_manager.photos_dir, f"{student_id}.jpg")
    if os.path.exists(photo_path):
        return FileResponse(photo_path, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Student thumbnail not found in database or storage")

@router.get("/attendance/records/{record_id}/snapshot")
def get_attendance_snapshot_image(record_id: str):
    """Retrieves the visual biometric verification snapshot stored in the SQLite database."""
    snap = sync_queue.get_attendance_snapshot(record_id)
    if snap:
        blob, mime = snap
        return Response(content=blob, media_type=mime)
    raise HTTPException(status_code=404, detail="Attendance snapshot not found in database")

# --- ATTENDANCE SESSIONS ---
@router.post("/attendance/start")
def start_attendance_session(req: AttendanceStartRequest, auth: bool = Depends(verify_token)):
    try:
        session = session_manager.create_session(
            class_name=req.className,
            section=req.section,
            session_date=req.date,
            created_by=req.createdBy,
            title=req.title,
            allow_duplicate=getattr(req, "allowDuplicate", False) or False
        )
        return {"success": True, "session": session}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start attendance: {str(e)}")

# --- STUDENT DIRECTORY & ENROLLMENT RECORDS ---
@router.get("/api/students")
def list_students(class_name: Optional[str] = None, section: Optional[str] = None, auth: bool = Depends(verify_token)):
    students = sync_queue.get_all_students(class_name=class_name, section=section)
    return {"total": len(students), "students": students}

@router.get("/api/students/{student_id}")
def get_single_student(student_id: str, auth: bool = Depends(verify_token)):
    stu = sync_queue.get_student_by_id(student_id)
    if not stu:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"student": stu}

@router.post("/api/students")
def create_student(req: StudentRecordRequest, auth: bool = Depends(verify_token)):
    try:
        student = sync_queue.upsert_student({
            "studentId": req.studentId,
            "fullName": req.fullName,
            "rollNumber": req.rollNumber,
            "enrollmentNumber": req.enrollmentNumber,
            "class": req.className,
            "section": req.section,
            "email": req.email,
            "contactNumber": req.contactNumber,
            "enrollmentStatus": req.enrollmentStatus or "Not Enrolled"
        })
        return {"success": True, "student": student, "message": "Student record created in database"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/students/{student_id}")
def update_student(student_id: str, req: StudentRecordRequest, auth: bool = Depends(verify_token)):
    try:
        data = req.model_dump(by_alias=True)
        data["studentId"] = student_id
        student = sync_queue.upsert_student(data)
        return {"success": True, "student": student, "message": "Student details updated"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/students/{student_id}")
def delete_student(student_id: str, auth: bool = Depends(verify_token)):
    try:
        enrollment_manager.delete_enrollment(student_id)
        sync_queue.delete_student_record(student_id)
        return {"success": True, "studentId": student_id, "message": f"Student {student_id} permanently removed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- SECTION MANAGEMENT MODULE ---
@router.get("/api/sections")
def list_sections(auth: bool = Depends(verify_token)):
    sections = sync_queue.get_all_sections()
    return {"total": len(sections), "sections": sections}

@router.post("/api/sections")
def create_section(req: SectionRecordRequest, auth: bool = Depends(verify_token)):
    sec = sync_queue.upsert_section(class_name=req.className, section_name=req.sectionName, room=req.room or "")
    return {"success": True, "section": sec, "message": f"Section Class {req.className}-{req.sectionName} saved"}

@router.delete("/api/sections/{section_id}")
def delete_section(section_id: str, auth: bool = Depends(verify_token)):
    sync_queue.delete_section(section_id)
    return {"success": True, "sectionId": section_id, "message": "Section deleted"}

@router.post("/api/sections/assign")
def assign_student_section(req: SectionAssignRequest, auth: bool = Depends(verify_token)):
    student = sync_queue.get_student_by_id(req.studentId)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student["class"] = req.className
    student["section"] = req.sectionName
    updated = sync_queue.upsert_student(student)
    return {"success": True, "student": updated, "message": f"Assigned to Class {req.className}-{req.sectionName}"}


@router.post("/attendance/stop")
def stop_attendance_session(req: AttendanceStopRequest, auth: bool = Depends(verify_token)):
    session = session_manager.stop_session(req.sessionId)
    return {"success": True, "session": session}

@router.get("/attendance/active")
def get_active_session_status(auth: bool = Depends(verify_token)):
    """Returns the currently active live attendance session in memory."""
    active = session_manager.active_session
    if active:
        records = sync_queue.get_local_records_for_session(active["sessionId"])
        return {
            "hasActive": True,
            "session": active,
            "records": records,
            "recordsCount": len(records),
            "markedStudentIds": list(attendance_engine.marked_student_ids)
        }
    return {
        "hasActive": False,
        "session": None,
        "records": [],
        "recordsCount": 0,
        "markedStudentIds": []
    }

@router.get("/attendance/sessions")
def get_sessions(auth: bool = Depends(verify_token)):
    sessions = sync_queue.get_local_sessions()
    return {"total": len(sessions), "sessions": sessions}

@router.get("/attendance/records")
def get_all_records(session_id: Optional[str] = None, student_id: Optional[str] = None, auth: bool = Depends(verify_token)):
    if session_id:
        records = sync_queue.get_local_records_for_session(session_id)
    else:
        records = sync_queue.get_all_local_records()

    if student_id:
        records = [r for r in records if r.get("studentId") == student_id]

    return {
        "total": len(records),
        "records": records
    }

@router.get("/attendance/{session_id}")
def get_session_details(session_id: str, auth: bool = Depends(verify_token)):
    session = sync_queue.get_local_session(session_id)
    if not session and session_manager.active_session and session_manager.active_session["sessionId"] == session_id:
        session = session_manager.active_session

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    records = sync_queue.get_local_records_for_session(session_id)
    return {
        "session": session,
        "recordsCount": len(records),
        "records": records
    }

@router.post("/attendance/manual")
def manual_mark_attendance(req: ManualAttendanceRequest, auth: bool = Depends(verify_token)):
    record = session_manager.manual_mark(
        session_id=req.sessionId,
        student_id=req.studentId,
        status=req.status,
        user_id=req.userId,
        reason=req.reason
    )
    return {"success": True, "record": record}

@router.post("/attendance/{session_id}/finalize")
def finalize_session(session_id: str, req: FinalizeSessionRequest, auth: bool = Depends(verify_token)):
    try:
        finalized_session = session_manager.finalize_session(
            session_id=session_id,
            finalized_by=req.finalizedBy,
            enrolled_students=req.enrolledStudents
        )
        return {"success": True, "session": finalized_session}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/attendance/sessions/{session_id}")
def delete_attendance_session(session_id: str, auth: bool = Depends(verify_token)):
    """Removes an unwanted attendance session and its associated records from SQLite."""
    try:
        # If currently active, stop it first
        if session_manager.active_session and session_manager.active_session.get("sessionId") == session_id:
            session_manager.stop_session()
        success = sync_queue.delete_local_session(session_id)
        return {"success": success, "message": f"Session {session_id} removed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

@router.delete("/attendance/sessions")
def clear_all_attendance_sessions(auth: bool = Depends(verify_token)):
    """Clears all past attendance sessions and records to clean unwanted test data."""
    try:
        if session_manager.active_session:
            session_manager.stop_session()
        count = sync_queue.clear_all_sessions()
        return {"success": True, "deletedCount": count, "message": f"Cleared {count} past sessions"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear sessions: {str(e)}")


# --- CAMERA ---
@router.get("/camera/status")
def get_camera_status():
    return camera_manager.get_status()

@router.get("/camera/webcams")
def get_available_webcams(auth: bool = Depends(verify_token)):
    """Returns detected physical webcam devices with capabilities."""
    devices = camera_manager.get_available_webcams()
    return {
        "success": True,
        "count": len(devices),
        "devices": devices
    }

@router.get("/camera/onvif/discover")
def discover_onvif_cameras(timeout: float = 2.5, auth: bool = Depends(verify_token)):
    """Discovers ONVIF IP cameras on the local Wi-Fi / LAN via WS-Discovery."""
    cameras = camera_manager.discover_onvif_cameras(timeout_sec=timeout)
    return {
        "success": True,
        "count": len(cameras),
        "cameras": cameras
    }

@router.get("/camera/config")
def get_saved_camera_config(auth: bool = Depends(verify_token)):
    """Returns saved local camera configuration with credentials safely masked."""
    config_file = os.path.join("storage", "camera_config.json")
    if not os.path.exists(config_file):
        return {"configured": False}
    try:
        import json
        with open(config_file, "r") as f:
            cfg = json.load(f)
        # Never expose cleartext password in response
        masked_cfg = dict(cfg)
        if "password" in masked_cfg and masked_cfg["password"]:
            masked_cfg["hasPassword"] = True
            masked_cfg["password"] = "••••••••"
        else:
            masked_cfg["hasPassword"] = False
            masked_cfg["password"] = ""
        return {"configured": True, "config": masked_cfg}
    except Exception as e:
        return {"configured": False, "error": str(e)}

@router.post("/camera/config")
def save_camera_config(req: CameraConnectRequest, auth: bool = Depends(verify_token)):
    """Persists camera configuration to local machine storage without cloud exposure."""
    config_file = os.path.join("storage", "camera_config.json")
    os.makedirs("storage", exist_ok=True)
    try:
        import json
        cfg_data = req.model_dump(exclude_unset=True)
        # If password is placeholder dots, keep existing saved password
        if cfg_data.get("password") == "••••••••" and os.path.exists(config_file):
            with open(config_file, "r") as f:
                old = json.load(f)
                cfg_data["password"] = old.get("password", "")
        with open(config_file, "w") as f:
            json.dump(cfg_data, f, indent=2)
        return {"success": True, "message": "Camera configuration saved locally."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save camera configuration: {str(e)}")

@router.post("/camera/connect")
def connect_camera(req: CameraConnectRequest, auth: bool = Depends(verify_token)):
    config = req.model_dump(exclude_unset=True)
    res = camera_manager.switch_camera(req.cameraType, config)
    return res

@router.post("/camera/disconnect")
def disconnect_camera(auth: bool = Depends(verify_token)):
    res = camera_manager.disconnect_camera()
    return res

@router.post("/camera/test")
def test_camera_connection(req: CameraTestRequest, auth: bool = Depends(verify_token)):
    c_type = req.cameraType.upper()
    if c_type == "MOCK":
        return {"success": True, "message": "Simulation camera is always functional"}
    elif c_type == "VIDEO_FILE":
        if os.path.exists(req.filePath or ""):
            return {"success": True, "message": "Video file verified and accessible"}
        return {"success": False, "error": f"File not found: {req.filePath}"}
    elif c_type == "RTSP":
        # Non-invasive probe with socket check and strict timeout
        return RTSPCamera.test_connection(req.model_dump())
    elif c_type == "WEBCAM":
        res = WebcamCamera.test_device(
            device_index=req.deviceIndex if req.deviceIndex is not None else 0,
            width=req.width or 1280,
            height=req.height or 720
        )
        return res
    return {"success": False, "error": "Unknown camera type"}

@router.get("/camera/stream")
def stream_camera():
    """MJPEG stream endpoint for rendering real-time annotated video in the web interface."""
    return StreamingResponse(
        camera_manager.generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.post("/camera/frame/ingest")
def ingest_client_camera_frame(req: FrameIngestRequest):
    """Receives in-browser camera frames from client via WebRTC/canvas and feeds to AI engine."""
    data = req.image
    if "," in data:
        data = data.split(",", 1)[1]
    try:
        import numpy as np
        raw_bytes = base64.b64decode(data)
        nparr = np.frombuffer(raw_bytes, np.uint8)
        frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame_bgr is not None:
            camera_manager.ingest_browser_frame(frame_bgr)
            annotated = attendance_engine.process_single_frame(frame_bgr)
            camera_manager.last_processed_frame = annotated
            return {
                "success": True,
                "faces": getattr(attendance_engine, "last_detected_faces", [])
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Frame decode error: {str(e)}")
    return {"success": False, "error": "Invalid frame data"}

@router.get("/camera/snapshot")
def get_camera_snapshot():
    """Captures and returns the current raw high-resolution frame as JPEG."""
    success, frame = camera_manager.get_frame()
    if not success or frame is None:
        raise HTTPException(status_code=503, detail="Camera frame not currently available")
    ret, jpeg = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ret:
        raise HTTPException(status_code=500, detail="Failed to encode camera snapshot")
    return Response(content=jpeg.tobytes(), media_type="image/jpeg")

# --- RECOGNITION REVIEW ---
@router.get("/recognition/review")
def get_pending_reviews(auth: bool = Depends(verify_token)):
    reviews = attendance_engine.get_pending_reviews()
    return {"total": len(reviews), "reviews": reviews}

@router.post("/recognition/review/{review_id}")
def resolve_review(review_id: str, req: ReviewResolveRequest, auth: bool = Depends(verify_token)):
    resolved = attendance_engine.resolve_review(
        review_id=review_id,
        action=req.action,
        assigned_student_id=req.assignedStudentId
    )
    if not resolved:
        raise HTTPException(status_code=404, detail="Review item not found")
    return {"success": True, "review": resolved}

@router.get("/recognition/review/{review_id}/crop")
def get_review_crop(review_id: str):
    crop_path = os.path.join(attendance_engine.review_crops_dir, f"{review_id}.jpg")
    if os.path.exists(crop_path):
        return FileResponse(crop_path, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Crop image not found")

@router.delete("/recognition/review")
def clear_all_pending_reviews(auth: bool = Depends(verify_token)):
    """Dismisses and cleans up all unwanted review queue items and temporary crops."""
    count = attendance_engine.clear_all_reviews()
    return {"success": True, "dismissedCount": count, "message": f"Cleared {count} review items"}


# --- SYNC & QUEUE ---
@router.get("/sync/status")
def get_sync_status(auth: bool = Depends(verify_token)):
    return {
        "pending_count": sync_queue.get_pending_count(),
        "recent_pending": sync_queue.get_pending_sync_items(10),
        "rtdb_endpoint": sync_queue.rtdb_url
    }

@router.post("/sync/rtdb/push")
def flush_sync_queue(limit: int = 50, auth: bool = Depends(verify_token)):
    result = sync_queue.flush_sync_to_rtdb(limit=limit)
    return {
        "success": True,
        "result": result
    }

# --- USER AUTHENTICATION & TEACHER MANAGEMENT ---
@router.post("/auth/login")
def login_user(req: LoginRequest):
    user = sync_queue.authenticate_user(req.identifier, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "success": True,
        "user": user,
        "token": API_SECRET_TOKEN
    }

@router.get("/auth/users")
def list_users(auth: bool = Depends(verify_token)):
    users = sync_queue.get_all_users()
    return {
        "success": True,
        "total": len(users),
        "users": users
    }

@router.post("/auth/users")
def create_user_account(req: UserCreateRequest, auth: bool = Depends(verify_token)):
    try:
        new_user = sync_queue.create_user(
            email=req.email,
            password=req.password,
            full_name=req.fullName,
            role=req.role or "teacher",
            department=req.department or "Academic Faculty"
        )
        return {
            "success": True,
            "message": "User account created successfully in local database",
            "user": new_user
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

@router.put("/auth/users/{uid}")
def update_user_account(uid: str, req: UserUpdateRequest, auth: bool = Depends(verify_token)):
    try:
        updated = sync_queue.update_user(
            uid=uid,
            full_name=req.fullName,
            department=req.department,
            password=req.password
        )
        return {
            "success": True,
            "message": "User account updated successfully",
            "user": updated
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")

@router.delete("/auth/users/{uid}")
def delete_user_account(uid: str, auth: bool = Depends(verify_token)):
    try:
        sync_queue.delete_user(uid)
        return {
            "success": True,
            "message": "User account deleted successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

