import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getDatabase, ref, set, push, onValue, get, update, off
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
    getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Firebase 설정 (기존 설정 유지)
const firebaseConfig = {
    apiKey: "AIzaSyDyAtNIrWfsROkqi8op6zynWZfjBwEMeh8",
    authDomain: "mess-db5a2.firebaseapp.com",
    databaseURL: "https://mess-db5a2-default-rtdb.firebaseio.com",
    projectId: "mess-db5a2",
    storageBucket: "mess-db5a2.appspot.com",
    messagingSenderId: "125385749508",
    appId: "1:125385749508:web:f3e80ebb8cfd9e397af151",
    measurementId: "G-W6LN7XGMZB"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

let currentUser = null;
let currentChatId = null;
let currentChatUser = null;
// for groups: { isGroup:true, id:'group_x', data: groupData }
// 리스너 참조(중복 등록 방지/해제용)
let friendsRef = null;
let chatsRef = null;
let messagesRef = null;
let requestsRef = null;

// 금지 문자(., #, $, [, ])를 안전한 키로 변환
function sanitizeKey(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/[.#$\[\]]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16);
    });
}

// ==================== 로컬 스토리지에서 사용자 정보 확인 ====================
function checkLoginStatus() {
    const savedUser = localStorage.getItem('chatAppUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
        loadUserData();
        loadFriends();
        loadChats();
        loadFriendRequests(); // 요청 로드 시작
        updateUserStatus(true);
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginContainer').classList.add('active');
    document.getElementById('signupContainer').classList.remove('active');
    document.getElementById('mainApp').classList.remove('active');
}

function showMainApp() {
    document.getElementById('loginContainer').classList.remove('active');
    document.getElementById('signupContainer').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
}

// ==================== 회원가입 ====================
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('signupUsername').value.trim().toLowerCase();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const name = document.getElementById('signupName').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
    const errorDiv = document.getElementById('signupError');
    const successDiv = document.getElementById('signupSuccess');
    const signupBtn = document.getElementById('signupBtn');
    
    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');
    
    // 유효성 검사
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        errorDiv.textContent = '아이디는 영문과 숫자만 사용 가능합니다.';
        errorDiv.classList.add('show');
        return;
    }
    
    if (username.length < 4 || username.length > 20) {
        errorDiv.textContent = '아이디는 4-20자 사이여야 합니다.';
        errorDiv.classList.add('show');
        return;
    }

    // 이메일 기본 체크
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        errorDiv.textContent = '유효한 이메일을 입력하세요.';
        errorDiv.classList.add('show');
        return;
    }
    
    if (password !== passwordConfirm) {
        errorDiv.textContent = '비밀번호가 일치하지 않습니다.';
        errorDiv.classList.add('show');
        return;
    }
    
    if (password.length < 6) {
        errorDiv.textContent = '비밀번호는 6자 이상이어야 합니다.';
        errorDiv.classList.add('show');
        return;
    }
    
    signupBtn.disabled = true;
    signupBtn.innerHTML = '<span class="spinner"></span> 가입 중...';
    
    try {
        // 아이디 중복 확인
        const userSnapshot = await get(ref(database, `usernames/${username}`));
        if (userSnapshot.exists()) {
            errorDiv.textContent = '이미 사용 중인 아이디입니다.';
            errorDiv.classList.add('show');
            return;
        }

        // 이메일 중복 확인 (sanitizeKey 사용)
        const emailKey = sanitizeKey(email);
        const emailSnapshot = await get(ref(database, `emails/${emailKey}`));
        if (emailSnapshot.exists()) {
            errorDiv.textContent = '이미 사용 중인 이메일입니다.';
            errorDiv.classList.add('show');
            return;
        }
        
        // 고유 ID 생성
        const userId = push(ref(database, 'users')).key;
        // 비밀번호 해시 (간단한 예시, 실제로는 더 강력한 암호화 필요)
        const hashedPassword = btoa(password);
        // 사용자 정보 저장
        await set(ref(database, `users/${userId}`), {
            username: username,
            email: email,
            name: name,
            password: hashedPassword,
            status: '안녕하세요!',
            createdAt: Date.now(),
            online: false
        });
        // 아이디-유저ID 매핑 저장
        await set(ref(database, `usernames/${username}`), userId);
        // 이메일-유저ID 매핑 저장 (sanitizeKey 사용)
        await set(ref(database, `emails/${emailKey}`), userId);
        successDiv.textContent = '회원가입이 완료되었습니다! 로그인해주세요.';
        successDiv.classList.add('show');
        
        // 폼 초기화
        document.getElementById('signupForm').reset();
        // 2초 후 로그인 화면으로
        setTimeout(() => {
            document.getElementById('signupContainer').classList.remove('active');
            document.getElementById('loginContainer').classList.add('active');
        }, 2000);
    } catch (error) {
        console.error('회원가입 에러:', error);
        errorDiv.textContent = '회원가입 중 오류가 발생했습니다: ' + error.message;
        errorDiv.classList.add('show');
    } finally {
        signupBtn.disabled = false;
        signupBtn.textContent = '회원가입';
    }
});
// ==================== 로그인 ====================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const identifier = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    
    errorDiv.classList.remove('show');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> 로그인 중...';
    
    try {
        // identifier를 username 또는 email로 판단하지 말고, 매핑에서 먼저 찾아본다
        let userId = null;

        const usernameSnapshot = await get(ref(database, `usernames/${identifier}`));
        if (usernameSnapshot.exists()) {
            userId = usernameSnapshot.val();
        } else {
            // 이메일 매핑 조회 시 sanitizeKey 사용
            const emailKey = sanitizeKey(identifier);
            const emailSnapshot = await get(ref(database, `emails/${emailKey}`));
            if (emailSnapshot.exists()) {
                userId = emailSnapshot.val();
            }
        }

        if (!userId) {
            errorDiv.textContent = '존재하지 않는 아이디 또는 이메일입니다.';
            errorDiv.classList.add('show');
            return;
        }
        
        // 사용자 정보 가져오기
        const userSnapshot = await get(ref(database, `users/${userId}`));
        if (!userSnapshot.exists()) {
            errorDiv.textContent = '사용자 정보를 찾을 수 없습니다.';
            errorDiv.classList.add('show');
            return;
        }
        
        const userData = userSnapshot.val();
        const hashedPassword = btoa(password);
        
        if (userData.password !== hashedPassword) {
            errorDiv.textContent = '비밀번호가 올바르지 않습니다.';
            errorDiv.classList.add('show');
            return;
        }
        
        // 로그인 성공
        currentUser = {
            uid: userId,
            username: userData.username,
            name: userData.name,
            email: userData.email || '',
            status: userData.status
        };
        // 로컬 스토리지에 저장
        localStorage.setItem('chatAppUser', JSON.stringify(currentUser));
        // 온라인 상태로 업데이트
        await updateUserStatus(true);
        // 메인 앱 표시
        showMainApp();
        loadUserData();
        loadFriends();
        loadChats();
        loadFriendRequests();
        
    } catch (error) {
        console.error('로그인 에러:', error);
        errorDiv.textContent = '로그인 중 오류가 발생했습니다: ' + error.message;
        errorDiv.classList.add('show');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '로그인';
    }
});
// ==================== 로그아웃 ====================
document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
        try {
            await updateUserStatus(false);
            // 리스너 정리
            cleanupAllListeners();

            localStorage.removeItem('chatAppUser');
            currentUser = null;
            showLogin();
        } catch (error) {
            console.error('로그아웃 에러:', error);
            alert('로그아웃 중 오류가 발생했습니다.');
        }
    }
});
// ==================== 사용자 데이터 로드 ====================
function loadUserData() {
    if (!currentUser) return;
    const profileEl = document.getElementById('userProfile');
    // 표시할 텍스트 (username 첫글자 또는 이름 이니셜)
    const label = currentUser.username ?
    currentUser.username.charAt(0).toUpperCase() : (currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U');
    profileEl.textContent = label;
}

// ==================== 온라인 상태 업데이트 ====================
async function updateUserStatus(online) {
    if (!currentUser) return;
    try {
        await update(ref(database, `users/${currentUser.uid}`), {
            online: online,
            lastSeen: Date.now()
        });
    } catch (error) {
        console.error('상태 업데이트 에러:', error);
    }
}

// ==================== 친구 요청 발송 ====================
document.getElementById('addFriendBtn').addEventListener('click', async () => {
    const username = document.getElementById('friendUsername').value.trim().toLowerCase();
    const errorDiv = document.getElementById('addFriendError');
    const successDiv = document.getElementById('addFriendSuccess');
    const addBtn = document.getElementById('addFriendBtn');
    
    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');
    
    if (!username) {
        errorDiv.textContent = '아이디를 입력해주세요.';
        errorDiv.classList.add('show');
        return;
    }
    
    if (username === currentUser.username) {
        errorDiv.textContent = '자기 자신에게 요청을 보낼 수 없습니다.';
        errorDiv.classList.add('show');
        return;
    }
    
    addBtn.disabled = true;
    addBtn.innerHTML = '<span class="spinner"></span> 요청 중...';
    
    try {
        // 아이디로 사용자 검색
        const usernameSnapshot = await get(ref(database, `usernames/${username}`));
        if (!usernameSnapshot.exists()) {
            errorDiv.textContent = '해당 아이디의 사용자를 찾을 수 없습니다.';
            errorDiv.classList.add('show');
            return;
        }
        
        const friendId = usernameSnapshot.val();
        // 이미 친구인지 확인
        const friendCheck = await get(ref(database, `friends/${currentUser.uid}/${friendId}`));
        if (friendCheck.exists()) {
            errorDiv.textContent = '이미 친구로 등록되어 있습니다.';
            errorDiv.classList.add('show');
            return;
        }

        // 이미 요청을 보냈는지 확인 (recipient side)
        const existingRequest = await get(ref(database, `friendRequests/${friendId}/${currentUser.uid}`));
        if (existingRequest.exists()) {
            errorDiv.textContent = '이미 친구 요청을 보냈습니다.';
            errorDiv.classList.add('show');
            return;
        }

        // 요청 생성 (recipientId -> senderId)
        await set(ref(database, `friendRequests/${friendId}/${currentUser.uid}`), {
            from: currentUser.uid,
            username: currentUser.username,
            name: currentUser.name || '',
            timestamp: Date.now(),
            status: 'pending'
        });
        successDiv.textContent = '친구 요청을 보냈습니다!';
        successDiv.classList.add('show');
        document.getElementById('friendUsername').value = '';

    } catch (error) {
        console.error('친구 요청 에러:', error);
        errorDiv.textContent = '친구 요청 중 오류가 발생했습니다: ' + error.message;
        errorDiv.classList.add('show');
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = '친구 요청 보내기';
    }
});
// ==================== 친구 목록 로드 ====================
async function loadFriends() {
    if (!currentUser) return;
    // 기존 리스너 해제 (중복 등록 방지)
    if (friendsRef) {
        try { off(friendsRef);
        } catch (e) { /* ignore */ }
    }

    friendsRef = ref(database, `friends/${currentUser.uid}`);
    onValue(friendsRef, async (snapshot) => {
        const friendsList = document.getElementById('friendsList');
        friendsList.innerHTML = '';
        
        if (!snapshot.exists()) {
            friendsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <h3>친구가 없습니다</h3>
                    <p>친구를 추가해보세요!</p>
                </div>
            `;
            // also refresh group invite lists if modal open
            renderGroupMemberList();
            return;
        }
        
        const friendIds = Object.keys(snapshot.val());
        
        for (const friendId of friendIds) {
            const userSnapshot = await get(ref(database, `users/${friendId}`));
            if (userSnapshot.exists()) {
                const friendData = userSnapshot.val();
                const initial = friendData.username ? friendData.username.charAt(0).toUpperCase() : '?';
                const onlineClass = friendData.online ? 'online' : '';
                
                const friendItem = document.createElement('div');
                friendItem.className = 'friend-item';
                friendItem.innerHTML = `
                    <div class="friend-avatar ${onlineClass}">${initial}</div>
                    <div class="friend-info">
                        <div class="friend-name">${friendData.name || '이름 없음'}</div>
                        <div class="friend-username">@${friendData.username}</div>
                        <div class="friend-status">${friendData.status || ''}</div>
                    </div>
                `;
                friendItem.addEventListener('click', () => {
                    openChat(friendId, friendData);
                });
                friendsList.appendChild(friendItem);
            }
        }

        // 또한 그룹 멤버 선택 목록이 열려있다면 갱신
        renderGroupMemberList();
        renderGroupInviteCandidates(); // if group info modal open
    });
}

// ==================== 친구 요청 로드 ====================
function loadFriendRequests() {
    if (!currentUser) return;
    // 기존 requests 리스너 해제
    if (requestsRef) {
        try { off(requestsRef);
        } catch (e) { /* ignore */ }
    }

    requestsRef = ref(database, `friendRequests/${currentUser.uid}`);
    onValue(requestsRef, async (snapshot) => {
        const requestsList = document.getElementById('requestsList');
        const requestCountEl = document.getElementById('requestCount');
        requestsList.innerHTML = '';

        if (!snapshot.exists()) {
            requestsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📨</div>
                    <h3>친구 요청이 없습니다</h3>
                    <p>받은 요청이 표시됩니다</p>
                </div>
            `;
            requestCountEl.textContent = '';
            
            return;
        }

        const reqs = snapshot.val();
        const entries = Object.entries(reqs);
        requestCountEl.textContent = `(${entries.length})`;

        for (const [senderId, reqData] of entries) {
            // 요청 보낸 사용자의 최신 프로필 가져오기
            const userSnap = await get(ref(database, `users/${senderId}`));
            const sender = userSnap.exists() ? userSnap.val() : {
                username: reqData.username || 'unknown',
                name: reqData.name || '이름 없음'
            };
            const initial = sender.username ? sender.username.charAt(0).toUpperCase() : '?';

            const item = document.createElement('div');
            item.className = 'friend-item';
            item.innerHTML = `
                <div class="friend-avatar">${initial}</div>
                <div class="friend-info">
                    <div class="friend-name">${sender.name || '이름 없음'}</div>
                    <div class="friend-username">@${sender.username || ''}</div>
                    <div class="friend-status">요청 보냄 • ${new Date(reqData.timestamp || Date.now()).toLocaleString()}</div>
                </div>
                <div class="request-actions">
                    <button class="btn btn-secondary btn-reject" data-id="${senderId}">거절</button>
                    <button class="btn btn-primary btn-accept" data-id="${senderId}">수락</button>
                </div>
            `;
            // 이벤트 바인딩
            item.querySelector('.btn-accept').addEventListener('click', async () => {
                await acceptFriendRequest(senderId);
            });
            item.querySelector('.btn-reject').addEventListener('click', async () => {
                await rejectFriendRequest(senderId);
            });
            requestsList.appendChild(item);
        }
    });
}

// 수락
async function acceptFriendRequest(senderId) {
    if (!currentUser) return;
    try {
        // 양방향 친구 추가
        await set(ref(database, `friends/${currentUser.uid}/${senderId}`), { addedAt: Date.now() });
        await set(ref(database, `friends/${senderId}/${currentUser.uid}`), { addedAt: Date.now() });

        // 요청 삭제
        await set(ref(database, `friendRequests/${currentUser.uid}/${senderId}`), null);
        alert('친구 요청을 수락했습니다.');
        // 친구 목록 새로고침(리스너가 자동 갱신)
        loadFriends();
    } catch (err) {
        console.error('수락 에러:', err);
        alert('요청 수락 중 오류가 발생했습니다.');
    }
}

// 거절
async function rejectFriendRequest(senderId) {
    if (!currentUser) return;
    try {
        await set(ref(database, `friendRequests/${currentUser.uid}/${senderId}`), null);
        alert('친구 요청을 거절했습니다.');
    } catch (err) {
        console.error('거절 에러:', err);
        alert('요청 거절 중 오류가 발생했습니다.');
    }
}

// ==================== 채팅 열기 (1:1 또는 그룹) ====================
async function openChat(peerId, peerData) {
    // peerId can be 'group_{groupId}' for groups or friendId for 1:1
    if (String(peerId).startsWith('group_')) {
        // 그룹 채팅 열기
        const groupId = peerId.split('group_')[1];
        const groupSnap = await get(ref(database, `groups/${groupId}`));
        if (!groupSnap.exists()) {
            alert('그룹 정보를 찾을 수 없습니다.');
            return;
        }
        const groupData = groupSnap.val();
        currentChatId = `group_${groupId}`;
        currentChatUser = { isGroup: true, id: currentChatId, data: groupData };
    } else {
        // 1:1
        currentChatUser = { isGroup: false, id: peerId, data: peerData };
        currentChatId = [currentUser.uid, peerId].sort().join('_');
    }

    // 기존 messages 리스너 제거 (중복 리스너 방지)
    if (messagesRef) {
        try { off(messagesRef);
        } catch (e) { /* ignore */ }
        messagesRef = null;
    }
    
    // 메시지 탭으로 전환
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelector('[data-view="messages"]').classList.add('active');
    
    document.getElementById('friendsPanel').classList.remove('active');
    document.getElementById('messagesPanel').classList.add('active');
    document.getElementById('chatArea').classList.add('active');
    
    // 채팅 헤더 설정
    let headerHtml = '';
    if (currentChatUser.isGroup) {
        const g = currentChatUser.data;
        const initials = g.name ? g.name.charAt(0).toUpperCase() : 'G';
        headerHtml = `
        <div class="chat-header">
            <div class="chat-header-left">
                <div class="chat-header-avatar">${initials}</div>
                <div class="chat-header-details">
                    <h3 id="groupNameHeader">${g.name || '그룹 채팅'}</h3>
                    <div class="chat-header-status" style="color: var(--text-secondary)">
                        멤버 ${g.members ? Object.keys(g.members).length : 0}명
                    </div>
                </div>
            </div>
            <div class="chat-actions">
                <button class="action-btn" id="emojiBtn" title="이모티콘">😊</button>
                <button class="action-btn" id="attachBtn" title="파일 첨부">📎</button>
                <button class="action-btn" title="그룹 정보" id="groupInfoBtn">ℹ️</button>
            </div>
        </div>`;
    } else {
        const friendData = currentChatUser.data;
        const initial = friendData.username ? friendData.username.charAt(0).toUpperCase() : '?';
        const onlineStatus = friendData.online ? '온라인' : '오프라인';
        const statusColor = friendData.online ? 'var(--success)' : 'var(--text-secondary)';
        headerHtml = `
        <div class="chat-header">
            <div class="chat-header-left">
                <div class="chat-header-avatar">${initial}</div>
                <div class="chat-header-details">
                    <h3>${friendData.name || '이름 없음'}</h3>
                    <div class="chat-header-status" style="color: ${statusColor}">
                        ${friendData.online ? '<span class="status-dot"></span>' : ''}
                        ${onlineStatus}
                    </div>
                </div>
            </div>
            <div class="chat-actions">
                <button class="action-btn" id="emojiBtn" title="이모티콘">😊</button>
                <button class="action-btn" id="attachBtn" title="파일 첨부">📎</button>
                <button class="action-btn" title="더보기">⋮</button>
            </div>
        </div>`;
    }

    document.getElementById('chatArea').innerHTML = `
        ${headerHtml}
        <div class="messages-container" id="messagesContainer"></div>
        <div class="input-area">
            <div class="input-wrapper">
                <div class="input-actions"></div>
                <textarea 
                    class="message-input" 
                    placeholder="메시지를 입력하세요..." 
                    rows="1"
                    id="messageInput"
                ></textarea>
                <button class="send-btn" id="sendBtn" title="전송">➤</button>
            </div>
        </div>
    `;
    // 버튼 바인딩 (group info)
    if (currentChatUser.isGroup) {
        const groupId = currentChatId.split('group_')[1];
        const groupInfoBtn = document.getElementById('groupInfoBtn');
        groupInfoBtn?.addEventListener('click', async () => {
            openGroupInfo(groupId);
        });
        // clicking group name header opens group info
        const groupNameHeader = document.getElementById('groupNameHeader');
        groupNameHeader?.addEventListener('click', () => {
            openGroupInfo(groupId);
        });
    }

    // setup emoji panel, file input handlers, message input
    setupMessageInput();
    loadMessages();
    loadChatList();

    // mark chat unread false for current user
    update(ref(database, `chats/${currentUser.uid}/${currentChatUser.id}`), { unread: false }).catch(()=>{});
}

// ==================== 메시지 입력 설정 ====================
function setupMessageInput() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    const emojiPanel = document.getElementById('emojiPanel');
    if (!messageInput || !sendBtn) return;
    
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    sendBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    // Emoji panel setup handled globally (render page)
    // Toggle emoji panel
    if (emojiBtn) {
        emojiBtn.addEventListener('click', (ev) => {
            const panel = document.getElementById('emojiPanel');
            if (!panel) return;
            panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
            document.getElementById('emojiSearch').value = '';
            emojiFiltered = EMOJIS.slice();
            emojiPage = 0;
            renderEmojiPage();
        });
    }

    // Outside click hides emoji panel
    document.addEventListener('click', (ev) => {
        const panel = document.getElementById('emojiPanel');
        if (!panel) return;
        if (ev.target.closest('#emojiPanel') || ev.target.id === 'emojiBtn') return;
        panel.style.display = 'none';
    });
    // Attachment
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });
        fileInput.addEventListener('change', async (ev) => {
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            if (!currentChatId || !currentChatUser) {
                alert('대화를 먼저 열어주세요.');
                return;
            }

            // show a simple upload indicator (spinner in button)
            attachBtn.disabled = true;
            attachBtn.innerHTML = '<span class="spinner"></span>';

            try {
                const safeName = encodeURIComponent(file.name.replace(/\s+/g,'_'));
                const path = `uploads/${currentUser.uid}/${Date.now()}_${safeName}`;
                const sRef = storageRef(storage, path);
                await uploadBytes(sRef, file);
                const url = await getDownloadURL(sRef);

                // push image message
                const messagesRefLocal = ref(database, `messages/${currentChatId}`);
                const mRef = push(messagesRefLocal);
                await set(mRef, {
                    type: 'image',
                    imageUrl: url,
                    filename: file.name,
                    senderId: currentUser.uid,
                    senderUsername: currentUser.username,
                    timestamp: Date.now()
                });

                // update last message for targets
                if (currentChatUser.isGroup) {
                    const groupId = currentChatId.split('group_')[1];
                    const groupSnap = await get(ref(database, `groups/${groupId}`));
                    const members = groupSnap.exists() ? groupSnap.val().members || {} : {};
                    const now = Date.now();
                    for (const memberUid of Object.keys(members)) {
                        const updateObj = {
                            lastMessage: '',
                            unread: memberUid === currentUser.uid ? false : true
                        };
                        // only set lastMessageTime for others (so sender's chat doesn't jump to top)
                        if (memberUid !== currentUser.uid) updateObj.lastMessageTime = now;
                        await update(ref(database, `chats/${memberUid}/${currentChatId}`), updateObj);
                    }
                } else {
                    // recipient gets time update, sender only gets lastMessage text (no time change)
                    await update(ref(database, `chats/${currentUser.uid}/${currentChatUser.id}`), {
                        lastMessage: '',
                        unread: false
                    });
                    await update(ref(database, `chats/${currentChatUser.id}/${currentUser.uid}`), {
                        lastMessage: '',
                        lastMessageTime: Date.now(),
                        unread: true
                    });
                }
            } catch (err) {
                console.error('파일 업로드 오류', err);
                alert('파일 업로드 중 오류가 발생했습니다.');
            } finally {
                attachBtn.disabled = false;
                attachBtn.innerHTML = '📎';
            }
        });
    }
}

