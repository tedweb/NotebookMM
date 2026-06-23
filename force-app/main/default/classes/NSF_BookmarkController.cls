/**
 * NSF_BookmarkController
 * Toggle bookmarks and query bookmarked items for the NotebookSF application.
 * Bookmarks use NSF_Bookmark_Listing__c with optional lookup fields.
 */
public with sharing class NSF_BookmarkController {

    /**
     * Toggles a bookmark for a record. If bookmarked, removes it; if not, adds it.
     * @param recordId - the Id of the Resource, Note, Card, or Exam to bookmark
     * @param recordType - 'Resource', 'Note', 'Card', or 'Exam'
     * @param sectionId - the section the record belongs to
     * @return true if bookmark was added, false if removed
     */
    @AuraEnabled
    public static Boolean toggleBookmark(String recordId, String recordType, String sectionId) {
        try {
            String fieldName = getFieldName(recordType);
            String currentUserId = UserInfo.getUserId();
            String uniqueKey = currentUserId + ':' + recordId;

            String query = 'SELECT Id FROM NSF_Bookmark_Listing__c WHERE '
                + String.escapeSingleQuotes(fieldName) + ' = :recordId AND CreatedById = :currentUserId LIMIT 1';
            List<SObject> existing = Database.query(query);

            if (!existing.isEmpty()) {
                delete existing;
                return false;
            } else {
                NSF_Bookmark_Listing__c bookmark = new NSF_Bookmark_Listing__c();
                bookmark.NSF_SectionId__c = sectionId;
                bookmark.put(fieldName, recordId);
                bookmark.Bookmark_Unique_Key__c = uniqueKey;
                insert bookmark;
                return true;
            }
        } catch (DmlException dmlEx) {
            if (dmlEx.getDmlType(0) == StatusCode.DUPLICATE_VALUE) {
                return true;
            }
            throw new AuraHandledException(dmlEx.getMessage());
        } catch (AuraHandledException ae) {
            throw ae;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Returns bookmarked items for a given notebook and mode.
     * @param notebookId - the notebook Id
     * @param mode - 'Resources', 'Notes', 'Cards', or 'Exams'
     */
    @AuraEnabled(cacheable=true)
    public static List<SObject> getBookmarkedItems(String notebookId, String mode) {
        Id currentUserId = UserInfo.getUserId();
        if (mode == 'Resources') {
            return [
                SELECT Id, NSF_ResourceId__c, NSF_ResourceId__r.Id,
                       NSF_ResourceId__r.Name, NSF_ResourceId__r.Title__c,
                       NSF_ResourceId__r.Link__c, NSF_ResourceId__r.Type__c,
                       NSF_SectionId__c, NSF_SectionId__r.Title__c
                FROM NSF_Bookmark_Listing__c
                WHERE NSF_SectionId__r.NSF_NotebookId__c = :notebookId
                AND NSF_ResourceId__c != null
                AND CreatedById = :currentUserId
                ORDER BY CreatedDate DESC
            ];
        } else if (mode == 'Notes') {
            return [
                SELECT Id, NSF_NoteId__c, NSF_NoteId__r.Id,
                       NSF_NoteId__r.Name, NSF_NoteId__r.Title__c,
                       NSF_SectionId__c, NSF_SectionId__r.Title__c
                FROM NSF_Bookmark_Listing__c
                WHERE NSF_SectionId__r.NSF_NotebookId__c = :notebookId
                AND NSF_NoteId__c != null
                AND CreatedById = :currentUserId
                ORDER BY CreatedDate DESC
            ];
        } else if (mode == 'Cards') {
            return [
                SELECT Id, NSF_CardId__c, NSF_CardId__r.Id,
                       NSF_CardId__r.Name, NSF_CardId__r.Front__c,
                       NSF_SectionId__c, NSF_SectionId__r.Title__c
                FROM NSF_Bookmark_Listing__c
                WHERE NSF_SectionId__r.NSF_NotebookId__c = :notebookId
                AND NSF_CardId__c != null
                AND CreatedById = :currentUserId
                ORDER BY CreatedDate DESC
            ];
        } else if (mode == 'Exams') {
            return [
                SELECT Id, NSF_ExamId__c, NSF_ExamId__r.Id,
                       NSF_ExamId__r.Name, NSF_ExamId__r.Question__c,
                       NSF_SectionId__c, NSF_SectionId__r.Title__c
                FROM NSF_Bookmark_Listing__c
                WHERE NSF_SectionId__r.NSF_NotebookId__c = :notebookId
                AND NSF_ExamId__c != null
                AND CreatedById = :currentUserId
                ORDER BY CreatedDate DESC
            ];
        }
        return new List<SObject>();
    }

    /**
     * Checks if a specific record is bookmarked.
     * @param recordId - the record to check
     * @param recordType - 'Resource', 'Note', 'Card', or 'Exam'
     */
    @AuraEnabled(cacheable=true)
    public static Boolean isBookmarked(String recordId, String recordType) {
        String fieldName = getFieldName(recordType);
        String currentUserId = UserInfo.getUserId();
        String query = 'SELECT COUNT() FROM NSF_Bookmark_Listing__c WHERE '
            + String.escapeSingleQuotes(fieldName) + ' = :recordId AND CreatedById = :currentUserId';
        return Database.countQuery(query) > 0;
    }

    /**
     * Maps recordType string to the corresponding field API name.
     */
    private static String getFieldName(String recordType) {
        Map<String, String> fieldMap = new Map<String, String>{
            'Resource' => 'NSF_ResourceId__c',
            'Note' => 'NSF_NoteId__c',
            'Card' => 'NSF_CardId__c',
            'Exam' => 'NSF_ExamId__c'
        };
        String fieldName = fieldMap.get(recordType);
        if (fieldName == null) {
            AuraHandledException ex = new AuraHandledException('Invalid record type: ' + recordType);
            ex.setMessage('Invalid record type: ' + recordType);
            throw ex;
        }
        return fieldName;
    }
}
