<p align="center"><img src="docs/citation-card.jpg" alt="VanoLib Reader avec une fiche de citation" width="900"></p>

<h1 align="center">VanoLib Reader</h1>
<p align="center"><b>Un meilleur lecteur PDF pour les articles, directement dans votre navigateur.</b><br>
Cliquez sur une citation et voyez la référence aussitôt, et même le lemme exact qu'elle désigne. Surlignez, annotez, gardez pour plus tard, lisez la nuit.</p>
<p align="center"><a href="README.md">English version</a></p>

---

## Nouveautés de la version 1.8

- **Overleaf.** Un bouton **VanoLib** apparaît à côté de « Download PDF » dans Overleaf. Il ouvre le PDF compilé dans VanoLib Reader, et cet onglet se recharge au même endroit après chaque compilation.
- **Les fiches dans l'aperçu d'Overleaf.** Cliquez sur une citation comme `[May25, Lemma 2.1]` : la fiche de la référence s'ouvre sur place, avec l'énoncé exact. Cliquez sur un renvoi vers un théorème, un lemme, une proposition ou une équation de votre propre article : vous voyez son énoncé sans quitter l'endroit où vous lisez, avec **Go there** pour y aller. Les sections et les pages sautent comme avant, et Alt + clic garde le comportement d'Overleaf. Le projet doit charger `hyperref`.
- **La version arXiv quand le journal n'est pas libre.** Quand un article cité est payant, son énoncé est lu dans sa version arXiv, trouvée avec OpenAlex, Semantic Scholar ou la recherche arXiv, et vérifiée avec le titre et le premier auteur. Quand le PDF du journal est libre, il est lu en premier, puisque c'est la version que vous citez. La fiche indique la version utilisée.

## Nouveautés de la version 1.7

- **L'énoncé exact derrière une citation.** Cliquez sur `[May25, Lemma 2.1]` : la fiche affiche le Lemme 2.1 lui-même, découpé dans le PDF de l'article cité (arXiv ou accès libre), avec son numéro de page. Les formules apparaissent exactement comme dans l'article. Cela marche pour les théorèmes, lemmes, propositions, corollaires, définitions, remarques et exemples, les abréviations comme `Thm. 3.4`, les résultats à lettre comme `Theorem A`, les équations `(2.4)` et les sections `§3.1`, et aussi quand la citation est coupée en fin de ligne. Cliquez sur l'énoncé, ou sur **Open at page …**, pour lire l'article cité à cet endroit précis.
- **Franc quand il ne trouve pas.** Si l'article n'a pas de PDF en accès libre, s'il numérote le résultat autrement (il l'appelle « Lemma 2.1 » alors que vous avez cité « Theorem 2.1 »), ou si l'énoncé est lu dans la version arXiv d'un article publié, la fiche le signale.

<p align="center"><img src="docs/statement-card.jpg" alt="Une fiche de citation qui affiche l'énoncé du théorème 3.1 de l'article cité" width="720"></p>

Aussi depuis la 1.0 : **références vérifiées** (chaque entrée est contrôlée avec Crossref et arXiv, marquée ✓ Verified ou ≈ Probable match), un **panneau Research** (l'article, les articles qui le citent, les articles liés, les références vérifiées, export .bib en un clic), l'**aperçu** des liens vers les théorèmes et équations au survol, et la **recherche plein texte** dans les PDF de votre liste de lecture.

Les versions précédentes restent disponibles sur la [page des versions](https://github.com/yassine-aitmohamed/vanolib-extension/releases).

## Pourquoi VanoLib Reader

Lire un article dans le lecteur PDF du navigateur, c'est faire des allers-retours vers la bibliographie, perdre sa page, et tout recommencer à chaque ouverture. VanoLib Reader règle tout cela.

- **Fiches de citation.** Cliquez ou survolez une citation comme `[5]` : la référence complète apparaît dans une fiche, vérifiée avec Crossref et arXiv, avec des liens directs vers l'article, Google Scholar et arXiv, plus Copier et BibTeX.
- **Énoncés exacts.** Pour une citation comme `[May25, Lemma 2.1]`, la fiche affiche aussi l'énoncé du Lemme 2.1, pris dans l'article cité lui-même.
- **Panneau Research.** L'article ouvert, les articles qui le citent, les articles liés et ses références vérifiées, avec export .bib.
- **Annoter comme sur papier.** Stylo, surligneur en quatre couleurs, soulignement, notes sur la page et commentaires sur un passage, avec annuler et rétablir. Les annotations sont enregistrées pour chaque PDF.
- **Liste de lecture hors ligne.** Enregistrez un PDF avec ⌘D / Ctrl+D : il reste lisible sans internet et se rouvre à la page où vous vous êtes arrêté, avec vos surlignages. Recherche dans le texte intégral de tous vos PDF enregistrés.
- **Lecture confortable.** Texte net à tous les zooms, modes jour, sépia et nuit, recherche, plan et miniatures.
- **Téléchargement en un clic**, et **envoi vers VanoAtlas** si vous utilisez [VanoAtlas](https://github.com/yassine-aitmohamed/vanoatlas).
- **Privé.** Vos PDF, vos notes et votre liste de lecture restent dans votre navigateur. Pas de compte, pas de pistage, aucun serveur à nous. Pour vérifier les références et afficher les énoncés, le lecteur interroge des services savants publics (Crossref, arXiv, OpenAlex, Semantic Scholar) sur les articles que vous citez. Dans Overleaf, le PDF compilé passe d'Overleaf à l'extension dans votre navigateur, et nulle part ailleurs.
- **Libre et gratuit** (MIT).

## Installation

VanoLib Reader fonctionne dans **Google Chrome, Microsoft Edge, Brave, Arc, Vivaldi et Opera**, sur **macOS et Windows** (et Linux). Les étapes sont les mêmes partout.

1. **Téléchargez** `vanolib-extension.zip` depuis la [dernière version](https://github.com/yassine-aitmohamed/vanolib-extension/releases/latest) et décompressez-le.
   - macOS : double-cliquez sur le zip dans le Finder.
   - Windows : clic droit sur le zip → **Extraire tout…**
2. **Ouvrez la page des extensions** :
   - Chrome, Brave, Arc, Vivaldi : tapez `chrome://extensions` dans la barre d'adresse
   - Edge : tapez `edge://extensions`
3. Activez le **Mode développeur**.
4. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier **`extension`** décompressé (celui qui contient `manifest.json`).
5. Épinglez VanoLib Reader dans la barre d'outils.

Ouvrez n'importe quel lien PDF : il s'ouvre dans VanoLib Reader. Pour lire les PDF de votre disque, ouvrez les **Détails** de l'extension et activez **Autoriser l'accès aux URL de fichier**.

## Licence

MIT. Voir [LICENSE](LICENSE).