// ==================== 이모지 시스템(페이징 5x5 = 25개씩) ====================
// EMOJIS: 널리 쓰이는 이모지들을 모아둠.
// 페이지당 25개(5x5)씩 표시
const EMOJIS = [
    "😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","🙂","🙃","😋","😎","😍","😘","😗","😙","😚","😇",
    "🤩","🤗","🤔","🤨","😐","😑","😶","😏","😣","😥","😮","🤐","😯","😪","😫","😴","😌","😛","😜","😝",
    "🤤","😒","😓","😔","😕","🙁","☹️","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰",
    "😱","🥵","🥶","😳","🤪","😵","😡","😠","🤬","😷","🤒","🤕","🤢","🤮","🤧","🥳","🥴","🤠","😺","😸",
    "😹","😻","😼","😽","🙀","😿","😾","👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙",
    "👈","👉","👆","👇","☝️","✋🏻","👏","🙌","👐","🤲","🙏","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠",
    "👀","👁️","👅","👄","💋","💌","💘","💝","💖","💗","💓","💞","💕","❣️","💔","❤️","🧡","💛","💚","💙",
    "💜","🖤","🤍","🤎","💯","💢","🔥","✨","⭐","🌟","🌞","🌝","🌚","🌛","🌜","🌈","☀️","⛅","☁️","🌧️",
    "⛈️","🌩️","🌨️","❄️","🌬️","💨","🌪️","🌫️","🌊","💧","💦","☔","⚡","☄️","🎃","🎄","🎉","🎊","🎁","🎈",
    "🔔","🎵","🎶","🎤","🎧","📯","🎷","🎸","🎹","🥁","📢","📣","🔊","🔔","🎯","🏆","🏅","🥇","🥈","🥉","⚽",
    "🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥅","🏒","🏑","🏏","🥏","🥌","⛳","🏹","🎣","🧗","🏄","🏊",
    "🚗","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🚚","🚛","🚜","🛴","🚲","🛵","🏍️","✈️","🚀","🛸","⛵",
    "🛶","🚤","🛳️","⚓","⛽","🏁","🏳️","🏴","🏳️‍🌈","🇰🇷","🇺🇸","🇯🇵","🇨🇳","💬","📝","📌","📎","🔒","🔑","💡",
    "🔍","🧭","⏰","📅","📆","📱","💻","🖥️","🖨️","🎮","🧩","🪀","🪁","🔋","🔌","💸","💰","🧾","🔧","⚙️",
    "🧰","🛠️","🏥","🏫","🏦","🏨","🏪","🏠","🏡","🛏️","🛋️","🚪","🪑","🧴","🍏","🍎","🍐","🍊","🍋","🍌",
    "🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥒","🥬","🥕","🌽","🥔",
    "🍠","🥐","🍞","🥖","🧀","🥚","🍳","🥞","🧇","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🥙","🍝","🍜","🍲",
    "🍣","🍱","🍛","🍤","🍙","🍚","🍘","🍥","🥠","🍢","🍡","🍧","🍨","🍦","🍰","🎂","🍮","🍩","🍪","🌰"
];
// Pagination state: show 25 emojis per page (5x5)
let emojiPage = 0;
const EMOJIS_PER_PAGE = 25;
let emojiFiltered = EMOJIS.slice();

