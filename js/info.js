/* Bier Sammler – Info-Fenster „Bierwissen“ (window.INFO). INFO-FENSTER: Alles dazu steht in dieser Datei und in den mit
   „INFO-FENSTER“ markierten Stellen (index.html, js/app.js, css/style.css, sw.js).

   Reiner Text, keine Daten aus Firestore oder der Bierdatenbank: Alle Strings stehen hier fest im Code, deshalb braucht es
   kein esc(). Wer eine Sorte oder einen Begriff ergänzen will, trägt einfach eine Zeile in die Listen unten ein.

   Aufbau: Biersorten (in Gruppen), Geschmack, Wissenswertes. Die Sorten decken die Namen ab, die in biere.json unter
   „biersorte“ vorkommen (Variante wie „Helles Vollbier“ oder „Dunkles Hefeweizen“ steht beim Grundbegriff mit dabei). */
window.INFO = (() => {
  'use strict';

  // [Name, Erklärung] – Namen mit „/“ fassen Schreibweisen und Varianten zusammen
  const SORTEN = [
    {
      titel: 'Helle Lagerbiere',
      sub: 'untergärig, klar, golden',
      text: 'Die Klassiker der deutschen Theke: untergärig gebraut (siehe „Wissenswertes“), kühl gereift und deshalb sauber und klar im Geschmack.',
      items: [
        ['Helles', 'Mildes, malziges Bier aus München mit wenig Bittere und goldgelber Farbe. Der Alleskönner für den Biergarten, meist 4,7–5,2 %. Dazu zählt auch das „Helle Vollbier“.'],
        ['Pils / Pilsner', 'Herb und hopfenbetont mit feiner Bittere, trockenem Abgang und festem Schaum. Benannt nach der böhmischen Stadt Pilsen (1842). Meist 4,4–5,2 %.'],
        ['Export', 'Etwas stärker und vollmundiger als ein Helles, weniger herb als ein Pils. Ursprünglich für den Transport in andere Städte und Länder gebraut (Dortmund). Meist 5,0–5,6 %.'],
        ['Lager', 'Oberbegriff für untergärig gebraute und lange gelagerte Biere (das Wort kommt von „Lager“, also Lagerung). International meist ein helles, mildes, gut trinkbares Bier.'],
        ['Zwickel / Kellerbier', 'Naturtrüb und nicht filtriert, deshalb hefig, frisch und oft etwas malziger. Der Name kommt vom „Zwickelhahn“, mit dem Brauer früher Proben aus dem Fass zapften; das Kellerbier lagerte im kühlen Felsenkeller.'],
        ['Märzen / Festbier', 'Das Märzen wurde früher im März gebraut und überstand den Sommer im Keller. Heute ist es ein vollmundiges, malzbetontes Bier um 5,5–6 %. Das Festbier (zum Beispiel vom Oktoberfest) ist hell, süffig und etwas stärker.'],
        ['Vollbier / Schankbier', 'Das sind steuerliche Einordnungen nach der Stammwürze: Ein Vollbier ist das normale Bier (11–16 % Stammwürze), ein Schankbier leichter (7–11 %) mit meist weniger Alkohol.'],
        ['Landbier', 'Kein geschützter Begriff. Meist ein rustikales, würziges, oft naturtrübes Bier aus einer regionalen Brauerei.'],
        ['Leichtes Bier', 'Weniger Alkohol und Kalorien als ein normales Bier, dafür etwas schlanker im Geschmack. Gibt es auch als Weizen, Kölsch oder Pils.'],
      ],
    },
    {
      titel: 'Weizenbiere',
      sub: 'obergärig, fruchtig, spritzig',
      text: 'Mindestens die Hälfte des Malzes ist Weizen. Obergärige Hefe sorgt für den typischen Duft nach Banane und Nelke; viel Kohlensäure macht sie spritzig.',
      items: [
        ['Weizenbier / Weißbier / Hefeweizen', 'Der Klassiker aus Bayern: trüb, weil die Hefe im Glas bleibt, mit viel Schaum, fruchtig und würzig. Gehört in ein hohes Weizenglas.'],
        ['Kristallweizen', 'Wie das Hefeweizen, aber gefiltert und deshalb klar. Wirkt frischer und leichter, weniger hefig.'],
        ['Dunkles Weizenbier', 'Mit dunklem Malz gebraut: Neben der Frucht kommen Karamell, Brot und ein Hauch Schokolade dazu.'],
        ['Weizenbock', 'Das kräftige Weizen mit meist 6,5–8 %: dicht, fruchtig-süß und wärmend. Es gibt helle und dunkle Varianten.'],
        ['Rauchweizen', 'Weizenbier mit geräuchertem Malz: Aroma nach Rauch und Speck.'],
        ['Weißbierpils / Eisweizenbier', 'Seltene Sonderformen: ein Weizenbier mit pilsartiger Hopfenbittere und ein Weizenbier, das durch Ausfrieren von Wasser konzentriert wurde (meist stärker und intensiver).'],
      ],
    },
    {
      titel: 'Dunkle und kräftige Biere',
      sub: 'malzig, röstig, stark',
      text: 'Hier prägt das Malz den Geschmack: Je stärker es geröstet wird, desto dunkler wird das Bier und desto mehr schmeckt man Brot, Karamell, Kaffee oder Schokolade.',
      items: [
        ['Dunkles', 'Untergäriges Bier aus dunklem Malz: mild, malzig, mit Noten von Brotkruste und Karamell, aber nicht bitter. Auch „Dunkles Exportbier“ oder „Dunkles Landbier“ gehören dazu.'],
        ['Schwarzbier', 'Fast schwarz, aber überraschend leicht und mild: geröstete Aromen, wenig Bittere. Typisch für Thüringen und Sachsen.'],
        ['Bockbier / Bock', 'Starkes, malziges Bier mit 6,5–7,5 % und mindestens 16 % Stammwürze. Der Name kommt vermutlich von Einbeck („Oambock“). Es gibt helle und dunkle Böcke.'],
        ['Doppelbock', 'Noch stärker (ab 18 % Stammwürze, meist 7–10 %), sehr malzig und leicht süßlich, fast wie flüssiges Brot. Klöster brauten ihn für die Fastenzeit; viele Namen enden auf „-ator“.'],
        ['Maibock', 'Ein heller Bock, der im Frühjahr ausgeschenkt wird: kräftig, aber weniger süß als ein dunkler Bock.'],
        ['Starkbier', 'Sammelbegriff für Biere mit hoher Stammwürze (ab 16 %). Bock, Doppelbock und Weizenbock sind Starkbiere.'],
        ['Altbier', 'Düsseldorfer Spezialität: obergärig, kupferbraun, herb und leicht nussig, kühl gereift („alt“ = die alte, obergärige Brauart).'],
        ['Kölsch', 'Nur aus Köln und Umgebung: obergärig, hell, mild und leicht fruchtig. Wird traditionell in schmalen 0,2-Liter-Gläsern, den „Stangen“, getrunken.'],
        ['Rotbier / Braunbier', 'Rötlich bzw. bräunlich, mild und malzig, mit wenig Hopfen. Das Rotbier hat eine Tradition in Franken.'],
        ['Rauchbier', 'Aus Bamberg: Das Malz wird über Buchenholzfeuer gedarrt, das Bier schmeckt nach Rauch und Schinken. Ein Geschmack, an den man sich gewöhnen muss.'],
        ['Roggenbier', 'Mindestens die Hälfte Roggenmalz: würzig, leicht herb-säuerlich und brotig.'],
      ],
    },
    {
      titel: 'Ales und Craft-Biere',
      sub: 'obergärig, aromatisch, international',
      text: 'Ales sind obergärige Biere, die wärmer vergoren werden. Dadurch entstehen mehr Fruchtaromen. Viele Craft-Brauer arbeiten mit solchen Sorten.',
      items: [
        ['Ale', 'Oberbegriff für obergärige Biere aus England und der Welt: fruchtig, aromatisch, oft kräftiger im Körper als ein Lager.'],
        ['Pale Ale / IPA', 'Helles Ale mit viel Hopfen: fruchtig, blumig, nach Zitrus oder Grapefruit, oft deutlich bitter. Das IPA („India Pale Ale“) ist die stärkere, noch hopfigere Version.'],
        ['Porter', 'Dunkles Ale aus London mit Röstmalz: Schokolade, Kaffee und Karamell, meist weich und rund.'],
        ['Stout', 'Fast schwarz, dicht und cremig mit Röstaromen von Kaffee und dunkler Schokolade. Der berühmteste Stout kommt aus Irland. Ein „Milk Stout“ ist süßer, ein „Imperial Stout“ sehr stark.'],
        ['Belgisches Bier', 'Eine große Familie: von würzigen Klosterbieren (Dubbel, Tripel) über das helle Witbier mit Koriander und Orange bis zu sauren Bieren. Oft fruchtig, würzig und stark.'],
        ['Gose', 'Ursprünglich aus Goslar, heute aus Leipzig bekannt: leicht säuerlich und etwas salzig, mit Koriander gewürzt. Sehr erfrischend.'],
        ['Lambic / Gueuze / Kriek', 'Belgische Biere, die „spontan“ mit Wildhefen aus der Luft vergären: trocken, sauer und weinartig. Gueuze ist eine Mischung junger und alter Lambics, Kriek ein Lambic mit Sauerkirschen.'],
      ],
    },
    {
      titel: 'Mischgetränke und Alkoholfreies',
      sub: 'Radler, 0,0 %, Bio',
      text: 'Nicht alles, was auf dem Etikett „Bier“ trägt, ist ein reines Bier: Manche Getränke sind gemischt, andere haben kaum Alkohol.',
      items: [
        ['Radler / Biermischgetränk', 'Bier mit Zitronenlimonade (Radler) oder mit Cola, Orangenlimonade, Fruchtsaft und anderem. Süßlich, leicht, meist 2–3 %.'],
        ['Alkoholfreies Bier', 'Bier mit höchstens 0,5 % Alkohol. Gibt es als Pils, Weizen und Dunkles; moderne Verfahren halten den Geschmack erstaunlich nah am Original. Auch Radler gibt es alkoholfrei.'],
        ['Diätbier / Diätpils','Besonders weit vergoren, mit sehr wenig Restzucker. Ursprünglich für Menschen mit Diabetes gedacht, ist aber nicht kalorienarm.'],
        ['Bio-Bier', 'Aus Zutaten aus kontrolliert ökologischem Anbau. Der Geschmack hängt von der Sorte ab, nicht vom Bio-Siegel.'],
        ['Spezialbier', 'Sammelbegriff für Biere mit besonderer Zutat oder Brauart, die zu keiner klassischen Sorte passen. Dahinter steckt fast alles, von Kräuterbier bis Craft-Experiment.'],
        ['Bier', 'So steht es auf dem Etikett, wenn keine genauere Sorte genannt wird. In der Regel ein ganz gewöhnliches, einfaches Bier.'],
      ],
    },
    {
      titel: 'Bier mit besonderer Zutat',
      sub: 'Frucht, Honig, Gewürze und mehr',
      text: 'Hier kommt etwas zum Malz dazu oder ersetzt es. Dann gilt das Reinheitsgebot (siehe „Wissenswertes“) meist nicht mehr, deshalb stehen diese Biere oft unter „Spezialbier“ oder „Biermischgetränk“.',
      items: [
        ['Fruchtbiere', 'Kirschbier, Himbeerbier, Erdbeer-, Pfirsich-, Mango-, Bananen- oder Brombeerbier: Bier, dem Früchte oder Fruchtsaft zugesetzt werden. Meist süß, fruchtig und gut für Einsteiger.'],
        ['Apfelbier', 'Bier mit Apfelsaft oder Apfelaroma: süßlich-säuerlich und frisch.'],
        ['Honigbier', 'Mit Honig gebraut oder verfeinert: süßlich, rund, manchmal blumig.'],
        ['Ingwer-, Chili-, Hanfbier', 'Mit Gewürzen oder Kräutern: Ingwer schmeckt frisch-scharf, Chili brennt, Hanf wirkt kräuterig. Berauschend ist daran nichts; es geht um den Geschmack.'],
        ['Schokoladen-, Kokosnuss-, Maronenbier', 'Dessertartig: Kakao, Kokos oder Esskastanie geben Süße und Aroma, oft auf Basis eines dunklen Biers.'],
        ['Dinkel-, Emmer-, Reis-, Kartoffelbier', 'Hier ersetzt ein anderes Getreide oder eine Knolle einen Teil des Malzes. Dinkel und Emmer schmecken eher nussig und würzig, Reis macht ein Bier leicht und trocken.'],
        ['Quinua-, Palmnuss-, Bambusbier und andere Exoten', 'Echte Raritäten aus ungewöhnlichen Pflanzen. Der Geschmack ist von Bier zu Bier völlig verschieden; hier lohnt sich das Probieren.'],
      ],
    },
  ];

  // Geschmacksbegriffe: [Begriff, Erklärung]
  const GESCHMACK = [
    ['herb', 'Deutliche, aber angenehme Bittere vom Hopfen, die im Abgang bleibt. Das typische Merkmal eines Pils. Das Gegenteil von „mild“.'],
    ['bitter', 'Eine starke Hopfenbittere, die auf der Zunge hinten spürbar ist. Wird in IBU (Bittereinheiten) gemessen: Ein Helles hat etwa 15–25, ein Pils 25–45, ein kräftiges IPA über 50.'],
    ['süffig', 'Das Bier läuft leicht die Kehle hinunter: harmonisch, nicht zu bitter oder schwer, man trinkt gern ein zweites. Hat nichts mit „süß“ zu tun.'],
    ['mild', 'Wenig Hopfenbittere und wenig Säure, rund und sanft im Geschmack. Typisch für Helles und viele Dunkle.'],
    ['malzig', 'Geschmack nach dem Getreide: Brot, Getreide, Karamell, Keks. Je dunkler das Malz, desto kräftiger.'],
    ['hopfig', 'Der Hopfen steht im Vordergrund: blumig, kräuterig, nach Zitrus oder Gras. Typisch für Pale Ales und IPAs.'],
    ['fruchtig', 'Aromen von Banane, Apfel, Birne oder Zitrus, die von der Hefe oder dem Hopfen kommen (oder von echter Frucht). Typisch für Weizenbier und Ales.'],
    ['würzig', 'Gewürznoten wie Nelke, Pfeffer, Koriander oder Muskat. Typisch für Weizen und belgische Biere.'],
    ['vollmundig', 'Das Bier hat viel „Körper“, es fühlt sich dicht und gehaltvoll im Mund an.'],
    ['schlank', 'Das Gegenteil von vollmundig: leicht, wenig Körper, trocken und erfrischend.'],
    ['rund', 'Alles im Gleichgewicht: Malz, Hopfen und Süße passen zusammen, nichts sticht heraus.'],
    ['spritzig', 'Viel Kohlensäure, prickelt auf der Zunge und wirkt frisch. Typisch für Weizenbier und Radler.'],
    ['süß', 'Restsüße vom Malz oder von zugesetztem Zucker, Honig oder Früchten. Nicht ungewöhnlich bei Bock, Doppelbock und Fruchtbieren.'],
    ['sauer / säuerlich', 'Frische Säure wie bei Zitrone oder Joghurt. Typisch für Gose, Lambic und Berliner Weiße. Bei diesen Sorten gewollt, nicht verdorben.'],
    ['röstig', 'Aromen von Kaffee, dunkler Schokolade oder Toastbrot durch stark geröstetes Malz. Typisch für Stout, Porter und Schwarzbier.'],
    ['rauchig', 'Geschmack nach Rauch oder Speck durch geräuchertes Malz, wie beim Rauchbier.'],
    ['hefig', 'Duft und Geschmack nach Hefe: leicht brotig und etwas cremig. Typisch für naturtrübe Biere wie Zwickel, Kellerbier und Hefeweizen.'],
    ['trocken', 'Wenig Restsüße; das Bier hinterlässt ein klares, fast „sandiges“ Gefühl im Mund. Pils ist dafür bekannt.'],
    ['cremig', 'Weiche, dichte Textur mit feinem Schaum, wie beim Stout.'],
    ['Abgang', 'Der Geschmack, der bleibt, nachdem man geschluckt hat. Kann kurz oder lang, bitter, süß oder trocken sein.'],
    ['Körper', 'Wie schwer oder dick sich das Bier im Mund anfühlt, von wässrig-leicht bis ölig-dicht.'],
  ];

  // Wissenswertes: [Überschrift, Text]
  const WISSEN = [
    ['Untergärig oder obergärig?', 'Der Unterschied liegt in der Hefe: Untergärige Hefe arbeitet kühl (etwa 5–10 °C) und setzt sich unten ab. Das Ergebnis ist sauber und klar im Geschmack (Pils, Helles, Export). Obergärige Hefe arbeitet wärmer (15–25 °C) und steigt nach oben. Das Ergebnis ist fruchtiger und würziger (Weizen, Kölsch, Altbier, Ale).'],
    ['Das Reinheitsgebot', 'Seit 1516 darf deutsches Bier nur aus Wasser, Malz und Hopfen bestehen. Die Hefe kannte man damals noch nicht als Zutat; heute gehört sie dazu. Viele deutsche Brauereien halten sich bis heute daran. Importbiere, Fruchtbiere und Mischgetränke dürfen dagegen weitere Zutaten enthalten.'],
    ['Die vier Zutaten', 'Wasser macht den größten Teil aus. Malz (gekeimte, getrocknete Gerste, bei Weizenbier auch Weizen) liefert Zucker für den Alkohol, Farbe und Körper. Hopfen gibt Bittere, Aroma und hält das Bier haltbar. Hefe verwandelt den Zucker in Alkohol und Kohlensäure.'],
    ['Stammwürze und Alkohol', 'Die Stammwürze (in Prozent oder °Plato) sagt, wie viel gelöster Zucker in der Würze vor der Gärung war. Je höher sie ist, desto mehr Alkohol kann entstehen. Als grobe Faustregel ergeben 12 % Stammwürze etwa 5 % Alkohol.'],
    ['Alkohol in Prozent', 'Die Angabe „% vol“ zeigt, wie viele Volumenprozent des Getränks reiner Alkohol sind. Die meisten deutschen Biere haben 4,5–5,5 %, Bockbiere 6–8 %, Doppelböcke bis etwa 10 %. „Alkoholfrei“ darf bis 0,5 % enthalten, „0,0 %“ garantiert praktisch keinen Alkohol.'],
    ['Naturtrüb und gefiltert', 'Gefiltertes Bier ist klar und länger haltbar. Naturtrübes Bier wird nicht gefiltert, die Hefe und feine Eiweißteilchen bleiben drin: Es schmeckt voller, ist aber empfindlicher und sollte frisch getrunken werden.'],
    ['Die richtige Temperatur', 'Zu kalt, und das Aroma bleibt versteckt; zu warm, und es schmeckt schal. Als Orientierung: Pils, Helles und Weizen 6–8 °C, Dunkles und Märzen 8–10 °C, Bockbier 8–11 °C, kräftige Ales, Stout und Porter 10–13 °C.'],
    ['Das richtige Glas', 'Pils kommt in die schlanke Pilstulpe oder Stange, Weizen ins hohe Weizenglas, Kölsch in die 0,2-Liter-Stange, Altbier in den Becher, Stout und Ale ins Pint- oder Nonic-Glas, kräftige Biere und Belgier in den Kelch. Ein sauberes, nasses Glas lässt den Schaum besser stehen.'],
    ['Brauerei und Marke', 'Die Marke auf dem Etikett wird nicht unbedingt dort gebraut, wo man es erwartet: Große Brauereien brauen für viele Marken, und Handelsmarken (zum Beispiel von Supermärkten) werden oft von einer fremden Brauerei hergestellt. Im Zweifel steht die Brauerei klein auf dem Etikett.'],
    ['Haltbarkeit', 'Bier ist kein Wein: Es wird nicht besser, sondern verliert mit der Zeit Frische und Hopfenaroma. Dunkel und kühl gelagert hält es länger. Das Mindesthaltbarkeitsdatum zeigt, wie lange der Hersteller die volle Qualität garantiert; starke Biere (Bock, Stout, Barley Wine) vertragen deutlich mehr Alter.'],
    ['Maßvoll genießen', 'Trink nie, um Punkte zu sammeln, sondern nur, um zu genießen. Nach Alkohol fährt man nie Auto. Bier Sammler ist nur für Personen ab 18 Jahren.'],
  ];

  const acc = (titel, sub, inner, open) => `<details class="info-group"${open ? ' open' : ''}><summary>${titel}${sub ? ` <span class="h-sub">${sub}</span>` : ''}</summary><div class="info-in">${inner}</div></details>`;
  const dl = (rows) => `<dl class="info-dl">${rows.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`;

  // Der Inhalt des Fensters als HTML (ohne Kopfzeile); alle Texte sind fest im Code, es fließen keine Eingaben ein
  function html() {
    const sorten = SORTEN.map((g) => acc(g.titel, g.sub, `<p class="note">${g.text}</p>${dl(g.items)}`, false)).join('');
    return `<p class="note info-intro">Kurz erklärt: die wichtigsten Biersorten, die Begriffe für den Geschmack und etwas Hintergrundwissen.
        Tippe auf eine Überschrift, um sie zu öffnen.</p>
      <section class="info-sec"><h3>Biersorten</h3>${sorten}</section>
      <section class="info-sec"><h3>Geschmack</h3>
        <p class="note">Mit diesen Wörtern wird beschrieben, wie ein Bier schmeckt und sich anfühlt.</p>${dl(GESCHMACK)}</section>
      <section class="info-sec"><h3>Wissenswertes</h3>${dl(WISSEN)}</section>`;
  }

  return { html, SORTEN, GESCHMACK, WISSEN };
})();
