Voici la roadmap produit et la liste des écrans, alignées avec une application **hautement automatisée**, mais structurée autour des points de décision imposés par la procédure: séparation des rôles, seuils, recherches obligatoires, gestion des cas PPE, gel des avoirs, vigilance renforcée, contrôles et archivage.

# 1. Cible produit

Objectif produit:

* automatiser la collecte, les recherches, le scoring, la génération du dossier et l’escalade
* réduire au minimum l’intervention humaine
* conserver des écrans d’exception pour les cas sensibles
* générer des traces exploitables en contrôle interne
* conserver les preuves 5 ans

Le moteur applicatif doit gérer:

* client occasionnel vs relation d’affaires
* seuil 15 000 €
* seuil 10 000 €
* transactions liées sur 4 semaines glissantes
* recherche PPE
* gel des avoirs
* pays listés
* examen renforcé
* vigilance renforcée
* traitement des exceptions liées à l’intermédiaire, au tiers payeur et aux liens de paiement

---

# 2. Roadmap produit

## Phase 0 — Cadrage et architecture

But: figer le socle avant le build.

Livrables:

* cartographie des règles métier
* matrice des rôles et permissions
* modèle de données dossier LCB-FT
* moteur de statuts dossier
* moteur de règles seuils / vigilance
* architecture mobile + backend + stockage preuves
* stratégie OCR / MRZ / face match
* stratégie connecteurs externes

Décisions à figer:

* Expo ou React Native bare
* OCR local ou backend
* fournisseur PPE / sanctions
* source des listes pays
* format des exports dossier
* journal d’audit immuable

Dépendances:

* procédure interne
* fiche de scoring
* logiciel de gestion client
* registre de gels / PPE / sources réputation

---

## Phase 1 — MVP exécution automatisée

But: produire un dossier automatisé simple sur flux nominal.

Périmètre:

* auth
* rôles
* dashboard
* création dossier
* scan document
* OCR/MRZ
* correction manuelle
* qualification client automatique
* calcul seuils
* récupération historique client
* génération dossier initial
* pièces jointes
* audit log

Résultat attendu:

* un conseiller ou opérateur lance un dossier
* l’app extrait l’identité
* l’app calcule le type de dossier
* l’app demande uniquement les données manquantes
* l’app prépare le dossier avant recherches externes

---

## Phase 2 — Recherches automatiques

But: faire exécuter à l’application les diligences répétitives.

Périmètre:

* recherche PPE automatique
* recherche pays listés automatique
* recherche gel des avoirs automatique ou semi-automatique
* recherche réputation enrichie
* recherche représentants / bénéficiaires effectifs
* récupération et archivage des preuves
* datation automatique des recherches
* orchestration des recherches selon type client

Résultat attendu:

* l’application lance les recherches seule
* elle stocke les résultats
* elle joint les preuves
* elle remplit automatiquement le dossier

Cette phase doit refléter les diligences listées dans la procédure: PPE, gel des avoirs, pays listés, réputation, vérification BE.

---

## Phase 3 — Scoring, alertes et moteur de décision

But: rendre l’application décisionnelle sur les flux non sensibles.

Périmètre:

* scoring automatique
* alertes critiques
* blocages automatiques
* passage automatique en vigilance renforcée
* ouverture automatique d’examen renforcé
* génération résumé conformité
* règles d’escalade
* règles de refus technique
* règles de suspension transaction

Résultat attendu:

* si dossier simple: validation automatique
* si dossier à risque: escalade
* si blocant: suspension immédiate

Cas à couvrir:

* document expiré
* absence de mandat
* tiers payeur non justifié
* PPE
* match pays listé
* match gel
* impossibilité d’identifier BE
* absence de justification économique
* multiplication des liens de paiement

---

## Phase 4 — Centre d’exception et validation humaine

But: garder l’humain uniquement là où la procédure l’impose.

Périmètre:

* écran PPE à valider
* écran gel des avoirs à arbitrer
* écran examen renforcé
* écran vigilance renforcée
* décision de poursuite / suspension
* préparation déclaration de soupçon
* pré-saisie du dossier de soupçon
* justification obligatoire des décisions

Résultat attendu:

* l’application remplace le travail de préparation
* le valideur n’intervient que sur exceptions

Cette phase est indispensable car la procédure prévoit une décision du responsable ou du référent sur les cas PPE, gel, examen renforcé et soupçon.

---