function renderEmojiPage() {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;
    const start = emojiPage * EMOJIS_PER_PAGE;
    const pageEmojis = emojiFiltered.slice(start, start + EMOJIS_PER_PAGE);
    grid.innerHTML = '';
    if (pageEmojis.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;color:var(--text-secondary);text-align:center">검색 결과가 없습니다</div>';
        return;
    }
    pageEmojis.forEach(e => {
        const div = document.createElement('div');
        div.className = 'emoji-item';
        div.textContent = e;
        div.addEventListener('click', () => {
            insertEmoji(e);
            document.getElementById('emojiPanel').style.display = 'none';
            const ta = document.getElementById('messageInput');
            ta?.focus();
        });
        grid.appendChild(div);
    });
    // disable/enable prev/next
    document.getElementById('emojiPrev').disabled = emojiPage === 0;
    document.getElementById('emojiNext').disabled = (start + EMOJIS_PER_PAGE) >= emojiFiltered.length;
}

document.getElementById('emojiPrev').addEventListener('click', () => {
    if (emojiPage > 0) {
        emojiPage--;
        renderEmojiPage();
    }
});
document.getElementById('emojiNext').addEventListener('click', () => {
    if ((emojiPage + 1) * EMOJIS_PER_PAGE < emojiFiltered.length) {
        emojiPage++;
        renderEmojiPage();
    }
});
document.getElementById('emojiSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
        emojiFiltered = EMOJIS.slice();
    } else {
        emojiFiltered = EMOJIS.filter(em => {
            // simple heuristic: allow searching by the emoji itself (rare) or fallback keywords mapping
            return em.includes(q) || em === q;
        });
        if (emojiFiltered.length === 0) {
            const keywordMap = {
                heart: ['❤️','💖','💗','💓','💕','💝'],
                smile: ['😀','😃','😄','😁','🙂','😊'],
                sad: ['😢','😭','😞','😟','☹️'],
                fire: ['🔥'],
                party: ['🎉','🥳'],
                food: ['🍕','🍔','🍟','🍩','🍰','🍣','🍜'],
                cat: ['😺','😸','😹','😻','😼'],
                dog: ['🐶'],
                flag: ['🇰🇷','🇺🇸','🇯🇵','🇨🇳'],
                star: ['⭐','🌟'],
                music: ['🎵','🎶','🎧','🎤']
            };
            for (const k of Object.keys(keywordMap)) {
                if (k.startsWith(q)) {
                    emojiFiltered = keywordMap[k];
                    break;
                }
            }
        }
    }
    emojiPage = 0;
    renderEmojiPage();
});

