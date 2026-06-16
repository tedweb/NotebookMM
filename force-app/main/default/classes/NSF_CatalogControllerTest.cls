/**
 * NSF_CatalogControllerTest
 * Tests for NSF_CatalogController: Catalog, Topic, and Notebook CRUD operations.
 */
@IsTest
private class NSF_CatalogControllerTest {

    @TestSetup
    static void setupTestData() {
        NSF_TestFactory.createFullHierarchy();
    }

    @IsTest
    static void testGetCatalogs() {
        // Create additional catalogs
        NSF_TestFactory.createCatalog('Alpha Catalog');
        NSF_TestFactory.createCatalog('Zeta Catalog');

        Test.startTest();
        List<NSF_Catalog__c> catalogs = NSF_CatalogController.getCatalogs();
        Test.stopTest();

        // Should have 3 catalogs (1 from setup + 2 new)
        System.assertEquals(3, catalogs.size(), 'Expected 3 catalogs');
        // Should be ordered by Title
        System.assertEquals('Alpha Catalog', catalogs[0].Title__c);
    }

    @IsTest
    static void testGetTopicsWithNotebooks() {
        NSF_Catalog__c catalog = [SELECT Id FROM NSF_Catalog__c LIMIT 1];

        Test.startTest();
        List<NSF_Topic__c> topics = NSF_CatalogController.getTopicsWithNotebooks(catalog.Id);
        Test.stopTest();

        System.assertEquals(1, topics.size(), 'Expected 1 topic');
        System.assertNotEquals(null, topics[0].Notebooks__r, 'Expected notebooks subquery');
        System.assertEquals(1, topics[0].Notebooks__r.size(), 'Expected 1 notebook');
    }

    @IsTest
    static void testGetNotebookDetail() {
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        Test.startTest();
        NSF_Notebook__c detail = NSF_CatalogController.getNotebookDetail(notebook.Id);
        Test.stopTest();

        System.assertNotEquals(null, detail, 'Expected notebook detail');
        System.assertEquals('Test Notebook', detail.Title__c);
        System.assertEquals('Test Topic', detail.NSF_TopicId__r.Title__c);
        System.assertEquals('Test Catalog', detail.NSF_TopicId__r.NSF_CatalogId__r.Title__c);
    }

