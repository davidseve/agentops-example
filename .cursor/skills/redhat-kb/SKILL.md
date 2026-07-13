---
name: redhat-kb
description: >-
  Search the Red Hat Knowledge Base (access.redhat.com) for solutions, articles,
  CVEs, and troubleshooting guides. Use when the user says "busca en la KB",
  "redhat kb", "solucion para", "busca articulo redhat", has an OCP/RHEL error,
  or needs official Red Hat troubleshooting guidance.
---

# Red Hat Knowledge Base Search

Search access.redhat.com for official solutions, articles, and troubleshooting
guides using only WebSearch and WebFetch (zero external dependencies).

## Workflow

### Step 1: Search

Use `WebSearch` with targeted queries. Combine the user's error/topic with
site-restricted search:

```
site:access.redhat.com/solutions <error message or topic>
site:access.redhat.com/articles <topic>
```

**Query strategies by scenario:**

| Scenario | Search query pattern |
|----------|---------------------|
| OCP error message | `site:access.redhat.com "<exact error text>"` |
| Pod/operator issue | `site:access.redhat.com/solutions OpenShift <component> <symptom>` |
| CVE lookup | `site:access.redhat.com/security/cve CVE-YYYY-NNNNN` |
| RHEL system issue | `site:access.redhat.com/solutions RHEL <symptom>` |
| Product docs | `site:access.redhat.com/documentation <product> <topic>` |
| Errata/updates | `site:access.redhat.com/errata <advisory>` |

### Step 2: Fetch and Summarize

For the most relevant results (top 2-3):

1. `WebFetch` the article URL
2. Extract: root cause, resolution steps, affected versions
3. Note if the article requires a Red Hat subscription (some content is gated)

### Step 3: Present

Format the response as:

```
## [Solution Title](URL)

**Applies to:** Product X version Y.Z
**Root cause:** Brief explanation
**Resolution:**
1. Step 1
2. Step 2
3. ...

**Red Hat KB reference:** [SOLUTION-NNNNNN](url)
```

If multiple articles are relevant, present them ranked by relevance.

## Important Notes

- Some KB articles require a Red Hat subscription to view full content.
  If WebFetch returns limited content, note this and suggest the user open
  the link directly with their RH credentials.
- Always include the direct URL so the user can verify/bookmark.
- Prefer `/solutions/` URLs (actionable) over `/documentation/` (reference).
- For CVEs, include severity rating and affected product versions.
- Content is in English; summarize in Spanish for the user if they ask in Spanish.

## Limitations

- No API token needed (public search + public articles)
- Gated content will show partial info; user needs RH login for full text
- This skill does NOT replace `oc adm must-gather` or cluster diagnostics;
  use it to find known solutions for specific errors