// initial render
renderEmojiPage();
function insertEmoji(emoji) {
    const ta = document.getElementById('messageInput');
    if (!ta) return;
    const start = ta.selectionStart || ta.value.length;
    const end = ta.selectionEnd || start;
    ta.value = ta.value.slice(0, start) + emoji + ta.value.slice(end);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + emoji.length;
    ta.dispatchEvent(new Event('input'));
}

// ==================== 메시지 전송 ====================
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput || !currentChatId) return;
    
    const text = messageInput.value.trim();
    if (text === '') return;
    try {
        const messagesRefLocal = ref(database, `messages/${currentChatId}`);
        const mRef = push(messagesRefLocal);
        await set(mRef, {
            type: 'text',
            text: text,
            senderId: currentUser.uid,
            senderUsername: currentUser.username,
            timestamp: Date.now()
        });
        // recent message 업데이트
        if (currentChatUser.isGroup) {
            const groupId = currentChatId.split('group_')[1];
            const groupSnap = await get(ref(database, `groups/${groupId}`));
            const members = groupSnap.exists() ? groupSnap.val().members || {} : {};
            const now = Date.now();
            for (const memberUid of Object.keys(members)) {
                const updateObj = {
                    lastMessage: text,
                    unread: memberUid === currentUser.uid ? false : true
                };
                // only set lastMessageTime for others to avoid moving sender's chat to top
                if (memberUid !== currentUser.uid) updateObj.lastMessageTime = now;
                await update(ref(database, `chats/${memberUid}/${currentChatId}`), updateObj);
            }
        } else {
            // For 1:1 chats, update recipient's lastMessageTime (so their list shows recent),
            // but do NOT update sender's lastMessageTime to avoid moving chat to top on send.
            await update(ref(database, `chats/${currentUser.uid}/${currentChatUser.id}`), {
                lastMessage: text,
                unread: false
            });
            await update(ref(database, `chats/${currentChatUser.id}/${currentUser.uid}`), {
                lastMessage: text,
                lastMessageTime: Date.now(),
                unread: true
            });
        }
        
        messageInput.value = '';
        messageInput.style.height = 'auto';
    } catch (error) {
        console.error('메시지 전송 에러:', error);
        alert('메시지 전송에 실패했습니다: ' + error.message);
    }
}

