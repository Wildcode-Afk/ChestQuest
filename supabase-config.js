/* ============================================================
   CONFIGURATION SUPABASE
   ============================================================
   1. Crée un compte gratuit sur https://supabase.com et un nouveau projet.
   2. Dans le tableau de bord du projet : Project Settings > API.
      - Copie "Project URL"      -> colle-la dans `url` ci-dessous
      - Copie "anon public" key  -> colle-la dans `anonKey` ci-dessous
   3. Exécute le script SQL fourni dans setup.sql (onglet "SQL Editor"
      de Supabase) pour créer la table de progression et ses règles
      de sécurité.
   Tant que ces valeurs ne sont pas renseignées, le site fonctionne
   normalement mais sans comptes (progression non sauvegardée en ligne).
   ============================================================ */
window.SUPABASE_CONFIG = {
  url: 'https://xhrcxmleodwcgmynnkaq.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocmN4bWxlb2R3Y2dteW5ua2FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NjcyNDIsImV4cCI6MjEwMjM0MzI0Mn0.PEkJmFLiuCXi82t8pPmdcjKaU6W6cyUBNCqn0WcrzYA'
};