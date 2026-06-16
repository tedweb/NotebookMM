# NotebookSF

A Salesforce-native notebook and study management application built entirely with Lightning Web Components (LWC).

## Overview

NotebookSF lets users organize knowledge into **Catalogs → Topics → Notebooks**, with each notebook supporting multiple interaction modes for rich content creation and study.

## Features

- **Catalog Management** — Create, rename, and delete catalogs via a persistent dark-themed sidebar
- **Topic Cards** — Visual card grid with masonry-style columnar layout for browsing topics
- **Notebook Container** — Tabbed workspace with multiple interaction modes:
  - **Notes** — Rich-text note taking with list and detail views
  - **Cards** — Flashcard-style content with sorting and upsert wizards
  - **Exams** — Quiz/exam builder with answer candidates and grading
  - **Resources** — Attach and manage supplemental resources
- **Bookmarks** — Save and quickly access frequently used content
- **Section Management** — Organize notebook content into collapsible sections

## Architecture

| Layer | Components |
|-------|-----------|
| **UI (LWC)** | 21 Lightning Web Components including home page, sidebar, topic cards, notebook container, and interaction-mode views |
| **Controllers (Apex)** | `NSF_CatalogController`, `NSF_ContentController`, `NSF_SectionController`, `NSF_BookmarkController` |
| **Data Model** | 13 custom objects: `NSF_Catalog__c`, `NSF_Topic__c`, `NSF_Notebook__c`, `NSF_Section__c`, `NSF_Note__c`, `NSF_Card__c`, `NSF_Exam__c`, `NSF_Resource__c`, and junction objects |
| **Tests** | Apex test classes with `NSF_TestFactory` for test data generation |

## Project Structure

```
force-app/main/default/
├── lwc/                    # 21 Lightning Web Components
├── classes/                # Apex controllers + test classes
├── objects/                # 13 custom objects with fields & relationships
├── tabs/                   # Custom tabs
├── applications/           # Custom app definition
├── flexipages/             # Lightning page layouts
└── permissionsets/         # Permission set for access control
```

## Deployment

Deploy to a Salesforce org using the Salesforce CLI:

```bash
sf project deploy start --target-org <your-org-alias>
```

## License

Proprietary — All rights reserved.