    @IsTest
    static void testGetNotebookDetail_NotFound() {
        Test.startTest();
        try {
            // Use a fake Id that doesn't exist
            NSF_CatalogController.getNotebookDetail('a00000000000000AAA');
            System.assert(false, 'Expected AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('not found'), 'Expected not found message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpsertCatalog_Create() {
        Test.startTest();
        String catalogId = NSF_CatalogController.upsertCatalog(null, 'New Catalog');
        Test.stopTest();

        System.assertNotEquals(null, catalogId, 'Expected catalog Id');
        NSF_Catalog__c catalog = [SELECT Title__c FROM NSF_Catalog__c WHERE Id = :catalogId];
        System.assertEquals('New Catalog', catalog.Title__c);
    }

    @IsTest
    static void testUpsertCatalog_Update() {
        NSF_Catalog__c existing = [SELECT Id FROM NSF_Catalog__c LIMIT 1];

        Test.startTest();
        String catalogId = NSF_CatalogController.upsertCatalog(existing.Id, 'Updated Title');
        Test.stopTest();

        System.assertEquals(existing.Id, catalogId);
        NSF_Catalog__c updated = [SELECT Title__c FROM NSF_Catalog__c WHERE Id = :catalogId];
        System.assertEquals('Updated Title', updated.Title__c);
    }

    @IsTest
    static void testUpsertTopic_Create() {
        NSF_Catalog__c catalog = [SELECT Id FROM NSF_Catalog__c LIMIT 1];

        Test.startTest();
        String topicId = NSF_CatalogController.upsertTopic(null, 'New Topic', catalog.Id);
        Test.stopTest();

        System.assertNotEquals(null, topicId);
        NSF_Topic__c topic = [SELECT Title__c, NSF_CatalogId__c FROM NSF_Topic__c WHERE Id = :topicId];
        System.assertEquals('New Topic', topic.Title__c);
        System.assertEquals(catalog.Id, topic.NSF_CatalogId__c);
    }

    @IsTest
    static void testUpsertTopic_Reparent() {
        NSF_Topic__c existing = [SELECT Id, NSF_CatalogId__c FROM NSF_Topic__c LIMIT 1];
        NSF_Catalog__c newCatalog = NSF_TestFactory.createCatalog('New Parent Catalog');

        Test.startTest();
        String topicId = NSF_CatalogController.upsertTopic(existing.Id, 'Reparented Topic', newCatalog.Id);
        Test.stopTest();

        NSF_Topic__c updated = [SELECT NSF_CatalogId__c FROM NSF_Topic__c WHERE Id = :topicId];
        System.assertEquals(newCatalog.Id, updated.NSF_CatalogId__c);
    }

    @IsTest
    static void testUpsertNotebook_Create() {
        NSF_Topic__c topic = [SELECT Id FROM NSF_Topic__c LIMIT 1];

        Test.startTest();
        String notebookId = NSF_CatalogController.upsertNotebook(null, 'New Notebook', topic.Id);
        Test.stopTest();

        System.assertNotEquals(null, notebookId);
        NSF_Notebook__c notebook = [SELECT Title__c FROM NSF_Notebook__c WHERE Id = :notebookId];
        System.assertEquals('New Notebook', notebook.Title__c);
    }

    @IsTest
    static void testDeleteCatalog_NoChildren() {
        NSF_Catalog__c emptyC = NSF_TestFactory.createCatalog('Empty Catalog');

        Test.startTest();
        NSF_CatalogController.deleteCatalog(emptyC.Id);
        Test.stopTest();

        List<NSF_Catalog__c> remaining = [SELECT Id FROM NSF_Catalog__c WHERE Id = :emptyC.Id];
        System.assertEquals(0, remaining.size(), 'Catalog should be deleted');
    }

    @IsTest
    static void testDeleteCatalog_WithChildren() {
        NSF_Catalog__c catalog = [SELECT Id FROM NSF_Catalog__c LIMIT 1];

        Test.startTest();
        try {
            NSF_CatalogController.deleteCatalog(catalog.Id);
            System.assert(false, 'Expected AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Cannot delete catalog'), 'Expected guard message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testDeleteTopic_NoChildren() {
        NSF_Catalog__c catalog = [SELECT Id FROM NSF_Catalog__c LIMIT 1];
        NSF_Topic__c emptyTopic = NSF_TestFactory.createTopic('Empty Topic', catalog.Id);

        Test.startTest();
        NSF_CatalogController.deleteTopic(emptyTopic.Id);
        Test.stopTest();

        List<NSF_Topic__c> remaining = [SELECT Id FROM NSF_Topic__c WHERE Id = :emptyTopic.Id];
        System.assertEquals(0, remaining.size(), 'Topic should be deleted');
    }

    @IsTest
    static void testDeleteTopic_WithChildren() {
        NSF_Topic__c topic = [SELECT Id FROM NSF_Topic__c LIMIT 1];

        Test.startTest();
        try {
            NSF_CatalogController.deleteTopic(topic.Id);
            System.assert(false, 'Expected AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Cannot delete topic'), 'Expected guard message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testDeleteNotebook() {
        // Create a notebook with full content to test cascade
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c WHERE NSF_NotebookId__c = :notebook.Id LIMIT 1];
        NSF_TestFactory.createResource('Res 1', 'https://example.com', 'Link', section.Id);
        NSF_TestFactory.createNote('Note 1', section.Id);

        Test.startTest();
        NSF_CatalogController.deleteNotebook(notebook.Id);
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM NSF_Notebook__c WHERE Id = :notebook.Id]);
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Section__c WHERE NSF_NotebookId__c = :notebook.Id]);
    }
}
