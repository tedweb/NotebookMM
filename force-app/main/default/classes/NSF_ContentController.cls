/**
 * NSF_ContentController
 * CRUD operations for all four interaction mode content types:
 * Resources, Notes, Cards, and Exams.
 * Also manages junction records and answer candidates.
 */
public with sharing class NSF_ContentController {

    // ───────────────────────────────────────────────
    // Inner classes for structured data transfer
    // ───────────────────────────────────────────────

    public class SectionWithItems {
        @AuraEnabled public NSF_Section__c section;
        @AuraEnabled public List<ItemWrapper> items;

        public SectionWithItems(NSF_Section__c section, List<ItemWrapper> items) {
            this.section = section;
            this.items = items;
        }
    }

    public class ItemWrapper {
        @AuraEnabled public Id recordId;
        @AuraEnabled public String name;
        @AuraEnabled public String title;
        @AuraEnabled public String link;
        @AuraEnabled public String itemType;
        @AuraEnabled public Boolean isBookmarked;

        public ItemWrapper(Id recordId, String name, String title, String link, String itemType, Boolean isBookmarked) {
            this.recordId = recordId;
            this.name = name;
            this.title = title;
            this.link = link;
            this.itemType = itemType;
            this.isBookmarked = isBookmarked;
        }
    }

    public class SectionSummary {
        @AuraEnabled public Id sectionId;
        @AuraEnabled public String sectionTitle;
        @AuraEnabled public String sectionName;
        @AuraEnabled public Integer itemCount;
        @AuraEnabled public Datetime lastModified;

        public SectionSummary(Id sectionId, String sectionTitle, String sectionName, Integer itemCount, Datetime lastModified) {
            this.sectionId = sectionId;
            this.sectionTitle = sectionTitle;
            this.sectionName = sectionName;
            this.itemCount = itemCount;
            this.lastModified = lastModified;
        }
    }

    public class AnswerCandidate {
        @AuraEnabled public String answerId;
        @AuraEnabled public String answer;
        @AuraEnabled public Boolean isCorrect;

        public AnswerCandidate() {}
    }

    public class OrderItem {
        @AuraEnabled public String id;
        @AuraEnabled public Integer orderNum;

        public OrderItem() {}
    }

    // ───────────────────────────────────────────────
    // RESOURCES
    // ───────────────────────────────────────────────

    /**
     * Returns resources for a notebook, grouped by section, with bookmark status.
     */
    @AuraEnabled(cacheable=true)
    public static List<SectionWithItems> getResourcesByNotebook(String notebookId) {
        // Get bookmarked resource IDs for this notebook
        Set<Id> bookmarkedIds = getBookmarkedIds(notebookId, 'NSF_ResourceId__c');

        // Get sections with resources
        List<NSF_Section__c> sections = [
            SELECT Id, Name, Title__c,
                (SELECT Id, Name, Title__c, Link__c, Type__c
                 FROM Resources__r
                 ORDER BY Title__c ASC)
            FROM NSF_Section__c
            WHERE NSF_NotebookId__c = :notebookId
            ORDER BY Title__c ASC
        ];

        List<SectionWithItems> result = new List<SectionWithItems>();
        for (NSF_Section__c section : sections) {
            List<ItemWrapper> items = new List<ItemWrapper>();
            for (NSF_Resource__c r : section.Resources__r) {
                items.add(new ItemWrapper(
                    r.Id, r.Name, r.Title__c, r.Link__c, r.Type__c,
                    bookmarkedIds.contains(r.Id)
                ));
            }
            result.add(new SectionWithItems(section, items));
        }
        return result;
    }

    /**
     * Creates or updates a resource.
     */
    @AuraEnabled
    public static String upsertResource(String resourceId, String title, String link, String resourceType, String sectionId) {
        try {
            NSF_Resource__c resource;
            if (String.isNotBlank(resourceId)) {
                resource = new NSF_Resource__c(Id = resourceId);
            } else {
                resource = new NSF_Resource__c();
            }
            resource.Title__c = title;
            resource.Link__c = link;
            resource.Type__c = resourceType;
            if (String.isNotBlank(sectionId)) {
                resource.NSF_SectionId__c = sectionId;
            }
            upsert resource;
            return resource.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Deletes a resource. Also cleans up bookmarks referencing this resource.
     * Junction records (NSF_Resource_Card__c, etc.) auto-cascade via MasterDetail.
     */
    @AuraEnabled
    public static void deleteResource(String resourceId) {
        try {
            // Clean up bookmarks pointing to this resource
            delete [SELECT Id FROM NSF_Bookmark_Listing__c WHERE NSF_ResourceId__c = :resourceId];
            delete new NSF_Resource__c(Id = resourceId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ───────────────────────────────────────────────
    // NOTES
    // ───────────────────────────────────────────────

    /**
     * Returns notes for a notebook, grouped by section, with bookmark status.
     */
    @AuraEnabled(cacheable=true)
    public static List<SectionWithItems> getNotesByNotebook(String notebookId) {
        Set<Id> bookmarkedIds = getBookmarkedIds(notebookId, 'NSF_NoteId__c');

        List<NSF_Section__c> sections = [
            SELECT Id, Name, Title__c,
                (SELECT Id, Name, Title__c
                 FROM Notes__r
                 ORDER BY Title__c ASC)
            FROM NSF_Section__c
            WHERE NSF_NotebookId__c = :notebookId
            ORDER BY Title__c ASC
        ];

        List<SectionWithItems> result = new List<SectionWithItems>();
        for (NSF_Section__c section : sections) {
            List<ItemWrapper> items = new List<ItemWrapper>();
            for (NSF_Note__c n : section.Notes__r) {
                items.add(new ItemWrapper(
                    n.Id, n.Name, n.Title__c, null, 'Note',
                    bookmarkedIds.contains(n.Id)
                ));
            }
            result.add(new SectionWithItems(section, items));
        }
        return result;
    }

    /**
     * Returns a single note with its rich text content for the detail view editor.
     */
    @AuraEnabled
    public static NSF_Note__c getNoteDetail(String noteId) {
        List<NSF_Note__c> notes = [
            SELECT Id, Name, Title__c, Content__c, NSF_SectionId__c,
                   NSF_SectionId__r.Title__c, NSF_SectionId__r.NSF_NotebookId__c
            FROM NSF_Note__c
            WHERE Id = :noteId
            LIMIT 1
        ];
        if (notes.isEmpty()) {
            AuraHandledException ex = new AuraHandledException('Note not found.');
            ex.setMessage('Note not found.');
            throw ex;
        }
        return notes[0];
    }

    /**
     * Creates or updates a note (title and section only).
     */
    @AuraEnabled
    public static String upsertNote(String noteId, String title, String sectionId) {
        try {
            NSF_Note__c note;
            if (String.isNotBlank(noteId)) {
                note = new NSF_Note__c(Id = noteId);
            } else {
                note = new NSF_Note__c();
            }
            note.Title__c = title;
            note.NSF_SectionId__c = sectionId;
            upsert note;
            return note.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Saves rich text content to a note.
     */
    @AuraEnabled
    public static void saveNoteContent(String noteId, String content) {
        try {
            NSF_Note__c note = new NSF_Note__c(Id = noteId);
            note.Content__c = content;
            update note;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Deletes a note. Cleans up bookmarks.
     */
    @AuraEnabled
    public static void deleteNote(String noteId) {
        try {
            delete [SELECT Id FROM NSF_Bookmark_Listing__c WHERE NSF_NoteId__c = :noteId];
            delete new NSF_Note__c(Id = noteId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ───────────────────────────────────────────────
    // CARDS
    // ───────────────────────────────────────────────

    /**
     * Returns section summaries for the Cards list view: count and last modified.
     */
    @AuraEnabled(cacheable=true)
    public static List<SectionSummary> getCardSectionSummaries(String notebookId) {
        // Get all sections for this notebook
        List<NSF_Section__c> sections = [
            SELECT Id, Name, Title__c FROM NSF_Section__c
            WHERE NSF_NotebookId__c = :notebookId ORDER BY Title__c ASC
        ];

        // Aggregate card counts and last modified per section
        Map<Id, AggregateResult> aggMap = new Map<Id, AggregateResult>();
        for (AggregateResult ar : [
            SELECT NSF_SectionId__c secId, COUNT(Id) cnt, MAX(LastModifiedDate) lastMod
            FROM NSF_Card__c
            WHERE NSF_SectionId__r.NSF_NotebookId__c = :notebookId
            GROUP BY NSF_SectionId__c
        ]) {
            aggMap.put((Id) ar.get('secId'), ar);
        }

        List<SectionSummary> result = new List<SectionSummary>();
        for (NSF_Section__c section : sections) {
            AggregateResult ar = aggMap.get(section.Id);
            Integer cnt = ar != null ? (Integer) ar.get('cnt') : 0;
            Datetime lastMod = ar != null ? (Datetime) ar.get('lastMod') : null;
            result.add(new SectionSummary(section.Id, section.Title__c, section.Name, cnt, lastMod));
        }
        return result;
    }

    /**
     * Returns ordered cards for a section (carousel display).
     */
    @AuraEnabled(cacheable=true)
    public static List<NSF_Card__c> getCardsBySection(String sectionId) {
        return [
            SELECT Id, Name, Front__c, Back__c, Order__c, NSF_SectionId__c,
                   LastModifiedDate
            FROM NSF_Card__c
            WHERE NSF_SectionId__c = :sectionId
            ORDER BY Order__c ASC NULLS LAST, CreatedDate ASC
        ];
    }

    /**
     * Creates or updates a card with its supporting resource junction records.
     * @param cardId - null for create
     * @param front - front side text
     * @param back - back side text/rich text
     * @param orderNum - sort order
     * @param sectionId - parent section
     * @param resourceIds - list of resource IDs to link
     */
    @AuraEnabled
    public static String upsertCard(String cardId, String front, String back, Integer orderNum, String sectionId, List<String> resourceIds) {
        try {
            NSF_Card__c card;
            if (String.isNotBlank(cardId)) {
                card = new NSF_Card__c(Id = cardId);
            } else {
                card = new NSF_Card__c();
            }
            card.Front__c = front;
            card.Back__c = back;
            card.Order__c = orderNum;
            card.NSF_SectionId__c = sectionId;
            upsert card;

            // Replace junction records
            if (String.isNotBlank(cardId)) {
                delete [SELECT Id FROM NSF_Resource_Card__c WHERE NSF_CardId__c = :cardId];
            }
            if (resourceIds != null && !resourceIds.isEmpty()) {
                List<NSF_Resource_Card__c> junctions = new List<NSF_Resource_Card__c>();
                for (String resId : resourceIds) {
                    junctions.add(new NSF_Resource_Card__c(
                        NSF_CardId__c = card.Id,
                        NSF_ResourceId__c = resId
                    ));
                }
                insert junctions;
            }

            return card.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Deletes a card. Junction records auto-cascade via MasterDetail. Cleans up bookmarks.
     */
    @AuraEnabled
    public static void deleteCard(String cardId) {
        try {
            delete [SELECT Id FROM NSF_Bookmark_Listing__c WHERE NSF_CardId__c = :cardId];
            delete new NSF_Card__c(Id = cardId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Batch updates card order. Accepts JSON: [{"id":"xxx","orderNum":1},...]
     */
    @AuraEnabled
    public static void saveCardOrder(String serializedOrderMap) {
        try {
            List<OrderItem> orderItems = (List<OrderItem>) JSON.deserialize(serializedOrderMap, List<OrderItem>.class);
            List<NSF_Card__c> toUpdate = new List<NSF_Card__c>();
            for (OrderItem item : orderItems) {
                toUpdate.add(new NSF_Card__c(Id = item.id, Order__c = item.orderNum));
            }
            update toUpdate;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ───────────────────────────────────────────────
    // EXAMS
    // ───────────────────────────────────────────────

    /**
     * Returns section summaries for the Exams list view: count and last modified.
     */
    @AuraEnabled(cacheable=true)
    public static List<SectionSummary> getExamSectionSummaries(String notebookId) {
        List<NSF_Section__c> sections = [
            SELECT Id, Name, Title__c FROM NSF_Section__c
            WHERE NSF_NotebookId__c = :notebookId ORDER BY Title__c ASC
        ];

        Map<Id, AggregateResult> aggMap = new Map<Id, AggregateResult>();
        for (AggregateResult ar : [
            SELECT NSF_SectionId__c secId, COUNT(Id) cnt, MAX(LastModifiedDate) lastMod
            FROM NSF_Exam__c
            WHERE NSF_SectionId__r.NSF_NotebookId__c = :notebookId
            GROUP BY NSF_SectionId__c
        ]) {
            aggMap.put((Id) ar.get('secId'), ar);
        }

        List<SectionSummary> result = new List<SectionSummary>();
        for (NSF_Section__c section : sections) {
            AggregateResult ar = aggMap.get(section.Id);
            Integer cnt = ar != null ? (Integer) ar.get('cnt') : 0;
            Datetime lastMod = ar != null ? (Datetime) ar.get('lastMod') : null;
            result.add(new SectionSummary(section.Id, section.Title__c, section.Name, cnt, lastMod));
        }
        return result;
    }

    /**
     * Returns ordered exam questions for a section with answer candidates.
     */
    @AuraEnabled(cacheable=true)
    public static List<NSF_Exam__c> getExamsBySection(String sectionId) {
        return [
            SELECT Id, Name, Question__c, Explanation__c, Order__c, NSF_SectionId__c,
                   LastModifiedDate,
                (SELECT Id, Name, Possible_Answer__c, Is_Correct__c
                 FROM Answer_Candidates__r)
            FROM NSF_Exam__c
            WHERE NSF_SectionId__c = :sectionId
            ORDER BY Order__c ASC NULLS LAST, CreatedDate ASC
        ];
    }

    /**
     * Creates or updates an exam question with answer candidates and resource links.
     * @param examId - null for create
     * @param question - question text
     * @param explanation - answer explanation text
     * @param sectionId - parent section
     * @param answersJson - JSON array: [{"answer":"text","isCorrect":true},...]
     * @param resourceIds - list of resource IDs to link
     */
    @AuraEnabled
    public static String upsertExam(String examId, String question, String explanation, Integer orderNum, String sectionId, String answersJson, List<String> resourceIds) {
        try {
            NSF_Exam__c exam;
            if (String.isNotBlank(examId)) {
                exam = new NSF_Exam__c(Id = examId);
            } else {
                exam = new NSF_Exam__c();
            }
            exam.Question__c = question;
            exam.Explanation__c = explanation;
            exam.Order__c = orderNum;
            exam.NSF_SectionId__c = sectionId;
            upsert exam;

            // Replace answer candidates (MasterDetail auto-cascades on delete)
            if (String.isNotBlank(examId)) {
                delete [SELECT Id FROM NSF_Exam_Answer_Candidates__c WHERE NSF_Exam_ItemId__c = :examId];
            }
            if (String.isNotBlank(answersJson)) {
                List<AnswerCandidate> answers = (List<AnswerCandidate>) JSON.deserialize(answersJson, List<AnswerCandidate>.class);
                List<NSF_Exam_Answer_Candidates__c> answerRecords = new List<NSF_Exam_Answer_Candidates__c>();
                for (AnswerCandidate ac : answers) {
                    answerRecords.add(new NSF_Exam_Answer_Candidates__c(
                        Possible_Answer__c = ac.answer,
                        Is_Correct__c = ac.isCorrect,
                        NSF_Exam_ItemId__c = exam.Id
                    ));
                }
                insert answerRecords;
            }

            // Replace resource junction records
            if (String.isNotBlank(examId)) {
                delete [SELECT Id FROM NSF_Resource_Exam__c WHERE NSF_ExamId__c = :examId];
            }
            if (resourceIds != null && !resourceIds.isEmpty()) {
                List<NSF_Resource_Exam__c> junctions = new List<NSF_Resource_Exam__c>();
                for (String resId : resourceIds) {
                    junctions.add(new NSF_Resource_Exam__c(
                        NSF_ExamId__c = exam.Id,
                        NSF_ResourceId__c = resId
                    ));
                }
                insert junctions;
            }

            return exam.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Deletes an exam. Answer candidates and junction records auto-cascade via MasterDetail.
     */
    @AuraEnabled
    public static void deleteExam(String examId) {
        try {
            delete [SELECT Id FROM NSF_Bookmark_Listing__c WHERE NSF_ExamId__c = :examId];
            delete new NSF_Exam__c(Id = examId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Batch updates exam order. Accepts JSON: [{"id":"xxx","orderNum":1},...]
     */
    @AuraEnabled
    public static void saveExamOrder(String serializedOrderMap) {
        try {
            List<OrderItem> orderItems = (List<OrderItem>) JSON.deserialize(serializedOrderMap, List<OrderItem>.class);
            List<NSF_Exam__c> toUpdate = new List<NSF_Exam__c>();
            for (OrderItem item : orderItems) {
                toUpdate.add(new NSF_Exam__c(Id = item.id, Order__c = item.orderNum));
            }
            update toUpdate;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ───────────────────────────────────────────────
    // SHARED RESOURCE SELECTION
    // ───────────────────────────────────────────────

    /**
     * Returns all resources in a notebook for the resource selector combobox.
     */
    @AuraEnabled(cacheable=true)
    public static List<NSF_Resource__c> getResourcesForSelection(String notebookId) {
        return [
            SELECT Id, Name, Title__c, Link__c, Type__c, NSF_SectionId__c,
                   NSF_SectionId__r.Title__c
            FROM NSF_Resource__c
            WHERE NSF_SectionId__r.NSF_NotebookId__c = :notebookId
            ORDER BY NSF_SectionId__r.Title__c ASC, Title__c ASC
        ];
    }

    /**
     * Returns resources linked to a card or exam via junction records.
     * @param recordId - the card or exam Id
     * @param recordType - 'Card' or 'Exam'
     */
    @AuraEnabled(cacheable=true)
    public static List<NSF_Resource__c> getLinkedResources(String recordId, String recordType) {
        if (recordType == 'Card') {
            List<NSF_Resource_Card__c> junctions = [
                SELECT NSF_ResourceId__c, NSF_ResourceId__r.Title__c,
                       NSF_ResourceId__r.Link__c, NSF_ResourceId__r.Type__c
                FROM NSF_Resource_Card__c
                WHERE NSF_CardId__c = :recordId
            ];
            List<NSF_Resource__c> resources = new List<NSF_Resource__c>();
            for (NSF_Resource_Card__c j : junctions) {
                resources.add(new NSF_Resource__c(
                    Id = j.NSF_ResourceId__c,
                    Title__c = j.NSF_ResourceId__r.Title__c,
                    Link__c = j.NSF_ResourceId__r.Link__c,
                    Type__c = j.NSF_ResourceId__r.Type__c
                ));
            }
            return resources;
        } else if (recordType == 'Exam') {
            List<NSF_Resource_Exam__c> junctions = [
                SELECT NSF_ResourceId__c, NSF_ResourceId__r.Title__c,
                       NSF_ResourceId__r.Link__c, NSF_ResourceId__r.Type__c
                FROM NSF_Resource_Exam__c
                WHERE NSF_ExamId__c = :recordId
            ];
            List<NSF_Resource__c> resources = new List<NSF_Resource__c>();
            for (NSF_Resource_Exam__c j : junctions) {
                resources.add(new NSF_Resource__c(
                    Id = j.NSF_ResourceId__c,
                    Title__c = j.NSF_ResourceId__r.Title__c,
                    Link__c = j.NSF_ResourceId__r.Link__c,
                    Type__c = j.NSF_ResourceId__r.Type__c
                ));
            }
            return resources;
        }
        return new List<NSF_Resource__c>();
    }

    // ───────────────────────────────────────────────
    // PRIVATE HELPERS
    // ───────────────────────────────────────────────

    /**
     * Returns a set of bookmarked record IDs for a given notebook and field.
     */
    private static Set<Id> getBookmarkedIds(String notebookId, String fieldName) {
        Set<Id> bookmarkedIds = new Set<Id>();
        String query = 'SELECT ' + String.escapeSingleQuotes(fieldName) +
            ' FROM NSF_Bookmark_Listing__c WHERE NSF_SectionId__r.NSF_NotebookId__c = :notebookId' +
            ' AND ' + String.escapeSingleQuotes(fieldName) + ' != null';
        for (SObject bm : Database.query(query)) {
            Id val = (Id) bm.get(fieldName);
            if (val != null) {
                bookmarkedIds.add(val);
            }
        }
        return bookmarkedIds;
    }
}
