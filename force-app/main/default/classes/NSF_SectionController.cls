/**
 * NSF_SectionController
 * CRUD operations for Sections within a Notebook.
 * Shared across all four interaction modes.
 */
public with sharing class NSF_SectionController {

    /**
     * Returns all sections for a notebook ordered by Title.
     */
    @AuraEnabled(cacheable=true)
    public static List<NSF_Section__c> getSectionsByNotebook(String notebookId) {
        return [
            SELECT Id, Name, Title__c, CreatedDate
            FROM NSF_Section__c
            WHERE NSF_NotebookId__c = :notebookId
            ORDER BY Title__c ASC
        ];
    }

    /**
     * Creates or updates a section.
     * @param sectionId - null for create, existing Id for update
     * @param title - section title
     * @param notebookId - parent notebook Id
     * @return the upserted section Id
     */
    @AuraEnabled
    public static String upsertSection(String sectionId, String title, String notebookId) {
        try {
            NSF_Section__c section;
            if (String.isNotBlank(sectionId)) {
                section = new NSF_Section__c(Id = sectionId);
            } else {
                section = new NSF_Section__c();
            }
            section.Title__c = title;
            section.NSF_NotebookId__c = notebookId;
            upsert section;
            return section.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Deletes a section and all its child content.
     * Children use deleteConstraint=Restrict, so we must delete them first.
     * Junction records (MasterDetail) auto-cascade when parent content is deleted.
     */
    @AuraEnabled
    public static void deleteSection(String sectionId) {
        try {
            // Delete bookmarks referencing items in this section
            delete [SELECT Id FROM NSF_Bookmark_Listing__c WHERE NSF_SectionId__c = :sectionId];

            // Delete content items (junction records auto-cascade via MasterDetail)
            delete [SELECT Id FROM NSF_Resource__c WHERE NSF_SectionId__c = :sectionId];
            delete [SELECT Id FROM NSF_Note__c WHERE NSF_SectionId__c = :sectionId];
            delete [SELECT Id FROM NSF_Card__c WHERE NSF_SectionId__c = :sectionId];
            delete [SELECT Id FROM NSF_Exam__c WHERE NSF_SectionId__c = :sectionId];

            // Now delete the section itself
            delete new NSF_Section__c(Id = sectionId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
