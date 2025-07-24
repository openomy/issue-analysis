# GitHub Issue Analysis Feature

## Overview
This feature adds AI-powered analysis capabilities to GitHub issues in the repository viewer. It automatically categorizes issues based on their content using OpenAI's API and stores the results in a structured database table.

## How to Use

1. **Navigate to a Repository Page**: 
   Go to `/github/[owner]/[repo]` (e.g., `/github/lobehub/lobe-chat`)

2. **Analyze Issues**: 
   In the issues table, each row now has an "Analyze" button on the right side

3. **Click to Analyze**: 
   - Click the "Analyze" button to start AI analysis
   - The button will show "Analyzing..." with a loading spinner
   - Once complete, it shows "Done" with a checkmark
   - If failed, it shows "Retry" with an X icon

## What Gets Analyzed

The AI analyzes each issue and categorizes it based on:

- **Tool Calling**: Whether the issue relates to tool calling functionality
- **MCP**: Whether it's related to MCP (Model Context Protocol)
- **Model Provider**: Which AI provider is mentioned (OpenAI, Azure, Google, Anthropic)
- **Platform/OS**: Windows, macOS, Linux, Mobile, Desktop, etc.
- **Technology Stack**: React Native, Docker, etc.
- **Feature Areas**: Chat, Plugin, Search, TTS, File System, etc.
- **Version**: Any specific version mentioned
- **Manual Check**: Whether the issue needs human review

## Database Storage

Analysis results are stored in the `issue_label` table with:
- Foreign key reference to the original issue
- Boolean flags for each category
- Timestamps for tracking
- Support for updates (re-analysis)

## API Endpoints

- `POST /api/issue-analysis`: Analyzes issue content using AI
- `POST /api/issue-analysis/save`: Saves analysis results to database

## Technical Details

- Uses OpenAI's GPT model for categorization
- Stores results in Supabase PostgreSQL database
- Real-time UI updates with loading states
- Error handling and retry functionality
- Prevents duplicate entries with upsert logic

## Button States

- **Default**: Blue "Analyze" button with brain icon
- **Loading**: Gray "Analyzing..." with spinning loader
- **Success**: Green "Done" with checkmark
- **Error**: Red "Retry" with X icon (clickable to retry)