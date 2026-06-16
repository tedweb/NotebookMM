/**
 * NSF_SectionControllerTest
 * Tests for NSF_SectionController: Section CRUD operations.
 */
@IsTest
private class NSF_SectionControllerTest {

    @TestSetup
    static void setupTestData() {
        NSF_TestFactory.createFullHierarchy();
    }

    @IsTest
    static void testGetSectionsByNotebook() {
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];
        // Create additional section
        NSF_TestFactory.createSection('Another Section', notebook.Id);

        Test.startTest();
        List<NSF_Section__c> sections = NSF_SectionController.getSectionsByNotebook(notebook.Id);
        Test.stopTest();

        System.assertEquals(2, sections.size(), 'Expected 2 sections');
    }

    @IsTest
    static void testUpsertSection_Create() {
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        Test.startTest();
        String sectionId = NSF_SectionController.upsertSection(null, 'New Section', notebook.Id);
        Test.stopTest();

        System.assertNotEquals(null, sectionId);
        NSF_Section__c section = [SELECT Title__c FROM NSF_Section__c WHERE Id = :sectionId];
        System.assertEquals('New Section', section.Title__c);
    }

    @IsTest
    static void testUpsertSection_Update() {
        NSF_Section__c existing = [SELECT Id FROM NSF_Section__c LIMIT 1];
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        Test.startTest();
        String sectionId = NSF_SectionController.upsertSection(existing.Id, 'Renamed Section', notebook.Id);
        Test.stopTest();

        NSF_Section__c updated = [SELECT Title__c FROM NSF_Section__c WHERE Id = :sectionId];
        System.assertEquals('Renamed Section', updated.Title__c);
    }

    @IsTest
    static void testDeleteSection_CascadeDelete() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];
        // Add content to the section
        NSF_Resource__c resource = NSF_TestFactory.createResource('Res', 'https://test.com', 'Link', section.Id);
        NSF_Note__c note = NSF_TestFactory.createNote('Note', section.Id);
        NSF_Card__c card = NSF_TestFactory.createCard('Front', 'Back', 1, section.Id);
        NSF_Exam__c exam = NSF_TestFactory.createExam('Q?', 'A.', 1, section.Id);
        // Add a bookmark
        NSF_TestFactory.createBookmark(section.Id, resource.Id, null, null, null);

        Test.startTest();
        NSF_SectionController.deleteSection(section.Id);
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM NSF_Section__c WHERE Id = :section.Id]);
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Resource__c WHERE NSF_SectionId__c = :section.Id]);
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Note__c WHERE NSF_SectionId__c = :section.Id]);
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Card__c WHERE NSF_SectionId__c = :section.Id]);
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Exam__c WHERE NSF_SectionId__c = :section.Id]);
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Bookmark_Listing__c WHERE NSF_SectionId__c = :section.Id]);
    }
}
