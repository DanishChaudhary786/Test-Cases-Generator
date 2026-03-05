"""
Google Sheets Service - business logic for Sheets API operations.
"""

from typing import List, Dict, Optional
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.constants import HEADER_BG_COLOR, HEADER_FONT_COLOR, DEFAULT_SHEET_COLUMNS, SPECIAL_COLUMNS


class SheetsService:
    """Service for interacting with Google Sheets API using OAuth tokens."""
    
    def __init__(self, access_token: str, refresh_token: Optional[str] = None):
        """
        Initialize SheetsService with OAuth access token.
        
        Args:
            access_token: Google OAuth access token
            refresh_token: Optional refresh token for token renewal
        """
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
        )
        self.sheets_service = build("sheets", "v4", credentials=credentials)
        self.drive_service = build("drive", "v3", credentials=credentials)
        self.sheets = self.sheets_service.spreadsheets()
    
    def list_spreadsheets(self) -> List[Dict]:
        """List all spreadsheets accessible to the user."""
        results = self.drive_service.files().list(
            q="mimeType='application/vnd.google-apps.spreadsheet'",
            spaces="drive",
            fields="files(id, name, modifiedTime, webViewLink)",
            orderBy="modifiedTime desc",
            pageSize=50,
        ).execute()
        
        files = results.get("files", [])
        return [
            {
                "id": f["id"],
                "name": f["name"],
                "modifiedTime": f.get("modifiedTime"),
                "url": f.get("webViewLink"),
            }
            for f in files
        ]
    
    def get_subsheets(self, spreadsheet_id: str) -> List[Dict]:
        """Get all subsheets (tabs) in a spreadsheet."""
        spreadsheet = self.sheets.get(spreadsheetId=spreadsheet_id).execute()
        
        return [
            {
                "id": sheet["properties"]["sheetId"],
                "name": sheet["properties"]["title"],
                "index": sheet["properties"]["index"],
            }
            for sheet in spreadsheet.get("sheets", [])
        ]
    
    def create_subsheet(self, spreadsheet_id: str, name: str) -> Dict:
        """Create a new subsheet (tab) in a spreadsheet."""
        body = {
            "requests": [
                {
                    "addSheet": {
                        "properties": {
                            "title": name,
                        }
                    }
                }
            ]
        }
        
        response = self.sheets.batchUpdate(
            spreadsheetId=spreadsheet_id,
            body=body,
        ).execute()
        
        new_sheet = response["replies"][0]["addSheet"]["properties"]
        return {
            "id": new_sheet["sheetId"],
            "name": new_sheet["title"],
            "index": new_sheet["index"],
        }
    
    def write_test_cases(
        self,
        spreadsheet_id: str,
        subsheet_name: str,
        test_cases: List[Dict],
        columns: List[str],
        column_defaults: Optional[Dict[str, str]] = None,
    ) -> Dict:
        """
        Write test cases to a subsheet with formatting.
        
        Args:
            spreadsheet_id: Google Sheet ID
            subsheet_name: Name of the subsheet (tab)
            test_cases: List of test case dicts
            columns: List of column names
            column_defaults: Optional dict of column index to default value
        
        Returns:
            Dict with write results
        """
        # Get or create the tab
        tab_id = self._get_or_create_tab(spreadsheet_id, subsheet_name)
        
        # Build rows
        rows = self._build_rows(test_cases, columns, column_defaults)
        
        # Write data
        self._write_data(spreadsheet_id, subsheet_name, rows)
        
        # Apply formatting
        self._apply_formatting(spreadsheet_id, tab_id, len(rows), len(columns))
        
        return {
            "tab_name": subsheet_name,
            "tab_id": tab_id,
            "rows_written": len(rows),
            "test_cases_count": len(test_cases),
        }
    
    def _get_or_create_tab(self, spreadsheet_id: str, tab_name: str) -> int:
        """Get existing tab or create new one."""
        subsheets = self.get_subsheets(spreadsheet_id)
        
        for sheet in subsheets:
            if sheet["name"] == tab_name:
                # Clear existing content
                self.sheets.values().clear(
                    spreadsheetId=spreadsheet_id,
                    range=f"'{tab_name}'",
                ).execute()
                return sheet["id"]
        
        # Create new tab
        new_sheet = self.create_subsheet(spreadsheet_id, tab_name)
        return new_sheet["id"]
    
    def _build_rows(
        self,
        test_cases: List[Dict],
        columns: List[str],
        column_defaults: Optional[Dict[str, str]] = None,
    ) -> List[List]:
        """
        Build rows for the sheet, grouping by Jira ID with empty rows between groups.
        
        Handles special columns:
        - ExternalID: Auto-incremented value (1, 2, 3, ... N)
        - Sprint, Tester, Assignee, Link-type: Uses the value from column_defaults (ID/accountId)
        """
        rows = [columns]  # Header row
        
        # Convert column_defaults keys to integers if they're strings
        defaults = {}
        if column_defaults:
            for key, value in column_defaults.items():
                defaults[int(key)] = value
        
        # Identify special columns for auto-increment
        external_id_col_idx = None
        for idx, col in enumerate(columns):
            col_lower = col.lower().strip()
            if col_lower == "externalid":
                external_id_col_idx = idx
                break
        
        # Sort test cases by Jira ID
        sorted_cases = sorted(test_cases, key=lambda tc: tc.get("jira", ""))
        
        current_jira = None
        row_counter = 0  # For ExternalID auto-increment
        
        for tc in sorted_cases:
            jira_id = tc.get("jira", "")
            
            # Add empty row when Jira ID changes (except for first)
            if current_jira is not None and jira_id != current_jira:
                rows.append([""] * len(columns))
            
            current_jira = jira_id
            row_counter += 1
            
            # Format description as bullet points
            description = tc.get("description", "")
            if isinstance(description, list):
                # Join points, only add "- " prefix if not already present
                formatted_points = []
                for point in description:
                    point = point.strip()
                    if point.startswith("- "):
                        formatted_points.append(point)
                    else:
                        formatted_points.append(f"- {point}")
                description = "\n".join(formatted_points)
            
            # Build row based on columns
            row = []
            for col_idx, col in enumerate(columns):
                col_lower = col.lower().strip()
                
                # Handle ExternalID with auto-increment
                if col_idx == external_id_col_idx:
                    row.append(str(row_counter))
                    continue
                
                # Check if this is a special column with dropdown value
                special_config = SPECIAL_COLUMNS.get(col_lower)
                if special_config and special_config["type"] == "dropdown" and col_idx in defaults:
                    # Use the selected ID/value from defaults
                    row.append(defaults[col_idx])
                    continue
                
                # Check if there's a default value for this column (regular default)
                if col_idx in defaults:
                    row.append(defaults[col_idx])
                    continue
                
                # Standard column mapping
                if col_lower == "name":
                    row.append(tc.get("name", ""))
                elif col_lower == "description":
                    row.append(description)
                elif col_lower == "jira":
                    row.append(jira_id)
                elif col_lower == "labels":
                    row.append(tc.get("labels", ""))
                else:
                    row.append(tc.get(col_lower, ""))
            
            rows.append(row)
        
        return rows
    
    def _write_data(self, spreadsheet_id: str, tab_name: str, rows: List[List]):
        """Write data to the sheet."""
        body = {"values": rows}
        self.sheets.values().update(
            spreadsheetId=spreadsheet_id,
            range=f"'{tab_name}'!A1",
            valueInputOption="RAW",
            body=body,
        ).execute()
    
    def _apply_formatting(
        self,
        spreadsheet_id: str,
        tab_id: int,
        total_rows: int,
        total_cols: int,
    ):
        """Apply formatting to the sheet."""
        requests = []
        
        # Header styling
        requests.append({
            "repeatCell": {
                "range": {"sheetId": tab_id, "startRowIndex": 0, "endRowIndex": 1},
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": HEADER_BG_COLOR,
                        "textFormat": {
                            "foregroundColor": HEADER_FONT_COLOR,
                            "bold": True,
                            "fontSize": 11,
                        },
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                        "wrapStrategy": "WRAP",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
            }
        })
        
        # Freeze header row
        requests.append({
            "updateSheetProperties": {
                "properties": {
                    "sheetId": tab_id,
                    "gridProperties": {"frozenRowCount": 1},
                },
                "fields": "gridProperties.frozenRowCount",
            }
        })
        
        # Wrap text for data cells
        requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": tab_id,
                    "startRowIndex": 1,
                    "endRowIndex": total_rows,
                },
                "cell": {
                    "userEnteredFormat": {
                        "wrapStrategy": "WRAP",
                        "verticalAlignment": "TOP",
                        "textFormat": {"fontSize": 10},
                    }
                },
                "fields": "userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)",
            }
        })
        
        # Column widths
        col_widths = [280, 520, 100, 180] + [150] * (total_cols - 4)
        for col_idx, width in enumerate(col_widths[:total_cols]):
            requests.append({
                "updateDimensionProperties": {
                    "range": {
                        "sheetId": tab_id,
                        "dimension": "COLUMNS",
                        "startIndex": col_idx,
                        "endIndex": col_idx + 1,
                    },
                    "properties": {"pixelSize": width},
                    "fields": "pixelSize",
                }
            })
        
        # Bold first column (Name)
        requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": tab_id,
                    "startRowIndex": 1,
                    "endRowIndex": total_rows,
                    "startColumnIndex": 0,
                    "endColumnIndex": 1,
                },
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {"bold": True, "fontSize": 10}
                    }
                },
                "fields": "userEnteredFormat.textFormat",
            }
        })
        
        # Header row height
        requests.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": tab_id,
                    "dimension": "ROWS",
                    "startIndex": 0,
                    "endIndex": 1,
                },
                "properties": {"pixelSize": 40},
                "fields": "pixelSize",
            }
        })
        
        # Light borders
        requests.append({
            "updateBorders": {
                "range": {
                    "sheetId": tab_id,
                    "startRowIndex": 0,
                    "endRowIndex": total_rows,
                    "startColumnIndex": 0,
                    "endColumnIndex": total_cols,
                },
                "top": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
                "bottom": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
                "left": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
                "right": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
                "innerHorizontal": {"style": "SOLID", "color": {"red": 0.9, "green": 0.9, "blue": 0.9}},
                "innerVertical": {"style": "SOLID", "color": {"red": 0.9, "green": 0.9, "blue": 0.9}},
            }
        })
        
        self.sheets.batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": requests},
        ).execute()
