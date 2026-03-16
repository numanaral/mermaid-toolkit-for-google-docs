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

const CONTENT_FIELDS =
  "body.content(startIndex,endIndex,paragraph(bullet,elements(startIndex,endIndex,textRun(content))))";

export const getTabContent = (
  docId: string,
  tabId: string,
  isFirstTab: boolean,
): GoogleAppsScript.Docs.Schema.StructuralElement[] | null => {
  if (typeof Docs === "undefined" || !Docs?.Documents) return null;

  if (!tabId || isFirstTab) {
    return (
      Docs.Documents.get(docId, { fields: CONTENT_FIELDS })?.body?.content ??
      null
    );
  }

  const tabFields =
    "tabs(tabProperties/tabId,documentTab/" + CONTENT_FIELDS + ")";
  const doc = Docs.Documents.get(docId, {
    includeTabsContent: true,
    fields: tabFields,
  }) as unknown as {
    tabs?: {
      documentTab?: {
        body?: { content?: GoogleAppsScript.Docs.Schema.StructuralElement[] };
      };
      tabProperties?: { tabId?: string };
      childTabs?: unknown[];
    }[];
  };

  if (!doc.tabs) return null;
  const findTab = (
    tabs: typeof doc.tabs,
  ): GoogleAppsScript.Docs.Schema.StructuralElement[] | null => {
    for (const tab of tabs!) {
      if (tab.tabProperties?.tabId === tabId) {
        return tab.documentTab?.body?.content ?? null;
      }
      if (tab.childTabs) {
        const found = findTab(tab.childTabs as typeof doc.tabs);
        if (found) return found;
      }
    }
    return null;
  };
  return findTab(doc.tabs);
};
