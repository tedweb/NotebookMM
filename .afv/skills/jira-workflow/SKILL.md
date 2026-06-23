---
name: jira-workflow
description: Query Jira for open tasks, implement a selected ticket, deploy to Salesforce, and push to GitHub.
whenToUse: When the user wants to pick up a Jira ticket and work it through implementation, deploy, and push.
---

# Jira-to-Deploy Workflow

## Workflow Steps

### 1. Query Open Jira Tickets

Use `mcp__mcp_atlassian__jira_search` with JQL:

```
status = "To Do" ORDER BY priority DESC, created ASC
```

Present results to the user as a numbered list showing:
- Ticket key (e.g., PROJ-123)
- Summary
- Priority
- Assignee

Ask the user: **"Which ticket would you like to implement?"**

### 2. Transition Ticket to In Progress

Once the user selects a ticket:

1. Use `mcp__mcp_atlassian__jira_get_transitions` to get available transitions for the selected issue.
2. Find the transition whose `name` is "In Progress".
3. Use `mcp__mcp_atlassian__jira_transition_issue` to move the ticket to "In Progress".
4. Confirm the transition to the user.

### 3. Implement the Changes

1. Use `mcp__mcp_atlassian__jira_get_issue` to get the full ticket description and acceptance criteria.
2. Implement the changes described in the ticket on the current branch.
3. Follow all existing project conventions (Apex, LWC, metadata patterns already in the repo).
4. When implementation is complete, summarize what was done and ask the user: **"Would you like to deploy these changes to your default Salesforce org?"**

### 4. Deploy to Salesforce

If the user confirms deployment:

1. Use `mcp__salesforce_dx__deploy_metadata` to deploy to the default org.
2. If deployment succeeds, use `mcp__mcp_atlassian__jira_transition_issue` to move the ticket to "In Review" (get transitions first to find the correct transition ID).
3. Report the deployment result to the user.
4. Ask the user: **"Would you like to commit and push these changes to your Git repository?"**

If deployment fails, report the errors and ask how the user wants to proceed. Do NOT transition the Jira ticket.

### 5. Commit and Push to GitHub

If the user confirms:

1. Stage the changed files (prefer specific file paths over `git add -A`).
2. Commit with a message referencing the Jira ticket key in the format:
   ```
   <TICKET-KEY>: <summary of changes>

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
3. Push to the remote tracking branch.
4. Use `mcp__mcp_atlassian__jira_transition_issue` to move the ticket to "Done".
5. Report success to the user.

## Important Rules

- Always confirm with the user before deploying or pushing.
- Never force-push or use destructive git operations.
- If any step fails, stop and report the error — do not skip ahead.
- Work on the current branch; do not create or switch branches.
- When implementing, use the appropriate Salesforce skills (generating-apex, generating-lwc-components, etc.) for the type of work described in the ticket.
