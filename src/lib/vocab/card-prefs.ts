/**
 * Flashcard style preferences — chosen during onboarding, editable in vocab
 * settings. Stored on vocab_user_progress (card_* columns).
 */

export type DefinitionVariant = 'standard' | 'alt';

export interface CardPrefs {
  definitionVariant: DefinitionVariant;
  showExample:       boolean;
  showSynonyms:      boolean;
  showConnotation:   boolean;
  showContrast:      boolean;
}

export const DEFAULT_CARD_PREFS: CardPrefs = {
  definitionVariant: 'standard',
  showExample:       true,
  showSynonyms:      true,
  showConnotation:   false,
  showContrast:      false,
};

/** Row shape from vocab_user_progress — nullable while the user has no row yet. */
export function toCardPrefs(row: {
  cardDefinitionVariant: string;
  cardShowExample:       boolean;
  cardShowSynonyms:      boolean;
  cardShowConnotation:   boolean;
  cardShowContrast:      boolean;
} | null | undefined): CardPrefs {
  if (!row) return DEFAULT_CARD_PREFS;
  return {
    definitionVariant: row.cardDefinitionVariant === 'alt' ? 'alt' : 'standard',
    showExample:       row.cardShowExample,
    showSynonyms:      row.cardShowSynonyms,
    showConnotation:   row.cardShowConnotation,
    showContrast:      row.cardShowContrast,
  };
}
