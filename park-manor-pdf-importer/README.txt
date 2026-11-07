Park Manor — WeconnectU/Davies PDF importer
===========================================
Drop these three files into your repo's public/ folder (replace index.html,
add the two new pm-*.js modules alongside it), commit, and let Netlify build.

  public/index.html        (updated — adds the "Import PDFs" button + importer)
  public/pm-weconnectu.js  (new — parses WeconnectU invoice/statement/credit-note PDFs)
  public/pm-mapper.js      (new — maps parsed docs onto units; billing rules)

Use: Billing tab -> "Import PDFs" -> select a month's PDFs -> Parse files ->
review the summary + flags -> Apply to units. Nothing saves until you Apply.
Garages (sections 13+) are not billed; a payment mis-allocated to a garage is
moved to the owner's main unit (e.g. door 19 -> door 10).