// ==================== 메시지 로드 (및 읽음 처리) ====================
async function loadMessages() {
    if (!currentChatId) return;
    // 기존 messages 리스너 해제
    if (messagesRef) {
        try { off(messagesRef);
        } catch (e) { /* ignore */ }
    }

    messagesRef = ref(database, `messages/${currentChatId}`);
    onValue(messagesRef, async (snapshot) => {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;
        
        messagesContainer.innerHTML = '';
        
        if (!snapshot.exists()) {
            messagesContainer.innerHTML = `
                <div class="date-divider"><span>대화 시작</span></div>
            `;
            return;
        }
        
        let lastDate = null;
        const messages = [];
        
        snapshot.forEach((childSnapshot) => {
            messages.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        messages.sort((a, b) => a.timestamp - b.timestamp);

        // render messages and collect to mark read
        for (const message of messages) {
            const messageDate = new Date(message.timestamp);
            const dateStr = messageDate.toLocaleDateString('ko-KR');
            if (dateStr !== lastDate) {
                const divider = document.createElement('div');
                divider.className = 'date-divider';
                divider.innerHTML = `<span>${dateStr}</span>`;
                messagesContainer.appendChild(divider);
                lastDate = dateStr;
            }
            
            const isSent = message.senderId === currentUser.uid;
            const timeStr = messageDate.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            let initial;
            if (isSent) {
                initial = currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U';
            } else {
                // for group, show sender initial (need user info)
                if (currentChatUser.isGroup) {
                    const senderSnap = await get(ref(database, `users/${message.senderId}`));
                    const s = senderSnap.exists() ? senderSnap.val() : { username: message.senderUsername || 'U', name: message.senderUsername || '' };
                    initial = s.username ? s.username.charAt(0).toUpperCase() : '?';
                } else {
                    initial = currentChatUser && currentChatUser.data.username ? currentChatUser.data.username.charAt(0).toUpperCase() : '?';
                }
            }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
            
            // bubble content
            let bubbleContent = '';
            if (message.type === 'image' && message.imageUrl) {
                bubbleContent = `<img src="${escapeHtml(message.imageUrl)}" class="message-image" alt="${escapeHtml(message.filename || 'image')}" />`;
            } else {
                bubbleContent = escapeHtml(message.text || '');
            }

            // For group chats, show sender name for received messages
            let senderNameHtml = '';
            if (currentChatUser.isGroup && !isSent) {
                const senderSnap = await get(ref(database, `users/${message.senderId}`));
                const s = senderSnap.exists() ? senderSnap.val() : { username: message.senderUsername || 'unknown', name: message.senderUsername || '' };
                senderNameHtml = `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">${s.name || s.username || '이름 없음'}</div>`;
            }

            // read indicator for sent messages
            let readHtml = '';
            if (isSent) {
                const readBy = message.readBy || {};
                if (currentChatUser.isGroup) {
                    // count how many of group members have read
                    const groupId = currentChatId.split('group_')[1];
                    const groupSnap = await get(ref(database, `groups/${groupId}`));
                    const members = groupSnap.exists() ? groupSnap.val().members || {} : {};
                    const total = Object.keys(members).length;
                    const readCount = Object.keys(readBy).filter(k=>readBy[k]).length;
                    readHtml = `<div class="read-indicator">${readCount}/${total} 읽음</div>`;
                } else {
                    const readByFriend = message.readBy && message.readBy[currentChatUser.id];
                    readHtml = `<div class="read-indicator">${readByFriend ? '읽음' : ''}</div>`;
                }
            }

            messageDiv.innerHTML = `
                <div class="message-avatar">${initial}</div>
                <div class="message-content">
                    ${senderNameHtml}
                    <div class="message-bubble">${bubbleContent}</div>
                    <div class="message-time">${timeStr}</div>
                    ${readHtml}
                </div>
            `;
            messagesContainer.appendChild(messageDiv);
        }
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        // mark unread messages as read for current user (set readBy)
        for (const message of messages) {
            if (message.senderId !== currentUser.uid) {
                const alreadyRead = message.readBy && message.readBy[currentUser.uid];
                if (!alreadyRead) {
                    try {
                        await set(ref(database, `messages/${currentChatId}/${message.id}/readBy/${currentUser.uid}`), true);
                    } catch (e) {
                        console.warn('읽음 표시 실패', e);
                    }
                }
            }
        }

        // also clear chat-level unread flag for this user
        try {
            await update(ref(database, `chats/${currentUser.uid}/${currentChatUser.id}`), { unread: false });
        } catch(e) { /* ignore */ }
    });
}

// ==================== 채팅 목록 로드 (1:1 + 그룹) ====================
async function loadChatList() {
    if (!currentUser) return;
    // 기존 chats 리스너 해제
    if (chatsRef) {
        try { off(chatsRef);
        } catch (e) { /* ignore */ }
    }

    chatsRef = ref(database, `chats/${currentUser.uid}`);
    onValue(chatsRef, async (snapshot) => {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;
        
        // Save currently opened chat (to keep it visible)
        const currentlyOpenPeer = currentChatUser ? (currentChatUser.isGroup ? currentChatUser.id : currentChatUser.id) : null;

        // preserve scroll position minimally
        const prevScroll = chatList.scrollTop;
        chatList.innerHTML = '';
        
        if (!snapshot.exists()) {
            chatList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💬</div>
                    <h3>메시지가 없습니다</h3>
                    <p>친구에게 메시지를 보내보세요!</p>
                </div>
            `;
            return;
        }
        
        const chats = [];
        const raw = snapshot.val();
        const seen = new Set(); // dedupe safety

        for (const [peerKey, chatData] of Object.entries(raw)) {
            if (seen.has(peerKey)) continue;
            seen.add(peerKey);

            if (peerKey.startsWith('group_')) {
                // fetch group
                const groupId = peerKey.split('group_')[1];
                const gSnap = await get(ref(database, `groups/${groupId}`));
                if (gSnap.exists()) {
                    chats.push({
                        friendId: peerKey,
                        friendData: { name: gSnap.val().name || '그룹', isGroup:true },
                        chatData
                    });
                }
            } else {
                // normal user
                const userSnapshot = await get(ref(database, `users/${peerKey}`));
                if (userSnapshot.exists()) {
                    chats.push({
                        friendId: peerKey,
                        friendData: userSnapshot.val(),
                        chatData
                    });
                }
            }
        }
        
        chats.sort((a, b) => (b.chatData.lastMessageTime || 0) - (a.chatData.lastMessageTime || 0));
        let unreadCount = 0;
        
        for (const chat of chats) {
            const initial = chat.friendData.name ?
            chat.friendData.name.charAt(0).toUpperCase() : (chat.friendData.username ? chat.friendData.username.charAt(0).toUpperCase() : '?');
            const time = chat.chatData.lastMessageTime ?
            new Date(chat.chatData.lastMessageTime).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit'
            }) : '';
            if (chat.chatData.unread) unreadCount++;
            
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            // attach peer id for reference and potential scrolling
            chatItem.dataset.peer = chat.friendId;
            chatItem.innerHTML = `
                <div class="chat-avatar">${initial}</div>
                <div class="chat-info">
                    <div class="chat-header-info">
                        <div class="chat-name">${chat.friendData.name || '이름 없음'}</div>
                        <div class="chat-time">${time}</div>
                    </div>
                    <div class="chat-preview">${chat.chatData.lastMessage || ''}</div>
                </div>
                ${chat.chatData.unread ? '<span class="unread-badge">N</span>' : ''}
            `;
            chatItem.addEventListener('click', () => {
                openChat(chat.friendId, chat.friendData);
                
                // 읽음 처리
                if (chat.chatData.unread) {
                    update(ref(database, `chats/${currentUser.uid}/${chat.friendId}`), {
                        unread: false
                    });
                }
            });
            // visually mark active
            if (currentlyOpenPeer && currentlyOpenPeer === chat.friendId) {
                chatItem.classList.add('active');
            }
            
            chatList.appendChild(chatItem);
        }
        
        // 읽지 않은 메시지 배지 업데이트
        const badge = document.getElementById('unreadBadge');
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        // After render, ensure current chat is visible (don't force-scroll everyone to top)
        if (currentlyOpenPeer) {
            const el = chatList.querySelector(`[data-peer="${currentlyOpenPeer}"]`);
            if (el) {
                // scroll that element into view (center) so it doesn't disappear
                el.scrollIntoView({ block: 'center', behavior: 'auto' });
            } else {
                // fallback: restore previous scroll
                chatList.scrollTop = prevScroll;
            }
        } else {
            chatList.scrollTop = prevScroll;
        }
    });
}

function loadChats() {
    loadChatList();
}

// HTML 이스케이프
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ==================== UI 전환 ====================
document.getElementById('showSignup').addEventListener('click', () => {
    document.getElementById('loginContainer').classList.remove('active');
    document.getElementById('signupContainer').classList.add('active');
});
document.getElementById('backToLogin').addEventListener('click', () => {
    document.getElementById('signupContainer').classList.remove('active');
    document.getElementById('loginContainer').classList.add('active');
});
// 네비게이션
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        const view = item.dataset.view;
    
        if (view === 'friends') {
            document.getElementById('friendsPanel').classList.add('active');
            document.getElementById('messagesPanel').classList.remove('active');
            document.getElementById('chatArea').classList.remove('active');
        } else if (view === 'messages') {
            document.getElementById('friendsPanel').classList.remove('active');
            document.getElementById('messagesPanel').classList.add('active');
            if (currentChatId) {
                document.getElementById('chatArea').classList.add('active');
            }
        }
    });
});

// 친구 탭 전환
document.querySelectorAll('#friendsTabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#friendsTabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        
        if (tab === 'friends-list') {
            document.getElementById('friendsList').style.display = 'block';
            document.getElementById('friendRequests').style.display = 'none';
            document.getElementById('addFriend').style.display = 'none';
        } else if (tab === 'add-friend') {
            document.getElementById('friendsList').style.display = 'none';
            document.getElementById('friendRequests').style.display = 'none';
            document.getElementById('addFriend').style.display = 'block';
        } else if (tab === 'requests') {
            document.getElementById('friendsList').style.display = 'none';
            document.getElementById('friendRequests').style.display = 'block';
            document.getElementById('addFriend').style.display = 'none';
        }
    });
});
// ==================== 그룹 만들기 로직 ====================
const groupModal = document.getElementById('groupModal');
const createGroupBtn = document.getElementById('createGroupBtn');
const cancelGroupBtn = document.getElementById('cancelGroupBtn');
const confirmCreateGroup = document.getElementById('confirmCreateGroup');
createGroupBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert('로그인 상태가 필요합니다.');
        return;
    }
    document.getElementById('groupName').value = '';
    document.getElementById('groupError').classList.remove('show');
    renderGroupMemberList();
    document.getElementById('selectedMembersChips').innerHTML = '';
    groupModal.classList.add('active');
});
cancelGroupBtn.addEventListener('click', () => {
    groupModal.classList.remove('active');
});
// search input for members
document.getElementById('groupMemberSearch').addEventListener('input', () => {
    renderGroupMemberList(document.getElementById('groupMemberSearch').value.trim());
});
async function renderGroupMemberList(filter = '') {
    const listEl = document.getElementById('groupMemberList');
    const chipsEl = document.getElementById('selectedMembersChips');
    if (!listEl) return;
    listEl.innerHTML = '<div style="color:var(--text-secondary)">불러오는 중...</div>';
    try {
        const friendsSnap = await get(ref(database, `friends/${currentUser.uid}`));
        if (!friendsSnap.exists()) {
            listEl.innerHTML = '<div style="color:var(--text-secondary)">친구가 없습니다</div>';
            return;
        }
        const members = Object.keys(friendsSnap.val());
        if (members.length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-secondary)">친구가 없습니다</div>';
            return;
        }
        listEl.innerHTML = '';
        // fetch all friend profiles in parallel
        const profiles = await Promise.all(members.map(fid => get(ref(database, `users/${fid}`)).then(s => ({ fid, snap: s }))));
        for (const { fid, snap } of profiles) {
            if (!snap.exists()) continue;
            const u = snap.val();
            const display = `${u.name || u.username || fid} (@${u.username || ''})`.toLowerCase();
            if (filter && !display.includes(filter.toLowerCase())) continue;
            const div = document.createElement('div');
            div.className = 'member-item';
            div.innerHTML = `
                <div class="avatar">${u.username?u.username.charAt(0).toUpperCase():'U'}</div>
                <div style="flex:1;">
                    <div style="font-weight:700">${u.name || u.username}</div>
                    <div style="font-size:12px;color:var(--text-secondary)">@${u.username || fid}</div>
                </div>
                <div>
                    <input type="checkbox" data-uid="${fid}" id="chk_${fid}" />
                </div>
            `;
            listEl.appendChild(div);
        }

        // bind change events to checkboxes to update chips
        listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', updateSelectedChips);
        });
        // initialize chips based on any checked (none initially)
        updateSelectedChips();
    } catch (e) {
        console.error('그룹 멤버 목록 로드 오류', e);
        listEl.innerHTML = '<div style="color:var(--text-secondary)">목록 로드 실패</div>';
    }
}

function updateSelectedChips() {
    const listEl = document.getElementById('groupMemberList');
    const chipsEl = document.getElementById('selectedMembersChips');
    if (!listEl || !chipsEl) return;
    const checked = Array.from(listEl.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.dataset.uid);
    chipsEl.innerHTML = '';
    if (!checked.length) {
        chipsEl.setAttribute('aria-hidden','true');
        return;
    }
    chipsEl.removeAttribute('aria-hidden');
    checked.forEach(uid => {
        (async () => {
            const uSnap = await get(ref(database, `users/${uid}`));
            const u = uSnap.exists() ? uSnap.val() : { username: uid, name: uid };
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerHTML = `<span style="font-weight:700">${u.name || u.username}</span> <button class="btn btn-secondary" data-uid="${uid}" style="padding:4px 6px;font-size:12px;">제거</button>`;
            chip.querySelector('button')?.addEventListener('click', () => {
                // uncheck the corresponding checkbox
                const cb = document.getElementById(`chk_${uid}`);
                if (cb) cb.checked = false;
                chip.remove();
            });
            chipsEl.appendChild(chip);
        })();
    });
}

confirmCreateGroup.addEventListener('click', async () => {
    const err = document.getElementById('groupError');
    err.classList.remove('show');
    const groupName = document.getElementById('groupName').value.trim();
    const listEl = document.getElementById('groupMemberList');
    if (!groupName) {
        err.textContent = '그룹 이름을 입력하세요.';
        err.classList.add('show');
        return;
    }
    // get selected uids
    const checks = listEl.querySelectorAll('input[type="checkbox"]:checked');
    if (!checks.length) {
        err.textContent = '최소 한 명의 멤버를 선택하세요.';
        err.classList.add('show');
        return;
    }
    const memberUids = Array.from(checks).map(c=>c.dataset.uid);
    // include creator
    if (!memberUids.includes(currentUser.uid)) memberUids.push(currentUser.uid);

    try {
        // create group
        const groupId = push(ref(database, 'groups')).key;
        const membersObj = {};
        for (const uid of memberUids) {
            // fetch minimal profile
            const uSnap = await get(ref(database, `users/${uid}`));
            membersObj[uid] = uSnap.exists() ? { username: uSnap.val().username, name: uSnap.val().name } : { uid };
        }
        await set(ref(database, `groups/${groupId}`), {
            name: groupName,
            members: membersObj,
            createdAt: Date.now(),
            creator: currentUser.uid,
            updatedAt: Date.now()
        });
        // create chats entries for each member
        const chatKey = `group_${groupId}`;
        for (const uid of memberUids) {
            await set(ref(database, `chats/${uid}/${chatKey}`), {
                lastMessage: `${currentUser.name || currentUser.username}님이 그룹을 만들었습니다.`,
                lastMessageTime: Date.now(),
                unread: uid === currentUser.uid ? false : true
            });
        }

        // close modal and refresh chat list
        groupModal.classList.remove('active');
        loadChatList();
        alert('그룹이 생성되었습니다.');
    } catch (e) {
        console.error('그룹 생성 오류', e);
        err.textContent = '그룹 생성 실패: ' + e.message;
        err.classList.add('show');
    }
});
// ==================== 그룹 정보 보기/관리 ====================
const groupInfoModal = document.getElementById('groupInfoModal');
const groupMembersList = document.getElementById('groupMembersList');
const groupInviteList = document.getElementById('groupInviteList');
const groupInfoTitle = document.getElementById('groupInfoTitle');
const closeGroupInfoBtn = document.getElementById('closeGroupInfo');
const groupInfoError = document.getElementById('groupInfoError');
closeGroupInfoBtn.addEventListener('click', () => {
    groupInfoModal.classList.remove('active');
});
async function openGroupInfo(groupId) {
    groupInfoError.classList.remove('show');
    groupMembersList.innerHTML = '<div style="color:var(--text-secondary)">불러오는 중...</div>';
    groupInviteList.innerHTML = '<div style="color:var(--text-secondary)">불러오는 중...</div>';
    try {
        const gSnap = await get(ref(database, `groups/${groupId}`));
        if (!gSnap.exists()) {
            alert('그룹 정보를 찾을 수 없습니다.');
            return;
        }
        const g = gSnap.val();
        groupInfoTitle.textContent = `그룹: ${g.name || '이름 없음'}`;
        // render members
        const members = g.members || {};
        groupMembersList.innerHTML = '';
        const isCreator = g.creator === currentUser.uid;
        for (const uid of Object.keys(members)) {
            const uSnap = await get(ref(database, `users/${uid}`));
            const u = uSnap.exists() ? uSnap.val() : (members[uid] || { username: uid, name: uid });
            const div = document.createElement('div');
            div.className = 'group-member';
            div.innerHTML = `
                <div class="info">
                    <div class="avatar">${u.username ? u.username.charAt(0).toUpperCase() : 'U'}</div>
                    <div>
                        <div style="font-weight:700">${u.name || u.username || uid}</div>
                        <div style="font-size:12px;color:var(--text-secondary)">@${u.username || uid}</div>
                    </div>
                </div>
                <div>
                
            ${g.creator === uid ? '<span style="font-size:12px;color:var(--text-secondary);margin-right:8px;">관리자</span>' : ''}
                    ${ (isCreator && uid !== currentUser.uid) ? `<button class="btn btn-secondary btn-remove" data-uid="${uid}">추방</button>` : '' }
                </div>
            `;
            groupMembersList.appendChild(div);
        }

        // bind remove buttons
        groupMembersList.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', async (ev) => {
                const targetUid = btn.dataset.uid;
                if (!confirm('정말로 멤버를 추방하시겠습니까?')) return;
                try {
                    // remove member from group
                    await set(ref(database, `groups/${groupId}/members/${targetUid}`), null);
                    // ensure group metadata updated so listeners refresh reliably
                    await update(ref(database, `groups/${groupId}`), { updatedAt: Date.now() });
                    // remove chat entry for that member
                    await set(ref(database, `chats/${targetUid}/group_${groupId}`), null);
                    // push system message
                    const mRef = push(ref(database, `messages/group_${groupId}`));
                    await set(mRef, {
                        type: 'system',
                        text: `${targetUid}님이 그룹에서 추방되었습니다.`,
                        timestamp: Date.now(),
                        senderId: currentUser.uid
                    });
                    // refresh UI
                    openGroupInfo(groupId);
                    if (currentChatId === `group_${groupId}`) {
                        // reload current group data
                        const g2Snap = await get(ref(database, `groups/${groupId}`));
                        const g2 = g2Snap.exists() ? g2Snap.val() : {};
                        currentChatUser.data = g2;
                        // update chat header member count
                        const headerStatus = document.querySelector('.chat-header-status');
                        if (headerStatus) headerStatus.textContent = `멤버 ${g2.members ? Object.keys(g2.members).length : 0}명`;
                    }
                } catch (err) {
                    console.error('멤버 추방 오류', err);
                    groupInfoError.textContent = '추방 실패: ' + err.message;
                    groupInfoError.classList.add('show');
                }
            });
        });

        // render invite candidates (friends who are not members)
        await renderGroupInviteCandidates(groupId);
        groupInfoModal.classList.add('active');
    } catch (e) {
        console.error('그룹 정보 로드 오류', e);
        alert('그룹 정보를 불러오는 중 오류가 발생했습니다.');
    }
}

// 친구 목록 중에서 그룹에 속하지 않은 사용자 목록을 보여준다
async function renderGroupInviteCandidates(groupId) {
    groupInviteList.innerHTML = '<div style="color:var(--text-secondary)">불러오는 중...</div>';
    try {
        const friendsSnap = await get(ref(database, `friends/${currentUser.uid}`));
        const gSnap = await get(ref(database, `groups/${groupId}`));
        if (!friendsSnap.exists()) {
            groupInviteList.innerHTML = '<div style="color:var(--text-secondary)">초대할 친구가 없습니다</div>';
            return;
        }
        const friends = Object.keys(friendsSnap.val());
        const members = gSnap.exists() ? (gSnap.val().members || {}) : {};
        const candidates = friends.filter(f => !members[f]);
        if (candidates.length === 0) {
            groupInviteList.innerHTML = '<div style="color:var(--text-secondary)">초대할 친구가 없습니다</div>';
            return;
        }
        groupInviteList.innerHTML = '';
        for (const fid of candidates) {
            const uSnap = await get(ref(database, `users/${fid}`));
            if (!uSnap.exists()) continue;
            const u = uSnap.val();
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.style.padding = '6px';
            div.style.borderRadius = '6px';
            div.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;font-weight:700;">${u.username?u.username.charAt(0).toUpperCase():'U'}</div>
                    <div>
                        <div style="font-weight:600">${u.name || u.username}</div>
                        <div style="font-size:12px;color:var(--text-secondary)">@${u.username}</div>
                    </div>
                </div>
                <div>
                    <button class="btn btn-primary btn-invite" data-uid="${fid}" data-group="${groupId}">초대</button>
                </div>
            `;
            groupInviteList.appendChild(div);
        }

        // bind invite buttons
        groupInviteList.querySelectorAll('.btn-invite').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fid = btn.dataset.uid;
                const gid = btn.dataset.group;
                try {
                    // add member to group
                    const uSnap = await get(ref(database, `users/${fid}`));
                    const u = uSnap.exists() ? uSnap.val() : { username: fid, name: fid };
                    await set(ref(database, `groups/${gid}/members/${fid}`), { username: u.username, name: u.name });
                    await update(ref(database, `groups/${gid}`), { updatedAt: Date.now() });
                    // add chat entry for invited user
                    await set(ref(database, `chats/${fid}/group_${gid}`), {
                        lastMessage: `${currentUser.name || currentUser.username}님이 초대했습니다.`,
                        lastMessageTime: Date.now(),
                        unread: true
                    });
                    // notify group (system message)
                    const mRef = push(ref(database, `messages/group_${gid}`));
                    await set(mRef, {
                        type: 'system',
                        text: `${u.name || u.username}님이 그룹에 초대되었습니다.`,
                        timestamp: Date.now(),
                        senderId: currentUser.uid
                    });
                    // refresh lists
                    renderGroupInviteCandidates(gid);
                    openGroupInfo(gid);
                } catch (err) {
                    console.error('초대 실패', err);
                    groupInfoError.textContent = '초대 실패: ' + err.message;
                    groupInfoError.classList.add('show');
                }
            });
        });
    } catch (e) {
        console.error('초대 후보 로드 실패', e);
        groupInviteList.innerHTML = '<div style="color:var(--text-secondary)">로딩 실패</div>';
    }
}

