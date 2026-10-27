// ============================================
// CONFIGURAÇÃO DO FIREBASE - Biblioteca CEJAL
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCa3GLXc6lZtA7rgYCq3Y2v0T79TeyLvnI",
    authDomain: "biblioteca-7daf5.firebaseapp.com",
    projectId: "biblioteca-7daf5",
    storageBucket: "biblioteca-7daf5.firebasestorage.app",
    messagingSenderId: "1057472290636",
    appId: "1:1057472290636:web:fd98eadc18a152dbe4b9e9"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

// Storage opcional (não quebra se não estiver habilitado)
let storage = null;
try {
    storage = firebase.storage();
} catch (e) {
    console.warn('Firebase Storage não disponível:', e.message);
}

// Arrow function evita "Cannot access before initialization"
const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
const FieldValue = firebase.firestore.FieldValue;

db.enablePersistence({ synchronizeTabs: true })
    .then(() => console.log('Persistência offline OK'))
    .catch(err => console.warn('Offline cache:', err.code));

window.db = db;
window.auth = auth;
window.storage = storage;
window.serverTimestamp = serverTimestamp;
window.FieldValue = FieldValue;

console.log('Firebase OK | Projeto:', firebaseConfig.projectId);