## Phase 5 — Contrôle interne et pilotage conformité

But: transformer l’application en outil complet de gouvernance.

Périmètre:

* checklist 2e niveau
* checklist 3e niveau
* sélection d’échantillons
* rapports mensuels
* rapports semestriels
* suivi anomalies
* plan de remédiation
* export audit
* tableau de bord conformité

Résultat attendu:

* l’application devient la source de vérité du dispositif
* chaque dossier est contrôlable
* les contrôles mensuels et semestriels sont générés à partir des données collectées

La procédure impose explicitement ces contrôles et l’archivage associé.

---

## Phase 6 — Industrialisation

But: passer d’un outil interne à une plateforme robuste.

Périmètre:

* monitoring
* analytics
* SLA
* reprise sur incident
* chiffrement renforcé
* gestion fine des accès
* versionning des règles métier
* multi-boutiques
* internationalisation éventuelle
* centre d’administration

---

# 3. Priorisation fonctionnelle

## MVP strict

* login
* création dossier
* scan identité
* OCR/MRZ
* calcul seuils
* type client
* type opération
* historique client
* workflow simple
* stockage pièces
* audit trail

## V1

* PPE automatique
* pays listés automatiques
* gel des avoirs
* scoring
* alertes
* validation exception
* dossier PDF
* archivage

## V1.5

* intermédiaire
* tiers payeur
* liens de paiement
* personne morale
* bénéficiaires effectifs
* GP Vintage vendeur

## V2

* contrôle 2e niveau
* contrôle 3e niveau
* rapports mensuels/semestriels
* centre conformité
* préparation déclaration soupçon

---

# 4. Liste structurée des écrans

## A. Authentification et shell app

1. Splash
2. Login
3. Sélection rôle
4. Sélection boutique
5. Dashboard principal

---

## B. Dashboard

6. Dashboard global
7. Dossiers en cours
8. Dossiers bloqués
9. Dossiers à corriger
10. Dossiers en attente validation
11. Dossiers archivés
12. Alertes critiques
13. Recherche globale

Widgets:

* nb dossiers créés
* nb dossiers auto-validés
* nb dossiers escaladés
* nb PPE
* nb gels
* nb anomalies
* nb suspensions

---

## C. Création dossier

14. Nouveau dossier
15. Choix type opération
16. Choix boutique
17. Choix type client
18. Montant transaction
19. Résumé historique client
20. Résultat qualification automatique

Résultat système:

* client occasionnel
* relation d’affaires
* transaction liée
* seuil applicable
* flux déclenché

---

## D. Identité

21. Choix document
22. Capture recto
23. Capture verso
24. Détection qualité image
25. OCR/MRZ en cours
26. Résultat extraction
27. Correction manuelle
28. Vérification validité document
29. Vérification correspondance photo / personne
30. Résumé identité extraite

---

## E. Client personne physique

31. Coordonnées
32. Nationalité / pays naissance
33. Résidence fiscale
34. Source des fonds
35. Justificatifs source des fonds

---

## F. Client personne morale

36. Informations société
37. Représentant légal
38. Bénéficiaires effectifs
39. Pièces société
40. Contrôle cohérence BE
41. Résultat divergence éventuelle
42. Vérifications juridiques

---

## G. Recherches automatiques

43. Hub recherches
44. PPE
45. Pays listés
46. Gel des avoirs
47. Réputation
48. Source des fonds enrichie
49. Synthèse des recherches
50. Pièces probantes collectées

Chaque écran doit montrer:

* statut: pending / success / failed / escalated
* source utilisée
* date/heure
* preuve récupérée
* résultat structuré

---

## H. Cas spécifiques

51. Tiers payeur
52. Intermédiaire
53. Mandat / preuve mandat
54. Client absent au paiement
55. Lien de paiement
56. Paiements multiples
57. Cohérence carte / origine / présence client
58. GP Vintage vendeur
59. Justificatif propriété bien
60. Coacquéreurs / covendeurs

Ces écrans sont directement motivés par les cas pratiques de la procédure.

---

## I. Risque et décision

61. Scoring détaillé
62. Signaux détectés
63. Niveau de risque
64. Dossier auto-validable ou non
65. Blocages automatiques
66. Examen renforcé
67. Vigilance renforcée
68. Escalade responsable
69. Décision finale

États possibles:

* auto-validé
* à compléter
* escalade requise
* suspendu
* refusé
* archivé

---

## J. Centre d’exception

