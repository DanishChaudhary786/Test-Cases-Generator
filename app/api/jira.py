"""
Jira API endpoints for fetching sprints, labels, epics, and tasks.
"""

from fastapi import APIRouter, Request, HTTPException, Query, Depends
from typing import Optional, List

from app.services.jira_service import JiraService
from app.core.endpoints import JiraRoutes
from app.core.token_store import get_tokens

router = APIRouter()

SESSION_ID_KEY = "sid"


def get_jira_service(request: Request) -> JiraService:
    """Dependency to get authenticated JiraService."""
    session_id = request.session.get(SESSION_ID_KEY)
    atlassian_tokens = get_tokens(session_id, "atlassian") if session_id else None
    
    if not atlassian_tokens or not atlassian_tokens.get("access_token"):
        raise HTTPException(
            status_code=401,
            detail="Not authenticated with Atlassian. Please sign in first."
        )
    
    cloud_id = atlassian_tokens.get("cloud_id")
    if not cloud_id:
        raise HTTPException(
            status_code=400,
            detail="Missing Jira Cloud ID. Please re-authenticate with Atlassian."
        )
    
    return JiraService(
        access_token=atlassian_tokens["access_token"],
        cloud_id=cloud_id,
    )


@router.get(JiraRoutes.BOARDS)
async def get_boards(
    request: Request,
    jira: JiraService = Depends(get_jira_service),
):
    """Get all boards from Jira."""
    try:
        boards = jira.get_boards()
        return {
            "boards": [
                {
                    "id": b["id"],
                    "name": b["name"],
                    "type": b.get("type", "unknown"),
                }
                for b in boards
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(JiraRoutes.SPRINTS)
async def get_sprints(
    request: Request,
    board_id: Optional[int] = Query(None, description="Filter by board ID"),
    state: str = Query("active,future", description="Sprint state filter"),
    jira: JiraService = Depends(get_jira_service),
):
    """Get all sprints from Jira."""
    try:
        sprints = jira.get_sprints(board_id=board_id, state=state)
        return {
            "sprints": [
                {
                    "id": s["id"],
                    "name": s["name"],
                    "state": s.get("state", "unknown"),
                    "startDate": s.get("startDate"),
                    "endDate": s.get("endDate"),
                    "goal": s.get("goal"),
                }
                for s in sprints
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch sprints: {str(e)}")


@router.get(JiraRoutes.LABELS)
async def get_labels(
    request: Request,
    jira: JiraService = Depends(get_jira_service),
):
    """Get all available labels from Jira."""
    try:
        labels = jira.get_labels()
        return {"labels": labels}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch labels: {str(e)}")


@router.get(JiraRoutes.EPICS)
async def get_epics(
    request: Request,
    sprint_id: Optional[str] = Query(None, description="Filter by sprint ID"),
    labels: Optional[str] = Query(None, description="Comma-separated labels to filter"),
    jira: JiraService = Depends(get_jira_service),
):
    """Get epics filtered by sprint and/or labels."""
    try:
        label_list = labels.split(",") if labels else None
        epics = jira.get_epics(sprint_id=sprint_id, labels=label_list)
        return {"epics": epics}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Return empty list instead of error to allow frontend to continue
        return {"epics": [], "error": str(e)}


@router.get(JiraRoutes.TASKS)
async def get_tasks(
    request: Request,
    epic_key: Optional[str] = Query(None, description="Filter by epic key"),
    tester: Optional[str] = Query(None, description="Filter by tester account ID"),
    jira: JiraService = Depends(get_jira_service),
):
    """Get child tasks filtered by epic and/or tester."""
    try:
        tasks = jira.get_tasks(epic_key=epic_key, tester=tester)
        return {"tasks": tasks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(JiraRoutes.TESTERS)
async def get_testers(
    request: Request,
    jira: JiraService = Depends(get_jira_service),
):
    """Get list of available testers from Jira custom field."""
    try:
        testers = jira.get_testers()
        return {"testers": testers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(JiraRoutes.LINK_TYPES)
async def get_link_types(
    request: Request,
    jira: JiraService = Depends(get_jira_service),
):
    """Get all available issue link types from Jira (used in Link Work Item)."""
    try:
        link_types = jira.get_link_types()
        return {"link_types": link_types}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(JiraRoutes.USERS)
async def get_users(
    request: Request,
    query: str = Query("", description="Search query for user name/email"),
    jira: JiraService = Depends(get_jira_service),
):
    """Get users from Jira for assignee/tester selection."""
    try:
        users = jira.get_users(query=query)
        return {"users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(JiraRoutes.ISSUE)
async def get_issue(
    request: Request,
    issue_key: str,
    jira: JiraService = Depends(get_jira_service),
):
    """Get a single issue by key."""
    try:
        issue = jira.get_issue(issue_key)
        return {"issue": issue}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(JiraRoutes.EPIC_CHILDREN)
async def get_epic_with_children(
    request: Request,
    epic_key: str,
    jira: JiraService = Depends(get_jira_service),
):
    """Get epic details along with all child issues."""
    try:
        data = jira.get_epic_with_children(epic_key)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(JiraRoutes.ISSUE_COMMENT)
async def add_comment(
    request: Request,
    issue_key: str,
    jira: JiraService = Depends(get_jira_service),
):
    """Add a comment to a Jira issue."""
    try:
        body = await request.json()
        comment_body = body.get("body", "")
        mentions = body.get("mentions", [])
        
        if not comment_body:
            raise HTTPException(status_code=400, detail="Comment body is required")
        
        result = jira.add_comment(issue_key, comment_body, mentions)
        return {"success": True, "comment": result}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to add comment: {str(e)}")


@router.get("/debug")
async def debug_jira(
    request: Request,
    jira: JiraService = Depends(get_jira_service),
):
    """Debug endpoint to test Jira connectivity and list issue types."""
    results = {
        "cloud_id": jira.cloud_id,
        "base_url": jira.base_url,
        "agile_url": jira.agile_url,
    }
    
    # Get issue types
    try:
        url = f"{jira.base_url}/issuetype"
        issue_types = jira._get(url)
        results["issue_types"] = [
            {"id": it["id"], "name": it["name"], "subtask": it.get("subtask", False)}
            for it in issue_types
        ]
    except Exception as e:
        results["issue_types_error"] = str(e)
    
    # Test basic search using new API
    try:
        data = jira._search_jql(
            jql="ORDER BY updated DESC",
            fields=["summary", "issuetype"],
            max_results=5
        )
        results["recent_issues"] = [
            {
                "key": i["key"],
                "summary": i["fields"].get("summary", "")[:50],
                "type": i["fields"].get("issuetype", {}).get("name", "unknown")
            }
            for i in data.get("issues", [])
        ]
        results["total_issues"] = data.get("total", 0)
    except Exception as e:
        results["search_error"] = str(e)
    
    # Get boards
    try:
        boards = jira.get_boards()
        results["boards"] = [{"id": b["id"], "name": b["name"], "type": b.get("type")} for b in boards[:5]]
        results["total_boards"] = len(boards)
    except Exception as e:
        results["boards_error"] = str(e)
    
    return results