// 페이지 종료 시 오프라인 처리 및 리스너 정리
window.addEventListener('beforeunload', () => {
    if (currentUser) {
        updateUserStatus(false);
    }
    cleanupAllListeners();
});

// 전체 리스너 정리 함수
function cleanupAllListeners() {
    try { if (friendsRef) off(friendsRef);
    } catch(e) {}
    try { if (chatsRef) off(chatsRef);
    } catch(e) {}
    try { if (messagesRef) off(messagesRef);
    } catch(e) {}
    try { if (requestsRef) off(requestsRef);
    } catch(e) {}
    friendsRef = null;
    chatsRef = null;
    messagesRef = null;
    requestsRef = null;
}

// ==================== 설정 모달 동작 ====================
const settingsModalEl = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettings');
const userProfileBtn = document.getElementById('userProfile');
const closeSettingsBtn = document.getElementById('closeSettings');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
function openSettings() {
    if (!currentUser) return;
    // 초기값 채우기
    document.getElementById('settingsName').value = currentUser.name || '';
    document.getElementById('settingsStatus').value = currentUser.status || '';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    document.getElementById('settingsError').classList.remove('show');
    document.getElementById('settingsSuccess').classList.remove('show');

    settingsModalEl.classList.add('active');
}

function closeSettings() {
    settingsModalEl.classList.remove('active');
}

