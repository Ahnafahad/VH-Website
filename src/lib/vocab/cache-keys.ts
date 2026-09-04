export const VocabCacheTag = {
  home:       (email: string) => `vh:home:${email}`,
  study:      (email: string) => `vh:study:${email}`,
  practiceUi: (email: string) => `vh:practice-ui:${email}`,
  flashcard:  (email: string, themeId: number) => `vh:flashcard:${email}:${themeId}`,
  // Every flashcard session also carries this tag, so a card-preference change
  // can drop all of a user's cached sessions at once.
  flashcardAll: (email: string) => `vh:flashcard-all:${email}`,
  letters:    (userId: number) => `vh:letters:${userId}`,
};
