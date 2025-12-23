import { database } from "./firebase.js";
import { ref, get, set, push, update } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { setCurrentUser } from "./state.js";

export function sanitizeKey(str) {
    return str.replace(/[.#$\[\]]/g, c => '%' + c.charCodeAt(0).toString(16));
}

/* 👉 네가 보낸 signupForm / loginForm 코드
   로직 변경 없이 그대로 여기로 이동 */
