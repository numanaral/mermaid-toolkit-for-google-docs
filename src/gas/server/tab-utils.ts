export const getActiveBody = (
  doc: GoogleAppsScript.Document.Document,
): {
  body: GoogleAppsScript.Document.Body;
  tabId: string;
  isFirstTab: boolean;
} => {
  try {
    const tab = doc.getActiveTab();
    const isFirst = tab.getIndex() === 0;
    return {
      body: tab.asDocumentTab().getBody(),
      tabId: tab.getId(),
      isFirstTab: isFirst,
    };
  } catch {
    return { body: doc.getBody(), tabId: "", isFirstTab: true };
  }
};
