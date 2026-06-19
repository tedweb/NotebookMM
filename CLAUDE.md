# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Deploy to org:**
```bash
sf project deploy start --target-org Notebook-MM
```

**Run Apex tests (all):**
```bash
sf apex run test --target-org Notebook-MM --result-format human --wait 10
```

**Run a single test class:**
```bash
sf apex run test --target-org Notebook-MM --class-names NSF_CatalogControllerTest --result-format human --wait 10
```

**Deploy a specific metadata type (e.g. after editing one class):**
```bash
sf project deploy start --target-org Notebook-MM --source-dir force-app/main/default/classes
```

**Check org connection:**
```bash
sf org display --target-org Notebook-MM
```

## Architecture

### Data Model Hierarchy

Content is organized in a strict five-level hierarchy:

```
NSF_Catalog__c
  └── NSF_Topic__c
        └── NSF_Notebook__c
              └── NSF_Section__c
                    ├── NSF_Note__c
                    ├── NSF_Card__c          (has Order__c field)
                    ├── NSF_Exam__c          (has Order__c + NSF_Exam_Answer_Candidates__c children)
                    └── NSF_Resource__c
```

Deletion is **bottom-up only**: Salesforce Restrict constraints prevent deleting a parent with children. All delete operations in `NSF_CatalogController` and `NSF_SectionController` manually delete children in reverse order before deleting the parent. Any new delete logic must follow this pattern.

### Junction Objects

Resources can be linked to Cards and Exams via MasterDetail junction records. These auto-cascade on delete of the parent content item, but bookmark cleanup must be done manually before deleting any content item.

- `NSF_Resource_Card__c` — links `NSF_Resource__c` ↔ `NSF_Card__c`
- `NSF_Resource_Exam__c` — links `NSF_Resource__c` ↔ `NSF_Exam__c`
- `NSF_Resource_Note__c` — links `NSF_Resource__c` ↔ `NSF_Note__c`
- `NSF_Bookmark_Listing__c` — each record holds a section reference plus one optional content ID (resource, note, card, or exam). Bookmark records must be deleted before the content items they reference.

### Apex Controllers

| Controller | Responsibility |
|---|---|
| `NSF_CatalogController` | CRUD for Catalog/Topic/Notebook; notebook deep-delete |
| `NSF_ContentController` | CRUD for all four content types (Resources, Notes, Cards, Exams); resource linking; bookmark-aware reads |
| `NSF_SectionController` | CRUD for Sections; section deep-delete |
| `NSF_BookmarkController` | Bookmark toggle operations |

`NSF_ContentController` returns inner class wrappers (`SectionWithItems`, `ItemWrapper`, `SectionSummary`) rather than raw SObjects, because the list views need bookmark status mixed into the content records. Cacheable wire methods populate the list views; non-cacheable methods handle writes.

### LWC Component Structure

**Home page** (`nsfHomePage`) — full CRUD for Catalog/Topic/Notebook using three modals (catalog-modal, topic-modal, notebook-modal). Wires `getCatalogs` and `getTopicsWithNotebooks`. Opening a notebook detects console context: console apps use `openTab` (workspace tab per notebook); standard apps use `NavigationMixin.Navigate` to a nav item page.

**Notebook container** (`nsfNotebookContainer`) — receives `c__notebookId` and `c__notebookTitle` from page state via `CurrentPageReference`. Delegates to mode-specific child components based on `activeMode` (Resources / Notes / Cards / Exams).

Each mode follows the same pattern: a **list view** component shows section summaries or grouped items, clicking opens a **detail view** (for Notes) or **sort/detail views** (for Cards/Exams), and an **upsert wizard** handles create/edit.

**Shared components:**
- `lwcModal` — generic modal wrapper used everywhere for create/edit forms
- `nsfConfirmationModal` — used for delete confirmations
- `nsfInteractionModeSelector` — tab bar for switching between the four modes
- `nsfCatalogSidebar` — persistent dark sidebar for catalog selection and navigation

### Deployment Order

When deploying the full project from scratch, deploy in this order to avoid dependency errors:
1. `objects/`
2. `classes/`
3. `staticresources/`
4. `documents/`
5. `lwc/`
6. `flexipages/`
7. `tabs/`
8. `applications/`
9. `permissionsets/`

### Testing

All test classes use `NSF_TestFactory` for setup — never inline DML in test methods. `createFullHierarchy()` returns a `Map<String, SObject>` with keys `catalog`, `topic`, `notebook`, `section` and is the standard starting point for any test that needs the full object chain.
