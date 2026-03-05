"""
Jira Service - business logic for Jira API operations.
"""

import logging
from typing import List, Dict, Optional, Any
import requests

from app.core.constants import JIRA_TESTER_FIELD_NAMES
from app.core.endpoints import (
    ATLASSIAN_RESOURCES_URL,
    get_jira_api_url,
    get_jira_agile_url,
)

logger = logging.getLogger(__name__)


class JiraService:
    """Service for interacting with Jira API using OAuth tokens."""
    
    def __init__(self, access_token: str, cloud_id: str):
        """
        Initialize JiraService with OAuth access token.
        
        Args:
            access_token: Atlassian OAuth access token
            cloud_id: Atlassian Cloud ID for the Jira instance
        """
        self.access_token = access_token
        self.cloud_id = cloud_id
        self.base_url = get_jira_api_url(cloud_id)
        self.agile_url = get_jira_agile_url(cloud_id)
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        self._tester_field_id: Optional[str] = None
    
    def _get(self, url: str, params: Optional[Dict] = None) -> Dict:
        """Make GET request to Jira API."""
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()
    
    def _post(self, url: str, data: Optional[Dict] = None) -> Dict:
        """Make POST request to Jira API."""
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()
    
    def _search_jql(self, jql: str, fields: List[str], max_results: int = 100) -> Dict:
        """
        Search Jira using the new /search/jql endpoint.
        This replaces the deprecated /search endpoint.
        """
        url = f"{self.base_url}/search/jql"
        data = {
            "jql": jql,
            "fields": fields,
            "maxResults": max_results,
        }
        logger.info(f"JQL Search: {jql}")
        return self._post(url, data)
    
    def get_accessible_resources(self) -> List[Dict]:
        """Get accessible Atlassian resources (cloud instances)."""
        response = requests.get(ATLASSIAN_RESOURCES_URL, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_boards(self) -> List[Dict]:
        """Get all boards."""
        url = f"{self.agile_url}/board"
        logger.info(f"Fetching boards from: {url}")
        try:
            data = self._get(url)
            boards = data.get("values", [])
            logger.info(f"Found {len(boards)} boards")
            return boards
        except requests.exceptions.HTTPError as e:
            logger.warning(f"Failed to fetch boards: {e.response.status_code} - {e.response.text}")
            if e.response.status_code == 404:
                return []
            raise
    
    def get_sprints(self, board_id: Optional[int] = None, state: str = "active,future") -> List[Dict]:
        """
        Get sprints from Jira.
        
        Args:
            board_id: Optional board ID to filter sprints
            state: Sprint state filter (active, future, closed)
        """
        logger.info(f"Fetching sprints (board_id={board_id}, state={state})")
        
        if board_id:
            url = f"{self.agile_url}/board/{board_id}/sprint"
            params = {"state": state, "maxResults": 50}
            data = self._get(url, params)
            sprints = data.get("values", [])
            logger.info(f"Found {len(sprints)} sprints for board {board_id}")
            return sprints
        
        # No board_id provided - fetch sprints from all scrum boards
        boards = self.get_boards()
        if not boards:
            logger.warning("No boards found - cannot fetch sprints")
            return []
        
        sprints = []
        seen_ids = set()
        
        # Filter to scrum boards only (kanban boards don't have sprints)
        scrum_boards = [b for b in boards if b.get("type") == "scrum"]
        logger.info(f"Found {len(scrum_boards)} scrum boards out of {len(boards)} total boards")
        
        if not scrum_boards:
            scrum_boards = boards  # Fallback: try all boards
            logger.info("No scrum boards found, trying all boards")
        
        for board in scrum_boards[:10]:  # Check up to 10 boards
            try:
                url = f"{self.agile_url}/board/{board['id']}/sprint"
                data = self._get(url, {"state": state, "maxResults": 50})
                board_sprints = data.get("values", [])
                logger.info(f"Board {board['id']} ({board.get('name', 'unknown')}): {len(board_sprints)} sprints")
                for sprint in board_sprints:
                    if sprint["id"] not in seen_ids:
                        seen_ids.add(sprint["id"])
                        sprints.append(sprint)
            except requests.exceptions.HTTPError as e:
                # Board might not support sprints (e.g., kanban board)
                logger.warning(f"Board {board['id']} sprint fetch failed: {e.response.status_code}")
                if e.response.status_code in (400, 404):
                    continue
                raise
            except Exception as e:
                logger.warning(f"Board {board['id']} sprint fetch error: {str(e)}")
                continue
        
        logger.info(f"Total unique sprints found: {len(sprints)}")
        return sprints
    
    def get_labels(self) -> List[str]:
        """Get all labels from Jira."""
        logger.info("Fetching labels")
        
        # Try the dedicated labels endpoint first
        url = f"{self.base_url}/label"
        try:
            logger.info(f"Trying labels endpoint: {url}")
            data = self._get(url, {"maxResults": 1000})
            labels = data.get("values", [])
            if labels:
                logger.info(f"Found {len(labels)} labels from /label endpoint")
                return labels
            logger.info("Labels endpoint returned empty, trying fallback")
        except requests.exceptions.HTTPError as e:
            logger.warning(f"Labels endpoint failed: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            logger.warning(f"Labels endpoint error: {str(e)}")
        
        # Fallback: get labels from recent issues via JQL search
        try:
            logger.info("Falling back to JQL search for labels")
            data = self._search_jql(
                jql="labels is not EMPTY ORDER BY updated DESC",
                fields=["labels"],
                max_results=100
            )
            labels = set()
            for issue in data.get("issues", []):
                for label in issue.get("fields", {}).get("labels", []):
                    labels.add(label)
            result = sorted(list(labels))
            logger.info(f"Found {len(result)} labels from JQL search")
            return result
        except Exception as e:
            logger.error(f"Labels fallback search failed: {str(e)}")
            return []
    
    def _find_tester_field(self) -> Optional[str]:
        """Find the custom field ID for the Tester field."""
        if self._tester_field_id:
            return self._tester_field_id
        
        url = f"{self.base_url}/field"
        fields = self._get(url)
        
        for field in fields:
            name = field.get("name", "").lower()
            if any(tester_name.lower() in name for tester_name in JIRA_TESTER_FIELD_NAMES):
                self._tester_field_id = field["id"]
                return self._tester_field_id
        
        return None
    
    def get_testers(self) -> List[Dict]:
        """Get list of unique testers from the Tester custom field."""
        tester_field = self._find_tester_field()
        if not tester_field:
            return []
        
        data = self._search_jql(
            jql=f"{tester_field} is not EMPTY",
            fields=[tester_field],
            max_results=100
        )
        
        testers = {}
        for issue in data.get("issues", []):
            tester = issue.get("fields", {}).get(tester_field)
            if tester and isinstance(tester, dict):
                account_id = tester.get("accountId")
                if account_id and account_id not in testers:
                    testers[account_id] = {
                        "accountId": account_id,
                        "displayName": tester.get("displayName", "Unknown"),
                        "emailAddress": tester.get("emailAddress"),
                    }
        
        return list(testers.values())
    
    def get_link_types(self) -> List[Dict]:
        """
        Get all available issue link types from Jira.
        These are the types used in "Link Work Item" feature.
        """
        logger.info("Fetching issue link types")
        url = f"{self.base_url}/issueLinkType"
        
        try:
            data = self._get(url)
            link_types = []
            
            for lt in data.get("issueLinkTypes", []):
                link_types.append({
                    "id": lt.get("id"),
                    "name": lt.get("name"),
                    "inward": lt.get("inward"),
                    "outward": lt.get("outward"),
                })
            
            logger.info(f"Found {len(link_types)} link types")
            return link_types
        except Exception as e:
            logger.error(f"Failed to fetch link types: {str(e)}")
            return []
    
    def get_users(self, query: str = "", max_results: int = 50) -> List[Dict]:
        """
        Get users from Jira for assignee/tester dropdowns.
        
        Args:
            query: Optional search query to filter users
            max_results: Maximum number of results to return
        """
        logger.info(f"Fetching users (query='{query}')")
        
        # Use user search endpoint
        url = f"{self.base_url}/users/search"
        params = {
            "maxResults": max_results,
        }
        if query:
            params["query"] = query
        
        try:
            users = self._get(url, params)
            result = []
            
            for user in users:
                # Skip inactive users
                if not user.get("active", True):
                    continue
                
                result.append({
                    "accountId": user.get("accountId"),
                    "displayName": user.get("displayName", "Unknown"),
                    "emailAddress": user.get("emailAddress"),
                    "avatarUrl": user.get("avatarUrls", {}).get("24x24"),
                })
            
            logger.info(f"Found {len(result)} users")
            return result
        except Exception as e:
            logger.error(f"Failed to fetch users: {str(e)}")
            return []
    
    def get_epics(
        self,
        sprint_id: Optional[str] = None,
        labels: Optional[List[str]] = None,
    ) -> List[Dict]:
        """
        Get epics filtered by labels. Sprint filtering is done by finding
        epics that have child issues in the sprint (since epics themselves
        typically don't have sprints assigned).
        
        Args:
            sprint_id: Optional sprint ID to filter (finds epics with children in sprint)
            labels: Optional list of labels to filter
        """
        logger.info(f"Fetching epics (sprint_id={sprint_id}, labels={labels})")
        
        # If sprint is specified, find epics that have children in that sprint
        if sprint_id:
            return self._get_epics_by_sprint(sprint_id, labels)
        
        # Otherwise, just filter by labels or get all epics
        jql_parts = ['issuetype = Epic']
        
        if labels:
            label_jql = " OR ".join([f'labels = "{label}"' for label in labels])
            jql_parts.append(f"({label_jql})")
        
        jql = " AND ".join(jql_parts)
        
        try:
            data = self._search_jql(
                jql=jql,
                fields=["summary", "description", "labels", "status", "priority", "issuetype"],
                max_results=100
            )
            epics = [self._parse_issue(issue) for issue in data.get("issues", [])]
            logger.info(f"Found {len(epics)} epics")
            return epics
        except requests.exceptions.HTTPError as e:
            error_text = ""
            try:
                error_text = e.response.text
            except:
                pass
            logger.warning(f"Failed to fetch epics with standard query: {e.response.status_code} - {error_text}")
            
            # Try fallback search for any error
            logger.info("Trying fallback search for epics")
            return self._get_epics_fallback(sprint_id, labels)
        except Exception as e:
            logger.warning(f"Unexpected error fetching epics: {str(e)}, trying fallback")
            return self._get_epics_fallback(sprint_id, labels)
    
    def _get_epics_by_sprint(
        self,
        sprint_id: str,
        labels: Optional[List[str]] = None,
    ) -> List[Dict]:
        """
        Find epics that have child issues in the specified sprint.
        This works around the fact that epics don't have sprints directly.
        """
        logger.info(f"Finding epics with children in sprint {sprint_id}")
        
        # First, find all issues in the sprint that have a parent/epic link
        jql = f'Sprint = {sprint_id} AND ("Epic Link" is not EMPTY OR parent is not EMPTY)'
        
        if labels:
            label_jql = " OR ".join([f'labels = "{label}"' for label in labels])
            jql = f'{jql} AND ({label_jql})'
        
        try:
            data = self._search_jql(
                jql=jql,
                fields=["parent", "customfield_10014"],  # parent and Epic Link field
                max_results=100
            )
            
            # Extract unique epic keys from the results
            epic_keys = set()
            for issue in data.get("issues", []):
                fields = issue.get("fields", {})
                # Check parent field (for next-gen projects)
                parent = fields.get("parent")
                if parent and parent.get("key"):
                    epic_keys.add(parent["key"])
                # Check Epic Link field (for classic projects) - customfield_10014 is common
                epic_link = fields.get("customfield_10014")
                if epic_link:
                    epic_keys.add(epic_link)
            
            if not epic_keys:
                logger.info("No epic links found in sprint issues, trying direct epic search")
                # Fallback: try to find epics with the label
                if labels:
                    return self._get_epics_by_labels_only(labels)
                return []
            
            # Now fetch the actual epic details
            epic_jql = f'key in ({",".join(epic_keys)})'
            epic_data = self._search_jql(
                jql=epic_jql,
                fields=["summary", "description", "labels", "status", "priority", "issuetype"],
                max_results=100
            )
            
            epics = [self._parse_issue(issue) for issue in epic_data.get("issues", [])]
            logger.info(f"Found {len(epics)} epics with children in sprint")
            return epics
            
        except Exception as e:
            logger.warning(f"Failed to get epics by sprint: {str(e)}")
            # Fallback to label-only search
            if labels:
                return self._get_epics_by_labels_only(labels)
            return self._get_epics_fallback(None, labels)
    
    def _get_epics_by_labels_only(self, labels: List[str]) -> List[Dict]:
        """Get epics filtered by labels only."""
        label_jql = " OR ".join([f'labels = "{label}"' for label in labels])
        jql = f'issuetype = Epic AND ({label_jql})'
        
        try:
            data = self._search_jql(
                jql=jql,
                fields=["summary", "description", "labels", "status", "priority", "issuetype"],
                max_results=100
            )
            epics = [self._parse_issue(issue) for issue in data.get("issues", [])]
            logger.info(f"Found {len(epics)} epics by labels")
            return epics
        except Exception as e:
            logger.warning(f"Failed to get epics by labels: {str(e)}")
            return []
    
    def _get_epics_fallback(
        self,
        sprint_id: Optional[str] = None,
        labels: Optional[List[str]] = None,
    ) -> List[Dict]:
        """Fallback method to find epic-like issues when Epic type doesn't exist."""
        # Try different JQL queries
        fallback_queries = [
            'ORDER BY updated DESC',  # Get all recent issues
            'project is not EMPTY ORDER BY updated DESC',
        ]
        
        for jql in fallback_queries:
            try:
                logger.info(f"Trying fallback JQL: {jql}")
                data = self._search_jql(
                    jql=jql,
                    fields=["summary", "description", "labels", "status", "priority", "issuetype"],
                    max_results=100
                )
                all_issues = [self._parse_issue(issue) for issue in data.get("issues", [])]
                
                # Filter for epic-like issue types
                epic_types = ["epic", "initiative", "feature", "theme", "story"]
                epics = [i for i in all_issues if i.get("type", "").lower() in epic_types]
                
                # If no epics found, return all issues so user can see what's available
                if not epics and all_issues:
                    logger.info(f"No epic-type issues found, returning all {len(all_issues)} issues")
                    return all_issues
                
                logger.info(f"Fallback found {len(epics)} epic-like issues")
                return epics
            except Exception as e:
                logger.warning(f"Fallback query failed ({jql}): {str(e)}")
                continue
        
        logger.error("All fallback queries failed")
        return []
    
    def get_tasks(
        self,
        epic_key: Optional[str] = None,
        tester: Optional[str] = None,
    ) -> List[Dict]:
        """
        Get child tasks filtered by epic and/or tester.
        Filters out QM project tasks and "Analyze & plan stories" tasks.
        
        Args:
            epic_key: Optional epic key to get child tasks
            tester: Optional tester account ID to filter
        """
        jql_parts = ['issuetype != Epic']
        
        # Filter out QM project tasks
        jql_parts.append('project != QM')
        
        # Filter out completed tasks (Done, Accepted)
        jql_parts.append('status NOT IN (Done, Accepted)')
        
        # Filter out "Analyze & plan stories" tasks
        jql_parts.append('summary !~ "Analyze & plan stories" AND summary !~ "Analyze and plan stories"')
        
        if epic_key:
            jql_parts.append(f'("Epic Link" = {epic_key} OR parent = {epic_key})')
        
        if tester:
            tester_field = self._find_tester_field()
            if tester_field:
                jql_parts.append(f'{tester_field} = "{tester}"')
        
        jql = " AND ".join(jql_parts)
        
        data = self._search_jql(
            jql=jql,
            fields=["summary", "description", "labels", "issuetype", "status", "priority", "parent"],
            max_results=100
        )
        
        # Additional filtering in case JQL didn't catch all variations
        tasks = []
        excluded_statuses = ["done", "accepted", "closed", "resolved"]
        
        for issue in data.get("issues", []):
            parsed = self._parse_issue(issue)
            summary_lower = parsed.get("summary", "").lower()
            status_lower = parsed.get("status", "").lower()
            key = parsed.get("key", "")
            
            # Skip QM project tasks
            if key.startswith("QM-"):
                continue
            
            # Skip completed tasks
            if status_lower in excluded_statuses:
                continue
            
            # Skip "Analyze & plan stories" tasks
            if "analyze" in summary_lower and "plan" in summary_lower and "stories" in summary_lower:
                continue
            
            tasks.append(parsed)
        
        return tasks
    
    def get_epic_with_children(self, epic_key: str) -> Dict:
        """Get epic details along with all child issues."""
        epic = self.get_issue(epic_key)
        children = self.get_tasks(epic_key=epic_key)
        
        return {
            "epic": epic,
            "children": children,
            "total_children": len(children),
        }
    
    def get_issue(self, issue_key: str) -> Dict:
        """Get a single issue by key."""
        url = f"{self.base_url}/issue/{issue_key}"
        params = {"fields": "summary,description,labels,issuetype,status,priority"}
        data = self._get(url, params)
        return self._parse_issue(data)
    
    def _parse_issue(self, data: Dict) -> Dict:
        """Parse issue data into a clean format."""
        fields = data.get("fields", {})
        return {
            "key": data["key"],
            "summary": fields.get("summary", ""),
            "description": self._adf_to_text(fields.get("description")),
            "labels": fields.get("labels", []),
            "type": fields.get("issuetype", {}).get("name", ""),
            "status": fields.get("status", {}).get("name", ""),
            "priority": fields.get("priority", {}).get("name", ""),
        }
    
    def _adf_to_text(self, node: Any, depth: int = 0) -> str:
        """Recursively convert Atlassian Document Format (ADF) to plain text."""
        if node is None:
            return ""
        if isinstance(node, str):
            return node
        if not isinstance(node, dict):
            return ""
        
        if node.get("type") == "text":
            return node.get("text", "")
        if node.get("type") == "hardBreak":
            return "\n"
        
        parts = []
        for child in node.get("content", []):
            text = self._adf_to_text(child, depth + 1)
            if text:
                parts.append(text)
        
        separator = "\n" if node.get("type") in ("paragraph", "listItem", "bulletList", "orderedList") else " "
        return separator.join(p for p in parts if p.strip())
