/**
 * NSF_BookmarkControllerTest
 * Tests for NSF_BookmarkController: bookmark toggle and query operations.
 */
@IsTest
private class NSF_BookmarkControllerTest {

    @TestSetup
    static void setupTestData() {
        Map<String, SObject> hierarchy = NSF_TestFactory.createFullHierarchy();
        NSF_Section__c section = (NSF_Section__c) hierarchy.get('section');

        NSF_TestFactory.createResource('Bookmarkable Resource', 'https://example.com', 'Link', section.Id);
        NSF_TestFactory.createNote('Bookmarkable Note', section.Id);
        NSF_TestFactory.createCard('BM Front', 'BM Back', 1, section.Id);
        NSF_TestFactory.createExam('BM Question?', 'BM Explanation', 1, section.Id);
    }

    @IsTest
    static void testToggleBookmark_AddResource() {
        NSF_Resource__c resource = [SELECT Id FROM NSF_Resource__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        Test.startTest();
        Boolean result = NSF_BookmarkController.toggleBookmark(resource.Id, 'Resource', section.Id);
        Test.stopTest();

        System.assertEquals(true, result, 'Expected bookmark to be added');
        System.assertEquals(1, [SELECT COUNT() FROM NSF_Bookmark_Listing__c WHERE NSF_ResourceId__c = :resource.Id]);
    }

    @IsTest
    static void testToggleBookmark_RemoveResource() {
        NSF_Resource__c resource = [SELECT Id FROM NSF_Resource__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        // First add bookmark
        NSF_TestFactory.createBookmark(section.Id, resource.Id, null, null, null);

        Test.startTest();
        Boolean result = NSF_BookmarkController.toggleBookmark(resource.Id, 'Resource', section.Id);
        Test.stopTest();

        System.assertEquals(false, result, 'Expected bookmark to be removed');
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Bookmark_Listing__c WHERE NSF_ResourceId__c = :resource.Id]);
    }

    @IsTest
    static void testToggleBookmark_AddNote() {
        NSF_Note__c note = [SELECT Id FROM NSF_Note__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        Test.startTest();
        Boolean result = NSF_BookmarkController.toggleBookmark(note.Id, 'Note', section.Id);
        Test.stopTest();

        System.assertEquals(true, result);
        System.assertEquals(1, [SELECT COUNT() FROM NSF_Bookmark_Listing__c WHERE NSF_NoteId__c = :note.Id]);
    }

    @IsTest
    static void testToggleBookmark_AddCard() {
        NSF_Card__c card = [SELECT Id FROM NSF_Card__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        Test.startTest();
        Boolean result = NSF_BookmarkController.toggleBookmark(card.Id, 'Card', section.Id);
        Test.stopTest();

        System.assertEquals(true, result);
    }

    @IsTest
    static void testToggleBookmark_AddExam() {
        NSF_Exam__c exam = [SELECT Id FROM NSF_Exam__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        Test.startTest();
        Boolean result = NSF_BookmarkController.toggleBookmark(exam.Id, 'Exam', section.Id);
        Test.stopTest();

        System.assertEquals(true, result);
    }

    @IsTest
    static void testToggleBookmark_InvalidType() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        Test.startTest();
        try {
            NSF_BookmarkController.toggleBookmark('someId', 'InvalidType', section.Id);
            System.assert(false, 'Expected AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Invalid record type'));
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetBookmarkedItems_Resources() {
        NSF_Resource__c resource = [SELECT Id FROM NSF_Resource__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        NSF_TestFactory.createBookmark(section.Id, resource.Id, null, null, null);

        Test.startTest();
        List<SObject> bookmarks = NSF_BookmarkController.getBookmarkedItems(notebook.Id, 'Resources');
        Test.stopTest();

        System.assertEquals(1, bookmarks.size());
    }

    @IsTest
    static void testGetBookmarkedItems_Notes() {
        NSF_Note__c note = [SELECT Id FROM NSF_Note__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        NSF_TestFactory.createBookmark(section.Id, null, note.Id, null, null);

        Test.startTest();
        List<SObject> bookmarks = NSF_BookmarkController.getBookmarkedItems(notebook.Id, 'Notes');
        Test.stopTest();

        System.assertEquals(1, bookmarks.size());
    }

    @IsTest
    static void testGetBookmarkedItems_Cards() {
        NSF_Card__c card = [SELECT Id FROM NSF_Card__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        NSF_TestFactory.createBookmark(section.Id, null, null, card.Id, null);

        Test.startTest();
        List<SObject> bookmarks = NSF_BookmarkController.getBookmarkedItems(notebook.Id, 'Cards');
        Test.stopTest();

        System.assertEquals(1, bookmarks.size());
    }

    @IsTest
    static void testGetBookmarkedItems_Exams() {
        NSF_Exam__c exam = [SELECT Id FROM NSF_Exam__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        NSF_TestFactory.createBookmark(section.Id, null, null, null, exam.Id);

        Test.startTest();
        List<SObject> bookmarks = NSF_BookmarkController.getBookmarkedItems(notebook.Id, 'Exams');
        Test.stopTest();

        System.assertEquals(1, bookmarks.size());
    }

    @IsTest
    static void testGetBookmarkedItems_Empty() {
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        Test.startTest();
        List<SObject> bookmarks = NSF_BookmarkController.getBookmarkedItems(notebook.Id, 'Resources');
        Test.stopTest();

        System.assertEquals(0, bookmarks.size());
    }

    @IsTest
    static void testIsBookmarked_True() {
        NSF_Resource__c resource = [SELECT Id FROM NSF_Resource__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        NSF_TestFactory.createBookmark(section.Id, resource.Id, null, null, null);

        Test.startTest();
        Boolean result = NSF_BookmarkController.isBookmarked(resource.Id, 'Resource');
        Test.stopTest();

        System.assertEquals(true, result);
    }

    @IsTest
    static void testIsBookmarked_False() {
        NSF_Resource__c resource = [SELECT Id FROM NSF_Resource__c LIMIT 1];

        Test.startTest();
        Boolean result = NSF_BookmarkController.isBookmarked(resource.Id, 'Resource');
        Test.stopTest();

        System.assertEquals(false, result);
    }
}
