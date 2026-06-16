/**
 * NSF_ContentControllerTest
 * Tests for NSF_ContentController: Resources, Notes, Cards, Exams CRUD.
 */
@IsTest
private class NSF_ContentControllerTest {

    @TestSetup
    static void setupTestData() {
        Map<String, SObject> hierarchy = NSF_TestFactory.createFullHierarchy();
        NSF_Section__c section = (NSF_Section__c) hierarchy.get('section');

        // Create content in the section
        NSF_Resource__c res = NSF_TestFactory.createResource('Test Resource', 'https://example.com', 'Link', section.Id);
        NSF_Note__c note = NSF_TestFactory.createNote('Test Note', section.Id);
        NSF_Card__c card = NSF_TestFactory.createCard('Front Q', 'Back A', 1, section.Id);
        NSF_Exam__c exam = NSF_TestFactory.createExam('Test Question?', 'Test Explanation', 1, section.Id);

        // Create answer candidates for exam
        NSF_TestFactory.createAnswer('Answer A', false, exam.Id);
        NSF_TestFactory.createAnswer('Answer B', true, exam.Id);
        NSF_TestFactory.createAnswer('Answer C', false, exam.Id);

        // Create junction records
        NSF_TestFactory.createResourceCard(card.Id, res.Id);
        NSF_TestFactory.createResourceExam(exam.Id, res.Id);

        // Create a bookmark
        NSF_TestFactory.createBookmark(section.Id, res.Id, null, null, null);
    }

    // ───────────────────────────────────────────────
    // RESOURCES
    // ───────────────────────────────────────────────

    @IsTest
    static void testGetResourcesByNotebook() {
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        Test.startTest();
        List<NSF_ContentController.SectionWithItems> sections =
            NSF_ContentController.getResourcesByNotebook(notebook.Id);
        Test.stopTest();

        System.assertEquals(1, sections.size(), 'Expected 1 section');
        System.assertEquals(1, sections[0].items.size(), 'Expected 1 resource');
        System.assertEquals(true, sections[0].items[0].isBookmarked, 'Expected resource to be bookmarked');
    }

    @IsTest
    static void testUpsertResource_Create() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        Test.startTest();
        String resId = NSF_ContentController.upsertResource(null, 'New Res', 'https://new.com', 'PDF', section.Id);
        Test.stopTest();

