/**
 * NSF_TestFactory
 * Shared test data factory for NotebookSF test classes.
 * Creates hierarchy and content records for test methods.
 */
@IsTest
public class NSF_TestFactory {

    public static NSF_Catalog__c createCatalog(String title) {
        NSF_Catalog__c catalog = new NSF_Catalog__c(Title__c = title);
        insert catalog;
        return catalog;
    }

    public static NSF_Topic__c createTopic(String title, Id catalogId) {
        NSF_Topic__c topic = new NSF_Topic__c(
            Title__c = title,
            NSF_CatalogId__c = catalogId
        );
        insert topic;
        return topic;
    }

    public static NSF_Notebook__c createNotebook(String title, Id topicId) {
        NSF_Notebook__c notebook = new NSF_Notebook__c(
            Title__c = title,
            NSF_TopicId__c = topicId
        );
        insert notebook;
        return notebook;
    }

    public static NSF_Section__c createSection(String title, Id notebookId) {
        NSF_Section__c section = new NSF_Section__c(
            Title__c = title,
            NSF_NotebookId__c = notebookId
        );
        insert section;
        return section;
    }

    public static NSF_Resource__c createResource(String title, String link, String resourceType, Id sectionId) {
        NSF_Resource__c resource = new NSF_Resource__c(
            Title__c = title,
            Link__c = link,
            Type__c = resourceType,
            NSF_SectionId__c = sectionId
        );
        insert resource;
        return resource;
    }

    public static NSF_Note__c createNote(String title, Id sectionId) {
        NSF_Note__c note = new NSF_Note__c(
            Title__c = title,
            NSF_SectionId__c = sectionId
        );
        insert note;
        return note;
    }

    public static NSF_Card__c createCard(String front, String back, Integer orderNum, Id sectionId) {
        NSF_Card__c card = new NSF_Card__c(
            Front__c = front,
            Back__c = back,
            Order__c = orderNum,
            NSF_SectionId__c = sectionId
        );
        insert card;
        return card;
    }

    public static NSF_Exam__c createExam(String question, String explanation, Integer orderNum, Id sectionId) {
        NSF_Exam__c exam = new NSF_Exam__c(
            Question__c = question,
            Explanation__c = explanation,
            Order__c = orderNum,
            NSF_SectionId__c = sectionId
        );
        insert exam;
        return exam;
    }

    public static NSF_Exam_Answer_Candidates__c createAnswer(String answer, Boolean isCorrect, Id examId) {
        NSF_Exam_Answer_Candidates__c answerCandidate = new NSF_Exam_Answer_Candidates__c(
            Possible_Answer__c = answer,
            Is_Correct__c = isCorrect,
            NSF_Exam_ItemId__c = examId
        );
        insert answerCandidate;
        return answerCandidate;
    }

    public static NSF_Bookmark_Listing__c createBookmark(Id sectionId, Id resourceId, Id noteId, Id cardId, Id examId) {
        NSF_Bookmark_Listing__c bookmark = new NSF_Bookmark_Listing__c(
            NSF_SectionId__c = sectionId,
            NSF_ResourceId__c = resourceId,
            NSF_NoteId__c = noteId,
            NSF_CardId__c = cardId,
            NSF_ExamId__c = examId
        );
        insert bookmark;
        return bookmark;
    }

    public static NSF_Resource_Card__c createResourceCard(Id cardId, Id resourceId) {
        NSF_Resource_Card__c rc = new NSF_Resource_Card__c(
            NSF_CardId__c = cardId,
            NSF_ResourceId__c = resourceId
        );
        insert rc;
        return rc;
    }

    public static NSF_Resource_Note__c createResourceNote(Id noteId, Id resourceId) {
        NSF_Resource_Note__c rn = new NSF_Resource_Note__c(
            NSF_NoteId__c = noteId,
            NSF_ResourceId__c = resourceId
        );
        insert rn;
        return rn;
    }

    public static NSF_Resource_Exam__c createResourceExam(Id examId, Id resourceId) {
        NSF_Resource_Exam__c re = new NSF_Resource_Exam__c(
            NSF_ExamId__c = examId,
            NSF_ResourceId__c = resourceId
        );
        insert re;
        return re;
    }

    /**
     * Creates a full hierarchy: Catalog -> Topic -> Notebook -> Section
     * Returns a map with keys: 'catalog', 'topic', 'notebook', 'section'
     */
    public static Map<String, SObject> createFullHierarchy() {
        NSF_Catalog__c catalog = createCatalog('Test Catalog');
        NSF_Topic__c topic = createTopic('Test Topic', catalog.Id);
        NSF_Notebook__c notebook = createNotebook('Test Notebook', topic.Id);
        NSF_Section__c section = createSection('Test Section', notebook.Id);

        Map<String, SObject> hierarchy = new Map<String, SObject>();
        hierarchy.put('catalog', catalog);
        hierarchy.put('topic', topic);
        hierarchy.put('notebook', notebook);
        hierarchy.put('section', section);
        return hierarchy;
    }
}
