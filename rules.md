Écran par écran, avec contenu, CTA, états, erreurs, navigation. Structure orientée **flux automatisé + exceptions**.

---

# 1. Splash

## Contenu

* Logo
* Loader

## États

* loading
* timeout

## Erreurs

* échec init config → écran erreur critique

## Navigation

→ Login

---

# 2. Login

## Contenu

* Email
* Mot de passe
* Bouton “Se connecter”

## CTA

* Login

## États

* idle
* loading
* success
* error

## Erreurs

* mauvais credentials
* compte désactivé

## Navigation

→ Sélection rôle (si multi)
→ Dashboard

---

# 3. Sélection rôle

## Contenu

* Liste rôles:

  * Conseiller
  * Caisse
  * Référent
  * Responsable

## CTA

* Choisir

## États

* sélection active

## Navigation

→ Sélection boutique

---

# 4. Sélection boutique

## Contenu

* Liste boutiques

## CTA

* Continuer

## Navigation

→ Dashboard

---

# 5. Dashboard

## Contenu

* KPIs:

  * dossiers en cours
  * dossiers bloqués
  * escalades
* Liste dossiers récents
* Bouton “Nouveau dossier”

## CTA

* Nouveau dossier
* Ouvrir dossier

## États

* vide
* chargé
* erreur

## Navigation

→ Nouveau dossier
→ Détail dossier

---

# 6. Nouveau dossier

## Contenu

* Type opération: Achat / Vente
* Type client: Physique / Moral
* Montant

## CTA

* Continuer

## États

* validation formulaire

## Erreurs

* champs manquants

## Navigation

→ Qualification

---

# 7. Qualification automatique

## Contenu

* Résultat:

  * client occasionnel / relation d’affaires
  * seuil applicable
  * type vigilance

## CTA

* Continuer

## États

* calcul en cours
* résultat

## Navigation

→ Scan identité

---

# 8. Choix document

## Contenu

* CNI
* Passeport

## CTA

* Sélectionner

## Navigation

→ Capture

---

# 9. Capture document (recto)

## Contenu

* Camera
* Cadre overlay

## CTA

* Prendre photo

## États

* preview
* validé
* flou

## Erreurs

* image floue
* mauvaise luminosité

## Navigation

→ Capture verso / OCR

---

# 10. Capture verso (si nécessaire)

Même structure

---

# 11. OCR / MRZ

## Contenu

* Loader
* “Extraction en cours”

## États

* loading
* success
* fail

## Erreurs

* OCR impossible → fallback manuel

## Navigation

→ Résultat OCR

---

# 12. Résultat OCR

## Contenu

* Nom
* Prénom
* DOB
* Nationalité
* Numéro doc
* Expiration

## CTA

* Modifier
* Confirmer

## États

* auto-rempli
* édité

## Erreurs

* incohérence MRZ

## Navigation

→ Vérification identité

---

# 13. Vérification identité

## Contenu

* Image document
* Camera live ou selfie
* Checkbox:

  * correspondance OK
  * document valide

## CTA

* Confirmer

## États

* validé
* refus

## Erreurs

* non validation → blocage

## Navigation

→ Infos client

---

# 14. Infos client (physique)

## Contenu

* Adresse
* Résidence fiscale
* Source fonds

## CTA

* Continuer

## Erreurs

* champs obligatoires

## Navigation

→ Recherches

---

# 15. Infos société (si moral)

## Contenu

* Raison sociale
* Représentants
* BE

## CTA

* Ajouter BE
* Continuer

## Erreurs

* BE manquant → blocage

## Navigation

→ Recherches

---

# 16. Hub recherches (automatique)

## Contenu

Liste:

* PPE
* Pays
* Gel
* Réputation

Statuts:

* pending
* success
* failed
* escalated

## CTA

* Relancer
* Voir détail

## Navigation

→ Détail recherche

---

# 17. PPE

## Contenu

* Résultat:

  * Non PPE
  * PPE détectée
* Rapport

## États

* clean
* match

## Navigation

→ Si match → écran exception

---

# 18. Pays listé

## Contenu

* Pays
* Statut:

  * listé / non listé

## Navigation

→ Exception si listé

---

# 19. Gel des avoirs

## Contenu

* Résultat:

  * aucun match
  * match

## États

* clean
* match
* doute

## Erreurs

* API fail

## Navigation

→ Exception si match

---

# 20. Réputation

## Contenu

* Résultat:

  * neutre
  * attention
  * négatif

## Navigation

→ Scoring

---

# 21. Cas spécifiques

## Contenu conditionnel:

* tiers payeur
* intermédiaire
* lien paiement

## CTA

* Ajouter justificatif

## Erreurs

* absence justificatif → escalade

---

# 22. Scoring

## Contenu

* Score PPE
* Score pays
* Score réputation
* Score signaux
* Score final

## États

* calcul
* résultat

## Navigation

→ Décision

---

# 23. Décision moteur

## Contenu

Résultat:

* validé automatiquement
* vigilance renforcée
* examen renforcé
* escalade
* blocage

## CTA

* Continuer

## Navigation

→ soit dossier final
→ soit exception

---

# 24. Exception PPE

## Contenu

* détails PPE
* justification requise

## CTA

* Valider relation
* Refuser

## États

* pending décision

## Navigation

→ Responsable

---

# 25. Exception gel

## Contenu

* match
* options:

  * faux positif
  * doute
  * vrai positif

## CTA

* Confirmer

## Navigation

→ blocage ou suite

---

# 26. Examen renforcé

## Contenu

* origine fonds
* destination
* justificatifs

## CTA

* Clôturer
* Escalader

## États

* ouvert
* clos

---

# 27. Validation finale

## Contenu

* résumé dossier
* décisions prises

## CTA

* Valider
* Suspendre
* Refuser

---

# 28. Dossier complet

## Contenu

* timeline
* documents
* scoring
* décisions

## CTA

* Export PDF

---

# 29. Audit trail

## Contenu

* actions horodatées
* utilisateurs
* modifications

---

# 30. Contrôle 2e niveau

## Contenu

* checklist:

  * identité
  * PPE
  * gel
  * pays
  * paiement

## CTA

* Conforme
* Non conforme

---

# 31. Contrôle 3e niveau

## Contenu

* vérification globale
* scoring
* anomalies

## CTA

* Valider
* Corriger

---

# 32. Archives

## Contenu

* liste dossiers
* filtres

---

# 33. Erreurs globales système

## Types

* OCR fail
* API indisponible
* données incohérentes
* absence pièce obligatoire
* violation règle métier

## Comportement

* bloquant si critique
* warning sinon

---

# 34. Règles de navigation globales

* impossible d’avancer si:

  * identité non validée
  * recherches incomplètes
  * preuves manquantes
* retour arrière autorisé sauf:

  * après validation finale
* écrans dynamiques:

  * apparaissent selon type client
  * apparaissent selon montant
  * apparaissent selon signaux
* exceptions prioritaire:

  * PPE
  * gel
  * BE incohérent
* toute décision critique:
  → nécessite écran dédié
  → nécessite justification

---

# 35. États globaux dossier

* draft
* collecting
* researching
* scoring
* auto_validated
* escalated
* blocked
* under_review
* validated
* archived

---

# 36. Logique UX dominante

* 80% des écrans invisibles (automatisés)
* utilisateur voit:

  * scan
  * validation rapide
  * exceptions
* app fait:

  * recherches
  * scoring
  * structuration
  * archivage

---

# 37. Résultat UX final

Flux réel:

Scan → auto-remplissage → auto-recherches → scoring →
→ soit validé directement
→ soit écran d’exception → décision humaine minimale → finalisation

