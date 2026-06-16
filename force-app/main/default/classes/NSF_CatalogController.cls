/**
 * NSF_CatalogController
 * CRUD operations for Catalogs, Topics, and Notebooks.
 * Called by the NotebookSF home page LWC components.
 */
public with sharing class NSF_CatalogController {

    /**
     * Returns all catalogs ordered by Title.
     */
    @AuraEnabled(cacheable=true)
    public static List<NSF_Catalog__c> getCatalogs() {
        return [
            SELECT Id, Name, Title__c, CreatedDate
            FROM NSF_Catalog__c
            ORDER BY Title__c ASC
        ];
    }

    /**
     * Returns topics with their child notebooks for a given catalog.
     */
    @AuraEnabled(cacheable=true)
    public static List<NSF_Topic__c> getTopicsWithNotebooks(String catalogId) {
        return [
            SELECT Id, Name, Title__c, CreatedDate,
                (SELECT Id, Name, Title__c, CreatedDate
                 FROM Notebooks__r
                 ORDER BY Title__c ASC)
            FROM NSF_Topic__c
            WHERE NSF_CatalogId__c = :catalogId
            ORDER BY Title__c ASC
        ];
    }

    /**
     * Returns full notebook detail including parent topic and catalog info.
     * Used for notebook tab header display.
     */
    @AuraEnabled(cacheable=true)
    public static NSF_Notebook__c getNotebookDetail(String notebookId) {
        List<NSF_Notebook__c> notebooks = [
            SELECT Id, Name, Title__c,
                   NSF_TopicId__c, NSF_TopicId__r.Title__c,
                   NSF_TopicId__r.NSF_CatalogId__c, NSF_TopicId__r.NSF_CatalogId__r.Title__c
            FROM NSF_Notebook__c
            WHERE Id = :notebookId
            LIMIT 1
        ];
        if (notebooks.isEmpty()) {
            AuraHandledException ex = new AuraHandledException('Notebook not found.');
            ex.setMessage('Notebook not found.');
            throw ex;
        }
        return notebooks[0];
    }

    /**
     * Creates or updates a catalog.
     * @param catalogId - null for create, existing Id for update
     * @param title - catalog title
     * @return the upserted catalog Id
     */
    @AuraEnabled
    public static String upsertCatalog(String catalogId, String title) {
        try {
            NSF_Catalog__c catalog;
            if (String.isNotBlank(catalogId)) {
                catalog = new NSF_Catalog__c(Id = catalogId);
            } else {
                catalog = new NSF_Catalog__c();
            }
            catalog.Title__c = title;
            upsert catalog;
            return catalog.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Creates or updates a topic. Supports reparenting to a different catalog.
     */
    @AuraEnabled
    public static String upsertTopic(String topicId, String title, String catalogId) {
        try {
            NSF_Topic__c topic;
            if (String.isNotBlank(topicId)) {
                topic = new NSF_Topic__c(Id = topicId);
            } else {
                topic = new NSF_Topic__c();
            }
            topic.Title__c = title;
            topic.NSF_CatalogId__c = catalogId;
            upsert topic;
            return topic.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Creates or updates a notebook. Supports reparenting to a different topic.
     */
    @AuraEnabled
    public static String upsertNotebook(String notebookId, String title, String topicId) {
        try {
            NSF_Notebook__c notebook;
            if (String.isNotBlank(notebookId)) {
                notebook = new NSF_Notebook__c(Id = notebookId);
            } else {
                notebook = new NSF_Notebook__c();
            }
            notebook.Title__c = title;
            notebook.NSF_TopicId__c = topicId;
            upsert notebook;
            return notebook.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Deletes a catalog. Only allowed if no child topics exist.
     */
    @AuraEnabled
    public static void deleteCatalog(String catalogId) {
        Integer topicCount = [
            SELECT COUNT()
            FROM NSF_Topic__c
            WHERE NSF_CatalogId__c = :catalogId
        ];
        if (topicCount > 0) {
            AuraHandledException ex = new AuraHandledException('Cannot delete catalog with existing topics. Please delete all topics first.');
            ex.setMessage('Cannot delete catalog with existing topics. Please delete all topics first.');
            throw ex;
        }
        try {
            delete new NSF_Catalog__c(Id = catalogId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Deletes a topic. Only allowed if no child notebooks exist.
     */
    @AuraEnabled
    public static void deleteTopic(String topicId) {
        Integer notebookCount = [
            SELECT COUNT()
            FROM NSF_Notebook__c
            WHERE NSF_TopicId__c = :topicId
        ];
        if (notebookCount > 0) {
            AuraHandledException ex = new AuraHandledException('Cannot delete topic with existing notebooks. Please delete all notebooks first.');
            ex.setMessage('Cannot delete topic with existing notebooks. Please delete all notebooks first.');
            throw ex;
        }
        try {
            delete new NSF_Topic__c(Id = topicId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Deletes a notebook. All child sections and content will be cascade-deleted.
     * The UI should warn the user before calling this method.
     */
    @AuraEnabled
    public static void deleteNotebook(String notebookId) {
        try {
            // Delete all sections first (they have Restrict delete constraint on children)
            List<NSF_Section__c> sections = [
                SELECT Id FROM NSF_Section__c
                WHERE NSF_NotebookId__c = :notebookId
            ];
            if (!sections.isEmpty()) {
                // Delete all content in each section first
                Set<Id> sectionIds = new Set<Id>();
                for (NSF_Section__c s : sections) {
                    sectionIds.add(s.Id);
                }
                // Delete bookmarks for these sections
                delete [SELECT Id FROM NSF_Bookmark_Listing__c WHERE NSF_SectionId__c IN :sectionIds];
                // Delete content items (junction records auto-cascade via MasterDetail)
                delete [SELECT Id FROM NSF_Resource__c WHERE NSF_SectionId__c IN :sectionIds];
                delete [SELECT Id FROM NSF_Note__c WHERE NSF_SectionId__c IN :sectionIds];
                delete [SELECT Id FROM NSF_Card__c WHERE NSF_SectionId__c IN :sectionIds];
                delete [SELECT Id FROM NSF_Exam__c WHERE NSF_SectionId__c IN :sectionIds];
                // Now delete sections
                delete sections;
            }
            // Finally delete the notebook
            delete new NSF_Notebook__c(Id = notebookId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
