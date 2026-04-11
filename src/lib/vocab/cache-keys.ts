export const VocabCacheTag = {
  home:       (email: string) => `vh:home:${email}`,
  study:      (email: string) => `vh:study:${email}`,
  practiceUi: (email: string) => `vh:practice-ui:${email}`,
  flashcard:  (email: string, themeId: number) => `vh:flashcard:${email}:${themeId}`,
};
