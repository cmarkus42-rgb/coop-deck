<!-- Generated from anleitung/en/ with `npm run anleitung`. Edit there, not here. -->

# Artifacts

An artifact is something you talk about with the session and that stays: a roadmap, the project sheet, a document, a page. It lives as a file in the project and is shown in a tab on the right. Different CLIs work on the same artifact one after the other, because the data lives in the project and not in a session.

## Opening and creating

- The **+** in the tab bar on the right lists the artifacts of the project and creates a new one with **New artifact**.
- In the address line you can type a URL, the name of an artifact or the path of a file in the project.
- The session opens tabs with `coop zeigen` and jumps to a place while doing so.

## The types

Typed artifacts separate data from presentation. The session changes the data file; the view reloads by itself.

| Type | What for |
|---|---|
| **Project sheet** | The authoritative place for rules, facts, decisions and open points. Every session receives it in the briefing. |
| **Roadmap** | Milestones and items with state, acceptance criteria and dependencies. A session starts from every item. |
| **Document** | A Markdown file of the project, set for reading. Every place can be addressed by file and line. |
| **Questionnaire** | Several questions from the session at once, each with a proposal. The answers go back together. |
| **Variant choice** | Two or three drafts side by side: choose and give a reason. |
| **Review** | Findings with severity, location and state. A session starts from every finding. |
| **Handover** | State, open points and next step at the end of a session. The next session reads it in the briefing. |
| **Web preview** | A running page, such as a dev server, as a tab for marking and showing. |
| **Free artifact** | Your own HTML in the artifact folder when no type fits. |

## The roadmap

You change the state of an item in the view, the session with `coop roadmap status`. Only you set “done”: when the session reports an item as done, that is a proposal you confirm. When you change something in the view, the session working on the roadmap is told.

## Foreign content

Free artifacts, project files and the HTML of variants count as content of the project and therefore as foreign. They run sandboxed and cannot reach the interface of the deck. More in [Data and security](11-daten-und-sicherheit.md).
