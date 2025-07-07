# AI-Powered Email Categorization and Management System

This project fetches emails from multiple IMAP accounts, automatically categorizes them using AI (Google Gemini), indexes them into Elasticsearch, and provides a web UI for viewing, searching, filtering, and interacting with the emails, including AI-powered reply suggestions.

## Features

**Backend:**

*   **Multi-Account IMAP Fetching:** Connects to multiple IMAP accounts defined in environment variables.
*   **Comprehensive Initial Scan:** Fetches emails from all selectable folders during the initial run.
*   **Real-time INBOX Monitoring:** Uses IMAP IDLE to process new emails arriving in the INBOX in near real-time.
*   **Duplicate Prevention:** Avoids re-processing/re-indexing emails already present in Elasticsearch or handled within the current run.
*   **AI Categorization:** Uses Google Gemini API to categorize emails into predefined labels (Interested, Meeting Booked, Not Interested, Spam, Out of Office, Other).
*   **Elasticsearch Indexing:** Stores processed email data (including category) in Elasticsearch for efficient searching and retrieval.
*   **Slack Notifications:** Sends notifications to a configured Slack channel for newly categorized "Interested" emails.
*   **Webhook Triggers:** Sends the full email data to a configured webhook URL for "Interested" emails, enabling external automation .
*   **AI Reply Suggestions:** Provides an API endpoint to generate professional reply suggestions based on the original email content and a specified intent (using Google Gemini).
*   **Configurable:** Uses environment variables for credentials, API keys, and service URLs.

**Frontend:**

*   **Email Display:** Shows fetched emails in a sortable, filterable table view.
*   **Filtering:** Allows filtering emails by Account, Folder, and AI Category.
*   **Search:** Provides a search bar that queries the Elasticsearch backend across subject, body, sender, etc.
*   **Full Email View:** Opens a dialog to display the full details of an email.
*   **AI Reply Suggestions:** Allows users to select a reply intent within the email view dialog and receive AI-generated reply suggestions.
*   **UI Components:** Built with React, TypeScript, Shadcn/ui, and Tailwind CSS.

## Architecture

The system follows this general flow:

1.  **IMAP Fetcher (Backend - Node.js/Imapflow):**
    *   Connects to specified IMAP servers.
    *   Lists all folders and performs an initial scan, fetching emails within a defined period (e.g., last 30 days).
    *   Establishes an IDLE connection to the INBOX for real-time monitoring.
    *   Passes fetched email sources to the Parser.

2.  **Parser (Backend - mailparser):**
    *   Parses the raw email source into structured data (subject, from, to, text, html, date, etc.).

3.  **Duplicate Check (Backend - Elasticsearch Client):**
    *   Checks if an email with the same Message-ID (or fallback identifier) already exists in Elasticsearch before further processing.

4.  **AI Categorizer (Backend - Google Gemini API):**
    *   Sends the parsed email content (subject, body) to the Gemini API with a specific prompt for categorization.
    *   Receives the category label (e.g., "Interested", "Spam").

5.  **Elasticsearch Indexer (Backend - Elasticsearch Client):**
    *   Indexes the structured email data, including the AI category and folder name, into Elasticsearch, using the Message-ID or a fallback as the document ID.

6.  **Notification/Webhook Trigger (Backend - Axios):**
    *   If an email is categorized as "Interested", sends notifications/data via HTTP POST requests to the configured Slack and generic webhook URLs.

7.  **API Server (Backend - Node.js/Express):**
    *   Exposes endpoints:
        *   `GET /api/emails`: For the frontend to fetch/search/filter emails from Elasticsearch. Includes aggregations for dynamic filter options.
        *   `POST /api/emails/:id/suggest-reply`: Accepts an email ID and reply intent, fetches the original email from Elasticsearch, calls the AI suggestion service, and returns suggestions.

8.  **Frontend UI (React/Shadcn/Tailwind):**
    *   Calls the `GET /api/emails` endpoint based on user interactions (search, filter selection).
    *   Displays the email list using a table component.
    *   Provides filter dropdowns and a search input.
    *   Includes a "View" button per email to open a dialog.
    *   The dialog displays email details and provides an interface to call the `POST /api/emails/:id/suggest-reply` endpoint and display the AI suggestions.




## Setup Instructions 

1.  **Clone Repository:**

2.  **Install Dependencies:**

3.  **Configure Environment (`.env`):**
    *   Create a `.env` file in the backend.
    *   Add and configure the following variables:
        *   **IMAP Credentials:** `IMAP_USER1`, `IMAP_PASS1`, `IMAP_HOST1`, `IMAP_PORT1` (and pairs for other accounts like `IMAP_USER2`...).
        *   **Elasticsearch:** `ELASTICSEARCH_URL` (e.g., `http://localhost:9200`), `ELASTIC_USER=elastic`, `ELASTIC_PASSWORD` (set a strong password, default `changeme` used by `docker-compose.yml` if not set).
        *   **API Keys:** `GOOGLE_API_KEY` (from Google AI Studio).
        *   **Webhook URLs (Optional):** `SLACK_WEBHOOK_URL`, `INTERESTED_WEBHOOK_URL`.

4.  **Start Elasticsearch (Docker):**
    *   Wait ~1-2 minutes for Elasticsearch to initialize on first run.

5.  **Run Application:**
    *   **Backend:** `npm run dev` (or your start script) in the backend directory.
    *   **Frontend:** `npm run dev` (or your start script) in the frontend directory.