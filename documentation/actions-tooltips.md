# Tableau des Actions et Tooltips pour l'Application de Recrutement

## Interface de Gestion des Utilisateurs

| Action | Tooltip | Interface |
|--------|---------|-----------|
| Créer utilisateur | Ajouter un nouvel utilisateur au système avec rôles et permissions | User Management |
| Modifier utilisateur | Éditer les informations personnelles et professionnelles | User Management |
| Supprimer utilisateur | Désactiver ou supprimer définitivement un compte utilisateur | User Management |
| Attribuer rôle | Assigner des permissions spécifiques (Admin, HR, Manager) | User Management |
| Retirer rôle | Révoquer les permissions d'un utilisateur | User Management |
| Réinitialiser mot de passe | Générer un nouveau mot de passe temporaire | User Management |
| Activer/Désactiver | Contrôler l'accès au système sans supprimer le compte | User Management |
| Voir historique | Consulter les actions effectuées par l'utilisateur | User Management |
| Filtrer par rôle | Afficher uniquement les utilisateurs d'un rôle spécifique | User Management |
| Rechercher | Trouver rapidement un utilisateur par nom, email ou username | User Management |

## Interface de Gestion des Employés

| Action | Tooltip | Interface |
|--------|---------|-----------|
| Ajouter employé | Créer un nouveau profil employé avec compétences | Employees |
| Modifier profil | Mettre à jour les informations et compétences | Employees |
| Supprimer employé | Retirer définitivement un employé du système | Employees |
| Voir profil complet | Accéder aux détails, compétences et historique | Employee Profile |
| Ajouter compétence | Associer une nouvelle compétence avec niveau | Employee Profile |
| Modifier compétence | Changer le niveau ou les détails d'une compétence | Employee Profile |
| Supprimer compétence | Retirer une compétence du profil employé | Employee Profile |
| Trouver meilleur poste | Algorithme de matching pour recommander des postes | Employees |
| Affecter à un poste | Assigner l'employé à une fiche de poste spécifique | Employees |
| Exporter CV | Générer un CV formaté à partir du profil | Employee Profile |

## Interface de Gestion des Fiches de Poste

| Action | Tooltip | Interface |
|--------|---------|-----------|
| Créer fiche | Définir un nouveau poste avec missions et compétences | Job Descriptions |
| Modifier fiche | Éditer les exigences et détails du poste | Job Descriptions |
| Supprimer fiche | Retirer une fiche de poste du système | Job Descriptions |
| Ajouter mission | Définir une responsabilité spécifique du poste | Job Description Form |
| Ajouter compétence requise | Spécifier une compétence avec niveau minimum | Job Description Form |
| Définir hiérarchie | Établir les relations de supervision (N+1, N+2) | Job Description Form |
| Lancer matching | Trouver les meilleurs candidats pour ce poste | Job Descriptions |
| Créer offre d'emploi | Générer une annonce publique à partir de la fiche | Job Descriptions |
| Dupliquer fiche | Créer une copie pour un poste similaire | Job Descriptions |
| Filtrer par filière | Afficher les postes d'une filière spécifique | Job Descriptions |

## Interface de Matching Intelligent

| Action | Tooltip | Interface |
|--------|---------|-----------|
| Sélectionner poste | Choisir la fiche de poste pour le matching | Matching |
| Lancer analyse | Calculer les scores de compatibilité avec FastAPI | Matching |
| Ajuster seuil | Modifier le score minimum pour l'affectation automatique | Matching |
| Affectation auto | Assigner automatiquement les meilleurs candidats | Matching |
| Voir détails score | Analyser les écarts de compétences par candidat | Matching Results |
| Matching inverse | Trouver les meilleurs postes pour un employé | Matching |
| Exporter résultats | Télécharger le rapport de matching en PDF/Excel | Matching Results |
| Comparer candidats | Visualiser côte à côte les profils des candidats | Matching Results |

## Interface de Gestion des Compétences

| Action | Tooltip | Interface |
|--------|---------|-----------|
| Créer compétence | Ajouter une nouvelle compétence au référentiel | Skills Management |
| Modifier compétence | Éditer le nom, description et type de compétence | Skills Management |
| Supprimer compétence | Retirer une compétence (vérifier les dépendances) | Skills Management |
| Créer type | Définir une nouvelle catégorie (Savoir, Savoir-faire, etc.) | Skills Management |
| Créer niveau | Ajouter un niveau d'expertise (Débutant à Expert) | Skills Management |
| Associer à employé | Lier une compétence à un profil avec niveau | Employee Skills |
| Évaluer niveau | Mettre à jour le niveau de maîtrise d'un employé | Employee Skills |
| Certifier compétence | Valider officiellement une compétence acquise | Employee Skills |

## Interface Statistiques et Reporting

| Action | Tooltip | Interface |
|--------|---------|-----------|
| Voir tableau de bord | Accéder aux métriques clés de l'organisation | Statistics |
| Filtrer période | Analyser les données sur une période spécifique | Statistics |
| Exporter rapport | Télécharger les statistiques en format Excel/PDF | Statistics |
| Analyser compétences | Identifier les gaps de compétences dans l'organisation | Statistics |
| Voir tendances | Suivre l'évolution des recrutements et compétences | Statistics |
| Comparer équipes | Analyser les performances par département | Statistics |

## Interface Organigramme

| Action | Tooltip | Interface |
|--------|---------|-----------|
| Voir structure | Visualiser la hiérarchie organisationnelle complète | Organigramme |
| Zoomer/Dézoomer | Ajuster l'affichage pour une meilleure lisibilité | Organigramme |
| Filtrer par niveau | Afficher uniquement un niveau hiérarchique | Organigramme |
| Voir détails poste | Accéder aux informations complètes d'un poste | Organigramme |
| Identifier postes vacants | Repérer les postes sans titulaire assigné | Organigramme |
| Planifier succession | Identifier les candidats internes pour promotion | Organigramme |