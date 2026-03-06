"""
Test case generation endpoints with progress streaming.
"""

import json
import uuid
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core import settings, GenerationStatus
from app.core.endpoints import GenerateRoutes, get_sheet_url
from app.services.jira_service import JiraService
from app.services.sheets_service import SheetsService
from app.services.ai_service import AIService
from app.core.token_store import get_tokens

router = APIRouter()

SESSION_ID_KEY = "sid"


def get_session_id(request: Request, x_session_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get session ID from header or session cookie."""
    if x_session_id:
        return x_session_id
    return request.session.get(SESSION_ID_KEY)

# In-memory storage for generation jobs (in production, use Redis or similar)
generation_jobs: Dict[str, Dict[str, Any]] = {}


class GenerateRequest(BaseModel):
    """Request body for test case generation."""
    epic_key: str
    task_keys: List[str]
    sheet_id: str
    subsheet_name: str
    columns: List[str]
    column_defaults: Optional[Dict[str, str]] = None
    ai_provider: str = "anthropic"
    ai_api_key: Optional[str] = None


class GenerationProgress:
    """Tracks generation progress."""
    
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.messages: List[str] = []
        self.status = GenerationStatus.PENDING
        self.result: Optional[Dict] = None
        self.error: Optional[str] = None
    
    def update(self, message: str):
        self.messages.append(message)
        generation_jobs[self.job_id]["messages"] = self.messages
    
    def set_status(self, status: str):
        self.status = status
        generation_jobs[self.job_id]["status"] = status
    
    def set_result(self, result: Dict):
        self.result = result
        generation_jobs[self.job_id]["result"] = result
    
    def set_error(self, error: str):
        self.error = error
        generation_jobs[self.job_id]["error"] = error


@router.get(GenerateRoutes.PROVIDERS)
async def get_available_providers():
    """
    Returns the list of AI providers that have API keys configured.
    Only providers with keys available in .env will be returned.
    """
    providers = []
    
    if settings.ANTHROPIC_API_KEY:
        providers.append({
            "value": "anthropic",
            "label": "Anthropic (Claude)",
            "description": "Recommended"
        })
    
    if settings.OPENAI_API_KEY:
        providers.append({
            "value": "openai",
            "label": "OpenAI (GPT-4)"
        })
    
    if settings.GOOGLE_AI_API_KEY:
        providers.append({
            "value": "gemini",
            "label": "Google (Gemini)"
        })
    
    if settings.DEEPSEEK_API_KEY:
        providers.append({
            "value": "deepseek",
            "label": "DeepSeek"
        })
    
    return {"providers": providers}


async def run_generation(
    job_id: str,
    request_data: GenerateRequest,
    jira_token: str,
    jira_cloud_id: str,
    google_token: str,
    google_refresh_token: Optional[str],
):
    """Background task to run the generation pipeline."""
    progress = GenerationProgress(job_id)
    
    try:
        progress.set_status(GenerationStatus.IN_PROGRESS)
        
        # Step 1: Fetch Jira data
        progress.update("Initializing Jira connection...")
        jira = JiraService(access_token=jira_token, cloud_id=jira_cloud_id)
        
        progress.update(f"Fetching Epic: {request_data.epic_key}...")
        epic = jira.get_issue(request_data.epic_key)
        progress.update(f"Found Epic: {epic['summary']}")
        
        # Fetch child tasks
        progress.update(f"Fetching {len(request_data.task_keys)} tasks...")
        issues = []
        for task_key in request_data.task_keys:
            try:
                issue = jira.get_issue(task_key)
                issues.append(issue)
                progress.update(f"  - {task_key}: {issue['summary'][:50]}...")
            except Exception as e:
                progress.update(f"  - {task_key}: Error fetching ({str(e)[:30]})")
        
        progress.update(f"Total issues to analyze: {len(issues)}")
        
        # Step 2: Generate test cases with AI
        api_key = request_data.ai_api_key or getattr(settings, f"{request_data.ai_provider.upper()}_API_KEY", None)
        
        if not api_key:
            raise ValueError(f"No API key provided for {request_data.ai_provider}")
        
        progress.update(f"Generating test cases with {request_data.ai_provider.upper()}...")
        
        ai_service = AIService(
            provider=request_data.ai_provider,
            api_key=api_key,
        )
        
        test_cases = ai_service.generate_test_cases(
            epic=epic,
            issues=issues,
            progress_callback=lambda msg: progress.update(msg),
        )
        
        progress.update(f"Generated {len(test_cases)} test cases")
        
        # Log grouping by Jira ID
        jira_groups = {}
        for tc in test_cases:
            jira_id = tc.get("jira", "Unknown")
            jira_groups[jira_id] = jira_groups.get(jira_id, 0) + 1
        
        progress.update("Test cases grouped by Jira ID:")
        for jira_id in sorted(jira_groups.keys()):
            progress.update(f"  - {jira_id}: {jira_groups[jira_id]} test cases")
        
        # Step 3: Write to Google Sheets
        progress.update("Connecting to Google Sheets...")
        sheets = SheetsService(
            access_token=google_token,
            refresh_token=google_refresh_token,
        )
        
        progress.update(f"Writing to sheet: {request_data.subsheet_name}...")
        result = sheets.write_test_cases(
            spreadsheet_id=request_data.sheet_id,
            subsheet_name=request_data.subsheet_name,
            test_cases=test_cases,
            columns=request_data.columns,
            column_defaults=request_data.column_defaults,
        )
        
        progress.update(f"Written {result['rows_written']} rows to '{result['tab_name']}'")
        
        # Complete - include tab_id in URL to open specific subsheet
        sheet_url = get_sheet_url(request_data.sheet_id, result.get("tab_id"))
        progress.set_result({
            "success": True,
            "test_cases_count": len(test_cases),
            "rows_written": result["rows_written"],
            "tab_name": result["tab_name"],
            "tab_id": result.get("tab_id"),
            "sheet_id": request_data.sheet_id,
            "sheet_url": sheet_url,
        })
        progress.set_status(GenerationStatus.COMPLETED)
        progress.update(f"Completed! View sheet: {sheet_url}")
        
    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        progress.set_error(error_msg)
        progress.set_status(GenerationStatus.FAILED)
        progress.update(f"Error: {str(e)}")


@router.post(GenerateRoutes.ROOT)
async def generate_test_cases(
    request: Request,
    body: GenerateRequest,
    background_tasks: BackgroundTasks,
    x_session_id: Optional[str] = Header(None),
):
    """Start test case generation process."""
    # Verify authentication using token store
    session_id = get_session_id(request, x_session_id)
    
    atlassian_tokens = get_tokens(session_id, "atlassian") if session_id else None
    google_tokens = get_tokens(session_id, "google") if session_id else None
    
    if not atlassian_tokens or not atlassian_tokens.get("access_token"):
        raise HTTPException(
            status_code=401,
            detail="Not authenticated with Atlassian"
        )
    
    if not google_tokens or not google_tokens.get("access_token"):
        raise HTTPException(
            status_code=401,
            detail="Not authenticated with Google"
        )
    
    # Create job
    job_id = str(uuid.uuid4())
    generation_jobs[job_id] = {
        "id": job_id,
        "status": GenerationStatus.PENDING,
        "messages": [],
        "result": None,
        "error": None,
    }
    
    # Start background task with tokens from token store
    background_tasks.add_task(
        run_generation,
        job_id,
        body,
        atlassian_tokens["access_token"],
        atlassian_tokens.get("cloud_id"),
        google_tokens["access_token"],
        google_tokens.get("refresh_token"),
    )
    
    return {"job_id": job_id}


@router.get(GenerateRoutes.STATUS)
async def get_generation_status(request: Request, job_id: str):
    """Get the status of a generation job."""
    if job_id not in generation_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = generation_jobs[job_id]
    return {
        "id": job["id"],
        "status": job["status"],
        "messages": job["messages"],
        "result": job["result"],
        "error": job["error"],
    }


@router.get(GenerateRoutes.STREAM)
async def stream_generation_status(request: Request, job_id: str):
    """Stream generation status updates via Server-Sent Events."""
    if job_id not in generation_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    async def event_generator():
        last_message_count = 0
        
        while True:
            job = generation_jobs.get(job_id)
            if not job:
                yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                break
            
            # Send new messages
            current_messages = job.get("messages", [])
            if len(current_messages) > last_message_count:
                new_messages = current_messages[last_message_count:]
                for msg in new_messages:
                    yield f"data: {json.dumps({'type': 'message', 'message': msg})}\n\n"
                last_message_count = len(current_messages)
            
            # Check if complete
            status = job.get("status")
            if status == GenerationStatus.COMPLETED:
                yield f"data: {json.dumps({'type': 'complete', 'result': job.get('result')})}\n\n"
                break
            elif status == GenerationStatus.FAILED:
                yield f"data: {json.dumps({'type': 'error', 'error': job.get('error')})}\n\n"
                break
            
            await asyncio.sleep(0.5)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.delete(GenerateRoutes.CANCEL)
async def cancel_generation(request: Request, job_id: str):
    """Cancel and cleanup a generation job."""
    if job_id in generation_jobs:
        del generation_jobs[job_id]
        return {"message": "Job cancelled"}
    raise HTTPException(status_code=404, detail="Job not found")
