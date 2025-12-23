import "./auth.js";
import "./friends.js";
import "./chats.js";
import "./messages.js";
import { initUI } from "./ui.js";

window.addEventListener('load', () => {
    initUI();
    checkLoginStatus();
});
