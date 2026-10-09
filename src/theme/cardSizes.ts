/**
 * One set of sizes for every card and card-like row in the app (Card, ListRow, GadgetCard, the document rows, the
 * upload bars and the text inside them), so nothing is bigger or smaller than its neighbours. Change a number here and
 * every card follows.
 */
export const CARD = {
  radius: 16,
  padding: 16,
  /** space between two stacked cards */
  gap: 12,
};

/** The icon box at the left of a card row (documents, list rows, tiles). */
export const CARD_ICON = 40;

/** Text inside a card: name lines, normal lines, secondary lines, and small captions. */
export const CARD_TEXT = {
  title: 15,
  body: 13.5,
  meta: 12.5,
  tiny: 11.5,
};