openSettingsBtn.addEventListener('click', openSettings);
userProfileBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    const name = document.getElementById('settingsName').value.trim();
    const status = document.getElementById('settingsStatus').value.trim();
    const currentPwd = document.getElementById('currentPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirmNew = document.getElementById('confirmNewPassword').value;
    const err = document.getElementById('settingsError');
    const ok = document.getElementById('settingsSuccess');

    err.classList.remove('show');
    ok.classList.remove('show');

    // 이름/상태 업데이트 (빈값 허용하되 null이 아니게)
    try {
        await update(ref(database, `users/${currentUser.uid}`), {
            name: name,
            status: status
        });

        // 로컬 currentUser 갱신 및 UI 반영
        currentUser.name = name;
        currentUser.status = status;
        localStorage.setItem('chatAppUser', JSON.stringify(currentUser));
        loadUserData();
        loadFriends(); // 친구 목록에 이름/상태 반영

        // 비밀번호 변경 처리(입력한 경우에만)
        if (newPwd || confirmNew || currentPwd) {
            if (!currentPwd) {
                err.textContent = '현재 비밀번호를 입력하세요.';
                err.classList.add('show');
                return;
            }
            if (newPwd.length < 6) {
                err.textContent = '새 비밀번호는 6자 이상이어야 합니다.';
                err.classList.add('show');
                return;
            }
            if (newPwd !== confirmNew) {
                err.textContent = '새 비밀번호와 확인값이 일치하지 않습니다.';
                err.classList.add('show');
                return;
            }

            // 현재 비밀번호 확인
            const userSnap = await get(ref(database, `users/${currentUser.uid}`));
            if (!userSnap.exists()) {
                err.textContent = '사용자 정보를 찾을 수 없습니다.';
                err.classList.add('show');
                return;
            }
            const userData = userSnap.val();
            const hashedCurrent = btoa(currentPwd);
            if (userData.password !== hashedCurrent) {
                err.textContent = '현재 비밀번호가 올바르지 않습니다.';
                err.classList.add('show');
                return;
            }

            // 비밀번호 업데이트
            const hashedNew = btoa(newPwd);
            await update(ref(database, `users/${currentUser.uid}`), {
                password: hashedNew
            });
            ok.textContent = '계정 정보와 비밀번호가 업데이트되었습니다.';
            ok.classList.add('show');
        } else {
            ok.textContent = '계정 정보가 업데이트되었습니다.';
            ok.classList.add('show');
        }

        // 닫지 않고 메시지 보여주기
    } catch (error) {
        console.error('설정 저장 에러:', error);
        err.textContent = '설정 저장 중 오류가 발생했습니다: ' + error.message;
        err.classList.add('show');
    }
});
// 모달 외부 클릭으로 닫기 (백드롭)
settingsModalEl.addEventListener('click', (e) => {
    if (e.target === settingsModalEl) closeSettings();
});
groupModal.addEventListener('click', (e) => {
    if (e.target === groupModal) groupModal.classList.remove('active');
});
groupInfoModal.addEventListener('click', (e) => {
    if (e.target === groupInfoModal) groupInfoModal.classList.remove('active');
});
// 페이지 로드 시 로그인 상태 확인
checkLoginStatus();
