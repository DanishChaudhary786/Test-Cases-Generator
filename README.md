# Test Case Generator

A web application that generates test cases from Jira data using AI and writes them to Google Sheets.

## Features

- **Google OAuth**: Sign in with Google for Sheets access
- **Atlassian OAuth**: Sign in with Atlassian for Jira access
- **4-Step Wizard UI**: Guided workflow for test case generation
- **AI Providers**: Support for Anthropic (Claude), OpenAI (GPT-4), and Google (Gemini)
- **Real-time Progress**: Server-Sent Events for live generation updates
- **Customizable Output**: Configure sheet columns and labels

## Project Structure

```
TestCaseCreation/
├── app/                  # FastAPI Backend
│   ├── api/              # REST API endpoints
│   ├── services/         # Business logic
│   └── core/             # Config & constants
├── frontend/             # React Frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── contexts/     # React contexts
│   │   ├── lib/          # API client & utilities
│   │   └── types/        # TypeScript types
│   └── package.json
├── main.py               # Backend entry point
├── requirements.txt      # Python dependencies
├── .env.example          # Environment template
└── README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- Google Cloud Console project with OAuth credentials
- Atlassian Developer account with OAuth app

## Setup

### 1. Backend Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file and configure
cp .env.example .env
# Edit .env with your OAuth credentials and API keys
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

### 3. OAuth Configuration

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Sheets API and Google Drive API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:8000/api/auth/google/callback`
6. Copy Client ID and Secret to `.env`

#### Atlassian OAuth
1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Create a new OAuth 2.0 app
3. Add scopes: `read:jira-work`, `read:jira-user`, `read:sprint:jira-software`, `read:board:jira-software`, `offline_access`
4. Add callback URL: `http://localhost:8000/api/auth/atlassian/callback`
5. Copy Client ID and Secret to `.env`

## Running the Application

### Development Mode

```bash
# Terminal 1: Start backend
source venv/bin/activate
python main.py
# Or: uvicorn app.main:app --reload --port 8000

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Access the application at http://localhost:5173

## API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/atlassian` - Initiate Atlassian OAuth
- `GET /api/auth/atlassian/callback` - Atlassian OAuth callback
- `GET /api/auth/status` - Check auth status

### Jira
- `GET /api/jira/sprints` - Get all sprints
- `GET /api/jira/labels` - Get all labels
- `GET /api/jira/epics` - Get epics (filtered by sprint/labels)
- `GET /api/jira/tasks` - Get tasks (filtered by epic/tester)
- `GET /api/jira/testers` - Get testers

### Google Sheets
- `GET /api/sheets/list` - List user's sheets
- `GET /api/sheets/{id}/subsheets` - Get subsheets
- `POST /api/sheets/{id}/subsheets` - Create subsheet

### Generation
- `POST /api/generate` - Start generation
- `GET /api/generate/status/{job_id}` - Get status
- `GET /api/generate/stream/{job_id}` - SSE stream

## Workflow

1. **Sign In**: Authenticate with Google and Atlassian
2. **Jira Setup**: Select sprint, labels, epic, and tasks
3. **Sheet Config**: Choose sheet, tab, and columns
4. **Generate**: Start AI generation and view progress

## Test Case Format

Test cases are grouped by Jira ID with empty rows as separators:

```
WOT-123 | Test case 1
WOT-123 | Test case 2
        | (empty row)
WOT-456 | Test case 1
WOT-456 | Test case 2
```

## Tech Stack

**Backend:**
- FastAPI
- Authlib (OAuth)
- Google API Python Client
- Anthropic/OpenAI/Google AI SDKs

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Query
- Lucide Icons

## License

MIT