        System.assertNotEquals(null, resId);
        NSF_Resource__c res = [SELECT Title__c, Link__c, Type__c FROM NSF_Resource__c WHERE Id = :resId];
        System.assertEquals('New Res', res.Title__c);
        System.assertEquals('https://new.com', res.Link__c);
        System.assertEquals('PDF', res.Type__c);
    }

    @IsTest
    static void testUpsertResource_Update() {
        NSF_Resource__c existing = [SELECT Id FROM NSF_Resource__c LIMIT 1];

        Test.startTest();
        NSF_ContentController.upsertResource(existing.Id, 'Updated', 'https://updated.com', 'Video', null);
        Test.stopTest();

        NSF_Resource__c updated = [SELECT Title__c, Link__c FROM NSF_Resource__c WHERE Id = :existing.Id];
        System.assertEquals('Updated', updated.Title__c);
    }

    @IsTest
    static void testDeleteResource() {
        NSF_Resource__c resource = [SELECT Id FROM NSF_Resource__c LIMIT 1];

        Test.startTest();
        NSF_ContentController.deleteResource(resource.Id);
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM NSF_Resource__c WHERE Id = :resource.Id]);
        // Bookmark should also be cleaned up
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Bookmark_Listing__c WHERE NSF_ResourceId__c = :resource.Id]);
    }

    // ───────────────────────────────────────────────
    // NOTES
    // ───────────────────────────────────────────────

    @IsTest
    static void testGetNotesByNotebook() {
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        Test.startTest();
        List<NSF_ContentController.SectionWithItems> sections =
            NSF_ContentController.getNotesByNotebook(notebook.Id);
        Test.stopTest();

        System.assertEquals(1, sections.size());
        System.assertEquals(1, sections[0].items.size());
    }

    @IsTest
    static void testGetNoteDetail() {
        NSF_Note__c note = [SELECT Id FROM NSF_Note__c LIMIT 1];

        Test.startTest();
        NSF_Note__c detail = NSF_ContentController.getNoteDetail(note.Id);
        Test.stopTest();

        System.assertEquals('Test Note', detail.Title__c);
    }

    @IsTest
    static void testGetNoteDetail_NotFound() {
        Test.startTest();
        try {
            NSF_ContentController.getNoteDetail('a00000000000000AAA');
            System.assert(false, 'Expected AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('not found'));
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpsertNote() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        Test.startTest();
        String noteId = NSF_ContentController.upsertNote(null, 'New Note', section.Id);
        Test.stopTest();

        System.assertNotEquals(null, noteId);
        System.assertEquals('New Note', [SELECT Title__c FROM NSF_Note__c WHERE Id = :noteId].Title__c);
    }

    @IsTest
    static void testSaveNoteContent() {
        NSF_Note__c note = [SELECT Id FROM NSF_Note__c LIMIT 1];

        Test.startTest();
        NSF_ContentController.saveNoteContent(note.Id, '<p>Rich text content</p>');
        Test.stopTest();

        NSF_Note__c updated = [SELECT Content__c FROM NSF_Note__c WHERE Id = :note.Id];
        System.assertEquals('<p>Rich text content</p>', updated.Content__c);
    }

    @IsTest
    static void testDeleteNote() {
        NSF_Note__c note = [SELECT Id FROM NSF_Note__c LIMIT 1];

        Test.startTest();
        NSF_ContentController.deleteNote(note.Id);
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM NSF_Note__c WHERE Id = :note.Id]);
    }

    // ───────────────────────────────────────────────
    // CARDS
    // ───────────────────────────────────────────────

    @IsTest
    static void testGetCardSectionSummaries() {
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        Test.startTest();
        List<NSF_ContentController.SectionSummary> summaries =
            NSF_ContentController.getCardSectionSummaries(notebook.Id);
        Test.stopTest();

        System.assertEquals(1, summaries.size());
        System.assertEquals(1, summaries[0].itemCount);
        System.assertNotEquals(null, summaries[0].lastModified);
    }

    @IsTest
    static void testGetCardsBySection() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        Test.startTest();
        List<NSF_Card__c> cards = NSF_ContentController.getCardsBySection(section.Id);
        Test.stopTest();

        System.assertEquals(1, cards.size());
        System.assertEquals('Front Q', cards[0].Front__c);
    }

    @IsTest
    static void testUpsertCard_WithResources() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];
        NSF_Resource__c resource = [SELECT Id FROM NSF_Resource__c LIMIT 1];

        Test.startTest();
        String cardId = NSF_ContentController.upsertCard(
            null, 'New Front', 'New Back', 1, section.Id,
            new List<String>{ resource.Id }
        );
        Test.stopTest();

        System.assertNotEquals(null, cardId);
        // Verify junction record created
        System.assertEquals(1, [SELECT COUNT() FROM NSF_Resource_Card__c WHERE NSF_CardId__c = :cardId]);
    }

    @IsTest
    static void testUpsertCard_UpdateReplacesJunctions() {
        NSF_Card__c existing = [SELECT Id FROM NSF_Card__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        // Should have 1 junction from setup
        System.assertEquals(1, [SELECT COUNT() FROM NSF_Resource_Card__c WHERE NSF_CardId__c = :existing.Id]);

        Test.startTest();
        // Update with no resources - should remove junction
        NSF_ContentController.upsertCard(
            existing.Id, 'Updated Front', 'Updated Back', 2, section.Id,
            new List<String>()
        );
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM NSF_Resource_Card__c WHERE NSF_CardId__c = :existing.Id]);
    }

    @IsTest
    static void testDeleteCard() {
        NSF_Card__c card = [SELECT Id FROM NSF_Card__c LIMIT 1];

        Test.startTest();
        NSF_ContentController.deleteCard(card.Id);
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM NSF_Card__c WHERE Id = :card.Id]);
        // Junction records should auto-cascade
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Resource_Card__c WHERE NSF_CardId__c = :card.Id]);
    }

    @IsTest
    static void testSaveCardOrder() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];
        NSF_Card__c card2 = NSF_TestFactory.createCard('Second', 'Card', 2, section.Id);
        NSF_Card__c card1 = [SELECT Id FROM NSF_Card__c WHERE Order__c = 1 LIMIT 1];

        // Swap order
        String orderJson = '[{"id":"' + card1.Id + '","orderNum":2},{"id":"' + card2.Id + '","orderNum":1}]';

        Test.startTest();
        NSF_ContentController.saveCardOrder(orderJson);
        Test.stopTest();

        System.assertEquals(2, [SELECT Order__c FROM NSF_Card__c WHERE Id = :card1.Id].Order__c);
        System.assertEquals(1, [SELECT Order__c FROM NSF_Card__c WHERE Id = :card2.Id].Order__c);
    }

    // ───────────────────────────────────────────────
    // EXAMS
    // ───────────────────────────────────────────────

    @IsTest
    static void testGetExamSectionSummaries() {
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        Test.startTest();
        List<NSF_ContentController.SectionSummary> summaries =
            NSF_ContentController.getExamSectionSummaries(notebook.Id);
        Test.stopTest();

        System.assertEquals(1, summaries.size());
        System.assertEquals(1, summaries[0].itemCount);
    }

    @IsTest
    static void testGetExamsBySection() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        Test.startTest();
        List<NSF_Exam__c> exams = NSF_ContentController.getExamsBySection(section.Id);
        Test.stopTest();

        System.assertEquals(1, exams.size());
        System.assertEquals('Test Question?', exams[0].Question__c);
        System.assertEquals(3, exams[0].Answer_Candidates__r.size());
    }

    @IsTest
    static void testUpsertExam_WithAnswersAndResources() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];
        NSF_Resource__c resource = [SELECT Id FROM NSF_Resource__c LIMIT 1];

        String answersJson = '[' +
            '{"answer":"Option A","isCorrect":false},' +
            '{"answer":"Option B","isCorrect":true},' +
            '{"answer":"Option C","isCorrect":false}' +
        ']';

        Test.startTest();
        String examId = NSF_ContentController.upsertExam(
            null, 'New Question?', 'Explanation here', 1, section.Id,
            answersJson, new List<String>{ resource.Id }
        );
        Test.stopTest();

        System.assertNotEquals(null, examId);
        System.assertEquals(3, [SELECT COUNT() FROM NSF_Exam_Answer_Candidates__c WHERE NSF_Exam_ItemId__c = :examId]);
        System.assertEquals(1, [SELECT COUNT() FROM NSF_Resource_Exam__c WHERE NSF_ExamId__c = :examId]);
    }

    @IsTest
    static void testUpsertExam_UpdateReplacesAll() {
        NSF_Exam__c existing = [SELECT Id FROM NSF_Exam__c LIMIT 1];
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];

        String answersJson = '[' +
            '{"answer":"New A","isCorrect":true},' +
            '{"answer":"New B","isCorrect":false},' +
            '{"answer":"New C","isCorrect":false},' +
            '{"answer":"New D","isCorrect":false}' +
        ']';

        Test.startTest();
        NSF_ContentController.upsertExam(
            existing.Id, 'Updated Q?', 'Updated Exp', 1, section.Id,
            answersJson, new List<String>()
        );
        Test.stopTest();

        // Should have 4 new answer candidates (old 3 deleted, 4 new inserted)
        System.assertEquals(4, [SELECT COUNT() FROM NSF_Exam_Answer_Candidates__c WHERE NSF_Exam_ItemId__c = :existing.Id]);
        // Old junction should be deleted, no new ones
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Resource_Exam__c WHERE NSF_ExamId__c = :existing.Id]);
    }

    @IsTest
    static void testDeleteExam() {
        NSF_Exam__c exam = [SELECT Id FROM NSF_Exam__c LIMIT 1];

        Test.startTest();
        NSF_ContentController.deleteExam(exam.Id);
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM NSF_Exam__c WHERE Id = :exam.Id]);
        // Answer candidates and junction records should auto-cascade
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Exam_Answer_Candidates__c WHERE NSF_Exam_ItemId__c = :exam.Id]);
        System.assertEquals(0, [SELECT COUNT() FROM NSF_Resource_Exam__c WHERE NSF_ExamId__c = :exam.Id]);
    }

    @IsTest
    static void testSaveExamOrder() {
        NSF_Section__c section = [SELECT Id FROM NSF_Section__c LIMIT 1];
        NSF_Exam__c exam2 = NSF_TestFactory.createExam('Q2?', 'E2', 2, section.Id);
        NSF_Exam__c exam1 = [SELECT Id FROM NSF_Exam__c WHERE Order__c = 1 LIMIT 1];

        String orderJson = '[{"id":"' + exam1.Id + '","orderNum":2},{"id":"' + exam2.Id + '","orderNum":1}]';

        Test.startTest();
        NSF_ContentController.saveExamOrder(orderJson);
        Test.stopTest();

        System.assertEquals(2, [SELECT Order__c FROM NSF_Exam__c WHERE Id = :exam1.Id].Order__c);
        System.assertEquals(1, [SELECT Order__c FROM NSF_Exam__c WHERE Id = :exam2.Id].Order__c);
    }

    // ───────────────────────────────────────────────
    // SHARED RESOURCE METHODS
    // ───────────────────────────────────────────────

    @IsTest
    static void testGetResourcesForSelection() {
        NSF_Notebook__c notebook = [SELECT Id FROM NSF_Notebook__c LIMIT 1];

        Test.startTest();
        List<NSF_Resource__c> resources = NSF_ContentController.getResourcesForSelection(notebook.Id);
        Test.stopTest();

        System.assertEquals(1, resources.size());
        System.assertNotEquals(null, resources[0].NSF_SectionId__r.Title__c);
    }

    @IsTest
    static void testGetLinkedResources_Card() {
        NSF_Card__c card = [SELECT Id FROM NSF_Card__c LIMIT 1];

        Test.startTest();
        List<NSF_Resource__c> resources = NSF_ContentController.getLinkedResources(card.Id, 'Card');
        Test.stopTest();

        System.assertEquals(1, resources.size());
        System.assertEquals('Test Resource', resources[0].Title__c);
    }

    @IsTest
    static void testGetLinkedResources_Exam() {
        NSF_Exam__c exam = [SELECT Id FROM NSF_Exam__c LIMIT 1];

        Test.startTest();
        List<NSF_Resource__c> resources = NSF_ContentController.getLinkedResources(exam.Id, 'Exam');
        Test.stopTest();

        System.assertEquals(1, resources.size());
    }

    @IsTest
    static void testGetLinkedResources_InvalidType() {
        Test.startTest();
        List<NSF_Resource__c> resources = NSF_ContentController.getLinkedResources('someId', 'Invalid');
        Test.stopTest();

        System.assertEquals(0, resources.size());
    }
}
