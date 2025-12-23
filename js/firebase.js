import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDyAtNIrWfsROkqi8op6zynWZfjBwEMeh8",
    authDomain: "mess-db5a2.firebaseapp.com",
    databaseURL: "https://mess-db5a2-default-rtdb.firebaseio.com",
    projectId: "mess-db5a2",
    storageBucket: "mess-db5a2.firebasestorage.app",
    messagingSenderId: "125385749508",
    appId: "1:125385749508:web:f3e80ebb8cfd9e397af151"
};

export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
