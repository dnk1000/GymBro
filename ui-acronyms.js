// Presentation only: explanations never modify stored records or form values.
const ACRONYM_HELP = Object.freeze({
  RPE: "Rating of Perceived Exertion: how hard the set felt, on a 1–10 scale.",
  RIR: "Repetitions in Reserve: estimated additional reps you could perform before failure.",
  JSON: "JavaScript Object Notation: the structured file format used for full backups and workout imports.",
  CSV: "Comma-Separated Values: a spreadsheet-friendly export of sets, not a complete backup.",
});
function explainAcronyms(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement.closest("abbr,script,style,textarea,option,svg"))
      continue;
    const matches = [...node.textContent.matchAll(/\b(?:RPE|RIR|JSON|CSV)\b/g)];
    if (!matches.length) continue;
    const button = node.parentElement.closest("button");
    if (button) {
      button.title = [
        ...new Set(matches.map((match) => ACRONYM_HELP[match[0]])),
      ].join(" ");
      continue;
    }
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      fragment.append(node.textContent.slice(offset, match.index));
      const abbr = document.createElement("abbr");
      abbr.textContent = match[0];
      abbr.title = ACRONYM_HELP[match[0]];
      fragment.append(abbr);
      offset = match.index + match[0].length;
    }
    fragment.append(node.textContent.slice(offset));
    node.replaceWith(fragment);
  }
}