70. PPE détectée
71. Pays listé détecté
72. Match gel des avoirs
73. Doute sur gel
74. BE incohérent
75. Examen renforcé non clôturé
76. Pré-déclaration de soupçon
77. Justification de décision
78. Validation/Refus

---

## K. Dossier complet

79. Résumé dossier
80. Timeline dossier
81. Pièces jointes
82. Journal d’audit
83. Téléchargement PDF
84. Historique des décisions
85. Historique recherches
86. Archivage

---

## L. Contrôle interne

87. Sélection dossiers à contrôler
88. Checklist 2e niveau
89. Checklist 3e niveau
90. Anomalies
91. Régularisations demandées
92. Rapport mensuel
93. Rapport semestriel
94. Historique contrôles

---

## M. Administration

95. Utilisateurs
96. Rôles et permissions
97. Boutiques
98. Paramètres seuils
99. Paramètres scoring
100. Sources externes
101. Listes pays
102. Paramètres archivage
103. Paramètres notifications
104. Logs sécurité

---

# 5. Parcours principal dans l’application

## Parcours nominal automatisé

1. Dashboard
2. Nouveau dossier
3. Type client / opération / montant
4. Scan document
5. OCR/MRZ
6. Qualification automatique
7. Lancement recherches
8. Consolidation preuves
9. Scoring
10. Décision moteur:

* auto-validation
* vigilance renforcée
* examen renforcé
* escalade
* blocage

11. Génération dossier
12. Archivage ou centre d’exception

---

# 6. Parcours d’exception à implémenter

## PPE

* recherche automatique
* match PPE
* dossier bloqué en validation simple
* écran d’exception
* collecte complémentaire
* validation responsable
* surveillance renforcée

## Gel des avoirs

* recherche automatique/semi-auto
* match
* suspension immédiate
* distinction faux positif / doute / vrai positif
* preuves complémentaires
* décision responsable

## Tiers payeur

* scan du tiers
* saisie du lien
* collecte attestation
* cohérence
* escalade si explication faible

## Intermédiaire / client absent

* identité intermédiaire
* mandat
* contrôle facture
* contrôle premier paiement
* vigilance renforcée si absence de preuve

## Liens de paiement multiples

* détection du nombre
* justification
* cohérence mode de paiement
* vigilance renforcée
* blocage si hors politique interne > 3 liens

---

# 7. Roadmap par sprint

## Sprint 1

* auth
* rôles
* navigation de base
* dashboard minimal
* création dossier
* modèle de données

## Sprint 2

* scan CNI/passeport
* OCR/MRZ
* correction manuelle
* contrôle validité document

## Sprint 3

* historique client
* qualification client occasionnel / relation d’affaires
* calcul transactions liées
* seuils automatiques

## Sprint 4

* moteur recherches
* PPE
* pays listés
* stockage preuves

## Sprint 5

* gel des avoirs
* réputation
* enrichissement dossier
* audit trail

## Sprint 6

* scoring
* alertes
* workflow automatisé
* blocages automatiques

## Sprint 7

* centre d’exception
* PPE review
* gel review
* examen renforcé
* vigilance renforcée

## Sprint 8

* cas tiers payeur
* intermédiaire
* client absent
* liens de paiement
* GP Vintage vendeur

## Sprint 9

* export PDF dossier
* archivage
* logs complets
* timeline dossier

## Sprint 10

* contrôle 2e niveau
* contrôle 3e niveau
* rapports mensuels / semestriels

---

# 8. Ce qu’il faut construire en premier

Ordre de build:

1. dossier + identité
2. moteur de qualification
3. recherches automatiques
4. scoring
5. workflow et exceptions
6. audit / archivage
7. contrôle interne

Cet ordre colle à la logique de la procédure: d’abord constituer le dossier, ensuite lancer les recherches, ensuite traiter le risque, ensuite contrôler et archiver.

# 9. Positionnement final

Le produit cible est:

**une plateforme mobile de constitution automatique de dossiers LCB-FT, avec moteur de recherches, moteur de décision, centre d’exception et pilotage conformité.**

La version courte de la roadmap:

* **MVP**: identité + dossier + qualification
* **V1**: recherches auto + scoring + escalade
* **V2**: exceptions + vigilance renforcée + soupçon
* **V3**: contrôle interne + pilotage complet

Je peux maintenant te faire la version suivante: **écran par écran avec contenu, CTA, états, erreurs et règles de navigation**.
