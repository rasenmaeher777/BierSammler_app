// Firebase-Konfiguration für Anmeldung und Synchronisation.
//
// Solange apiKey leer ist, läuft die App im lokalen Modus: keine Anmeldung, die Einträge
// liegen nur im Browser dieses Geräts (localStorage). Praktisch zum Testen.
// Ist apiKey gesetzt, zeigt die App ihre Inhalte erst nach der Anmeldung mit Google.
//
// Einrichtung: siehe README.md, Abschnitt "Firebase einrichten".
// Die Werte findest du in der Firebase-Konsole unter
// Projekteinstellungen → Allgemein → Meine Apps → SDK-Konfiguration.
// Sie sind nicht geheim und dürfen im öffentlichen Repository stehen;
// geschützt werden die Daten durch die Firestore-Regeln (firestore.rules).
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyARDZe88xoOctv6oeqzP5rc2SAzkgyHbac",
  authDomain: "bier-sammler-app.firebaseapp.com",
  projectId: "bier-sammler-app",
  appId: "1:603760676348:web:65f311793dc8815e787679"
};
