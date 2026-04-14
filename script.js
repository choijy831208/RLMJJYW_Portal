const DEFAULT_USER_ID = 'jjyw';
const DEFAULT_USER_PASSWORD = '756454';
const DEFAULT_PARTICIPANTS = ['진영', '지요', '유하', '우재'];
const MAX_PARTICIPANTS = 20;

var currentUserState = {
    id: '',
    participants: DEFAULT_PARTICIPANTS.slice()
};

bootstrapUserStore();

document.addEventListener('DOMContentLoaded', function() {
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (darkModeBtn) {
        darkModeBtn.addEventListener('click', function() {
            document.body.classList.toggle('dark');
        });
    }

    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('password').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('save-notes').addEventListener('click', saveNotes);
    document.getElementById('save-assets').addEventListener('click', saveAssets);
    document.getElementById('reset-client-data-btn').addEventListener('click', clearClientData);
    document.getElementById('open-signup-btn').addEventListener('click', openSignupModal);
    document.getElementById('account-settings-btn').addEventListener('click', openAccountEditModal);
    initCalendarEventModal();
    initMemoEditorModal();
    initMemoListEvents();
    initMemoVoiceInput();
    initAccountModals();
    initRememberedId();
});

var memoState = {
    entries: [],
    editingId: ''
};

var memoVoiceState = {
    stream: null,
    recorder: null,
    chunks: [],
    recognition: null,
    isRecording: false,
    lastAudioDataUrl: '',
    autoSaveTimer: null,
    lastAutoSavedText: '',
    lastAutoSavedAt: 0,
    lifecycleBound: false,
    hasTranscript: false,
    recognitionSupported: true,
    storageWarned: false
};

function bootstrapUserStore() {
    var users = getUsers();
    var hasDefault = users.some(function(user) { return user.id === DEFAULT_USER_ID; });
    if (!hasDefault) {
        users.push({
            id: DEFAULT_USER_ID,
            hash: CryptoJS.MD5(DEFAULT_USER_PASSWORD).toString(),
            participants: DEFAULT_PARTICIPANTS.slice(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    users = users.map(normalizeUserRecord);
    saveUsers(users);
}

function normalizeUserRecord(user) {
    var createdAt = user && user.createdAt ? user.createdAt : new Date().toISOString();
    return {
        id: user && user.id ? String(user.id).trim() : '',
        hash: user && user.hash ? String(user.hash) : '',
        participants: sanitizeParticipants(user && user.participants),
        createdAt: createdAt,
        updatedAt: user && user.updatedAt ? user.updatedAt : createdAt
    };
}

function sanitizeParticipants(values) {
    var items = [];
    if (Array.isArray(values)) {
        items = values;
    } else if (typeof values === 'string') {
        items = values.split(/\r?\n|,/);
    }

    var normalized = [];
    items.forEach(function(name) {
        var text = String(name || '').trim();
        if (!text) return;
        if (normalized.indexOf(text) >= 0) return;
        normalized.push(text);
    });

    if (!normalized.length) {
        return DEFAULT_PARTICIPANTS.slice();
    }
    return normalized.slice(0, MAX_PARTICIPANTS);
}

function getUsers() {
    return JSON.parse(localStorage.getItem('users') || '[]');
}

function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

function getCurrentUserId() {
    return currentUserState.id || (sessionStorage.getItem('currentUserId') || '');
}

function getScopedKey(baseKey) {
    var userId = getCurrentUserId();
    if (!userId) return baseKey;
    return baseKey + ':' + userId;
}

function migrateLegacyScopedData(userId) {
    if (!userId) return;
    var markKey = 'legacyMigrated:' + userId;
    if (localStorage.getItem(markKey) === '1') return;

    ['memoEntries', 'assetSummary', 'calEvents'].forEach(function(baseKey) {
        var scopedKey = baseKey + ':' + userId;
        var legacy = localStorage.getItem(baseKey);
        if (legacy && !localStorage.getItem(scopedKey)) {
            localStorage.setItem(scopedKey, legacy);
        }
    });

    localStorage.setItem(markKey, '1');
}

function applyCurrentUser(user) {
    if (!user) return;
    currentUserState.id = user.id;
    currentUserState.participants = sanitizeParticipants(user.participants);
    sessionStorage.setItem('currentUserId', user.id);
    migrateLegacyScopedData(user.id);
}

function getCurrentUser() {
    var userId = getCurrentUserId();
    if (!userId) return null;
    return getUsers().find(function(user) { return user.id === userId; }) || null;
}

function getCurrentParticipants() {
    if (Array.isArray(currentUserState.participants) && currentUserState.participants.length) {
        return currentUserState.participants.slice();
    }
    var user = getCurrentUser();
    return sanitizeParticipants(user && user.participants);
}

function handleLogin() {
    const enteredId = document.getElementById('username').value.trim();
    const enteredPassword = document.getElementById('password').value;
    const users = getUsers();
    const user = users.find(function(u) { return u.id === enteredId; });

    if (user && CryptoJS.MD5(enteredPassword).toString() === user.hash) {
        applyCurrentUser(user);
        renderUserContext();
        syncRememberedId();
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('browser-window').style.display = 'block';
        loadDashboardData();
        return;
    }

    document.getElementById('error-msg').textContent = '잘못된 ID 또는 비밀번호입니다.';
}

function handleLogout() {
    sessionStorage.removeItem('currentUserId');
    currentUserState.id = '';
    currentUserState.participants = DEFAULT_PARTICIPANTS.slice();
    document.getElementById('browser-window').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('password').value = '';
    var rememberedId = localStorage.getItem('rememberedId') || '';
    document.getElementById('username').value = rememberedId;
    document.getElementById('remember-id').checked = !!rememberedId;
    document.getElementById('error-msg').textContent = '';
}

function initRememberedId() {
    var rememberedId = localStorage.getItem('rememberedId') || '';
    if (!rememberedId) return;
    document.getElementById('username').value = rememberedId;
    document.getElementById('remember-id').checked = true;
}

function syncRememberedId() {
    var rememberChecked = document.getElementById('remember-id').checked;
    var enteredId = document.getElementById('username').value.trim();
    if (rememberChecked && enteredId) {
        localStorage.setItem('rememberedId', enteredId);
    } else {
        localStorage.removeItem('rememberedId');
    }
}

function clearClientData() {
    if (!confirm('휴대폰에 저장된 메모/일정/자산 데이터를 초기화할까요?')) return;

    var users = getUsers();
    users.forEach(function(user) {
        localStorage.removeItem('memoEntries:' + user.id);
        localStorage.removeItem('assetSummary:' + user.id);
        localStorage.removeItem('calEvents:' + user.id);
    });
    localStorage.removeItem('memoEntries');
    localStorage.removeItem('notes');
    localStorage.removeItem('assetSummary');
    localStorage.removeItem('calEvents');

    alert('저장 데이터가 초기화되었습니다. 새로고침합니다.');
    location.reload();
}

function saveNotes() {
    if (!saveCurrentMemo({
        alertOnEmpty: true,
        clearStatus: true,
        fromVoiceAutoSave: false
    })) return;
}

function saveCurrentMemo(options) {
    var opts = options || {};
    var notesEl = document.getElementById('notes');
    var notes = notesEl ? notesEl.value.trim() : '';
    var hasAudio = !!memoVoiceState.lastAudioDataUrl;
    if (!notes && opts.allowAudioOnly && hasAudio) {
        notes = '[음성 메모] ' + fmtMemoDate(new Date().toISOString());
    }

    if (!notes) {
        if (opts.alertOnEmpty) {
            alert('메모 내용을 입력해주세요.');
        }
        return false;
    }

    if (opts.skipDuplicateAutoSave) {
        var justSaved = (Date.now() - memoVoiceState.lastAutoSavedAt) < 1800;
        if (justSaved && memoVoiceState.lastAutoSavedText === notes) {
            return false;
        }
    }

    var entry = {
        id: createMemoId(),
        text: notes,
        important: false,
        audioDataUrl: memoVoiceState.lastAudioDataUrl || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    memoState.entries.push(entry);
    if (!saveMemoEntries()) {
        memoState.entries.pop();
        return false;
    }

    if (opts.fromVoiceAutoSave) {
        memoVoiceState.lastAutoSavedText = notes;
        memoVoiceState.lastAutoSavedAt = Date.now();
    }

    memoVoiceState.lastAudioDataUrl = '';
    if (notesEl) notesEl.value = '';
    if (opts.statusText) {
        setMemoVoiceStatus(opts.statusText);
    } else if (opts.clearStatus) {
        setMemoVoiceStatus('');
    }
    renderMemoEntries();
    return true;
}

function autoSaveMemoFromVoice(options) {
    var opts = options || {};
    saveCurrentMemo({
        alertOnEmpty: false,
        clearStatus: false,
        fromVoiceAutoSave: true,
        skipDuplicateAutoSave: true,
        allowAudioOnly: !!opts.allowAudioOnly,
        statusText: opts.statusText || '음성 인식 메모를 자동 저장했습니다.'
    });
}

function loadNotes() {
    var storedEntries = JSON.parse(localStorage.getItem(getScopedKey('memoEntries')) || '[]');
    var legacyNote = (localStorage.getItem('notes') || '').trim();

    memoState.entries = (storedEntries || []).filter(function(item) {
        return item && typeof item.text === 'string' && item.text.trim().length > 0;
    }).map(function(item) {
        return {
            id: item.id || createMemoId(),
            text: item.text.trim(),
            important: !!item.important,
            audioDataUrl: typeof item.audioDataUrl === 'string' ? item.audioDataUrl : '',
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
        };
    });

    if (legacyNote && memoState.entries.length === 0) {
        memoState.entries.push({
            id: createMemoId(),
            text: legacyNote,
            important: false,
            audioDataUrl: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    saveMemoEntries();
    document.getElementById('notes').value = '';
    renderMemoEntries();
    checkMemoStoragePressure();
}

function saveMemoEntries() {
    try {
        localStorage.setItem(getScopedKey('memoEntries'), JSON.stringify(memoState.entries));
        checkMemoStoragePressure();
        return true;
    } catch (err) {
        if (err && err.name === 'QuotaExceededError') {
            var cleaned = cleanupOldMemoAudioData();
            if (cleaned) {
                try {
                    localStorage.setItem(getScopedKey('memoEntries'), JSON.stringify(memoState.entries));
                    setMemoVoiceStatus('저장 공간 부족으로 오래된 음성파일 일부를 정리했습니다.');
                    return true;
                } catch (retryErr) {
                    console.error('메모 저장 재시도 실패:', retryErr);
                }
            }
            alert('저장 공간이 부족합니다. 오래된 메모를 삭제한 뒤 다시 시도해주세요.');
            return false;
        }

        console.error('메모 저장 실패:', err);
        alert('메모 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
        return false;
    }
}

function checkMemoStoragePressure() {
    if (!navigator.storage || !navigator.storage.estimate) return;

    navigator.storage.estimate().then(function(est) {
        var usage = Number(est.usage || 0);
        var quota = Number(est.quota || 0);
        if (!quota) return;

        var usagePercent = (usage / quota) * 100;
        if (usagePercent >= 85 && !memoVoiceState.storageWarned) {
            memoVoiceState.storageWarned = true;
            setMemoVoiceStatus('저장 공간 사용량이 높습니다. 오래된 메모 음성을 정리하면 안정적으로 저장됩니다.');
        }
        if (usagePercent < 70) {
            memoVoiceState.storageWarned = false;
        }
    }).catch(function() {
        // storage estimate 미지원 환경
    });
}

function cleanupOldMemoAudioData() {
    var removed = false;
    var ordered = memoState.entries.slice().sort(function(a, b) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    ordered.forEach(function(entry) {
        if (!entry.audioDataUrl) return;
        entry.audioDataUrl = '';
        removed = true;
    });

    return removed;
}

function createMemoId() {
    return 'memo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function fmtMemoDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mi = String(d.getMinutes()).padStart(2, '0');
    return d.getFullYear() + '.' + mm + '.' + dd + ' ' + hh + ':' + mi;
}

function renderMemoEntries() {
    var listEl = document.getElementById('memo-list');
    var titleEl = document.getElementById('memo-log-title');
    if (!listEl) return;

    var ordered = getOrderedMemoEntries();
    if (titleEl) {
        titleEl.textContent = '저장된 메모 (' + ordered.length + ')';
    }

    if (!ordered.length) {
        listEl.innerHTML = '<div class="memo-empty">저장된 메모가 없습니다.</div>';
        return;
    }

    var html = ordered.map(function(entry) {
        return '' +
            '<div class="memo-item" data-id="' + entry.id + '">' +
                '<div class="memo-item-head">' +
                    '<div class="memo-item-meta">저장: ' + fmtMemoDate(entry.createdAt) + '</div>' +
                    '<button type="button" class="memo-star-btn' + (entry.important ? ' active' : '') + '" data-action="star" data-id="' + entry.id + '" title="중요표시">★</button>' +
                '</div>' +
                '<div class="memo-item-text">' + escapeHtml(entry.text).replace(/\n/g, '<br>') + '</div>' +
                (entry.audioDataUrl ? '<div class="memo-audio"><audio controls preload="none" src="' + entry.audioDataUrl + '"></audio></div>' : '') +
                '<div class="memo-item-actions">' +
                    '<button type="button" class="memo-edit-btn" data-action="edit" data-id="' + entry.id + '">수정/삭제</button>' +
                '</div>' +
            '</div>';
    }).join('');

    listEl.innerHTML = html;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function initMemoListEvents() {
    var listEl = document.getElementById('memo-list');
    if (!listEl) return;

    listEl.addEventListener('click', function(e) {
        var target = e.target;
        if (!target) return;
        var action = target.getAttribute('data-action');
        var memoId = target.getAttribute('data-id');
        if (action === 'star') {
            toggleMemoImportant(memoId);
            return;
        }
        if (action !== 'edit') return;
        openMemoEditorModal(memoId);
    });
}

function initMemoEditorModal() {
    if (document.getElementById('memo-editor-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'memo-editor-modal';
    modal.className = 'memo-editor-modal';
    modal.innerHTML = '' +
        '<div class="memo-editor-backdrop"></div>' +
        '<div class="memo-editor-panel" role="dialog" aria-modal="true">' +
            '<div class="memo-editor-head">' +
                '<h4>메모 편집</h4>' +
                '<button type="button" id="memo-editor-close" class="memo-editor-close">닫기</button>' +
            '</div>' +
            '<textarea id="memo-editor-text" class="memo-editor-text" placeholder="메모를 수정하세요"></textarea>' +
            '<div class="memo-editor-actions">' +
                '<button type="button" id="memo-editor-save">저장</button>' +
                '<button type="button" id="memo-editor-delete" class="danger">삭제</button>' +
                '<button type="button" id="memo-editor-cancel" class="ghost">취소</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);

    modal.querySelector('.memo-editor-backdrop').addEventListener('click', closeMemoEditorModal);
    document.getElementById('memo-editor-close').addEventListener('click', closeMemoEditorModal);
    document.getElementById('memo-editor-cancel').addEventListener('click', closeMemoEditorModal);
    document.getElementById('memo-editor-save').addEventListener('click', saveEditedMemo);
    document.getElementById('memo-editor-delete').addEventListener('click', deleteEditedMemo);
}

function openMemoEditorModal(memoId) {
    var entry = memoState.entries.find(function(item) { return item.id === memoId; });
    if (!entry) return;
    memoState.editingId = memoId;
    document.getElementById('memo-editor-text').value = entry.text;
    document.getElementById('memo-editor-modal').classList.add('open');
    document.getElementById('memo-editor-text').focus();
}

function closeMemoEditorModal() {
    memoState.editingId = '';
    var modal = document.getElementById('memo-editor-modal');
    if (modal) modal.classList.remove('open');
}

function saveEditedMemo() {
    if (!memoState.editingId) return;
    var text = document.getElementById('memo-editor-text').value.trim();
    if (!text) {
        alert('메모 내용을 입력해주세요.');
        return;
    }

    var idx = memoState.entries.findIndex(function(item) { return item.id === memoState.editingId; });
    if (idx < 0) return;

    memoState.entries[idx].text = text;
    memoState.entries[idx].updatedAt = new Date().toISOString();
    saveMemoEntries();
    renderMemoEntries();
    closeMemoEditorModal();
}

function deleteEditedMemo() {
    if (!memoState.editingId) return;
    if (!confirm('이 메모를 삭제하시겠어요?')) return;

    memoState.entries = memoState.entries.filter(function(item) { return item.id !== memoState.editingId; });
    saveMemoEntries();
    renderMemoEntries();
    closeMemoEditorModal();
}

function getOrderedMemoEntries() {
    return memoState.entries.slice().sort(function(a, b) {
        if (!!a.important !== !!b.important) return a.important ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

function toggleMemoImportant(memoId) {
    var idx = memoState.entries.findIndex(function(item) { return item.id === memoId; });
    if (idx < 0) return;
    memoState.entries[idx].important = !memoState.entries[idx].important;
    memoState.entries[idx].updatedAt = new Date().toISOString();
    saveMemoEntries();
    renderMemoEntries();
}

function initMemoVoiceInput() {
    var startBtn = document.getElementById('memo-voice-start');
    var stopBtn = document.getElementById('memo-voice-stop');
    var notesEl = document.getElementById('notes');
    if (!startBtn || !stopBtn) return;

    startBtn.addEventListener('click', startMemoVoiceInput);
    stopBtn.addEventListener('click', stopMemoVoiceInput);

    if (notesEl) {
        notesEl.addEventListener('compositionend', function() {
            notesEl.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    if (!memoVoiceState.lifecycleBound) {
        document.addEventListener('visibilitychange', function() {
            if (document.hidden && memoVoiceState.isRecording) {
                setMemoVoiceStatus('화면이 비활성화되어 음성 입력을 중지합니다. 다시 시작해주세요.');
                stopMemoVoiceInput('hidden');
            }
        });

        window.addEventListener('blur', function() {
            if (!memoVoiceState.isRecording) return;
            setMemoVoiceStatus('다른 화면으로 이동하면 음성 인식이 중단될 수 있습니다.');
        });

        memoVoiceState.lifecycleBound = true;
    }
}

function setMemoVoiceStatus(text) {
    var statusEl = document.getElementById('memo-voice-status');
    if (statusEl) statusEl.textContent = text || '';
}

function setMemoVoiceUi(recording) {
    var startBtn = document.getElementById('memo-voice-start');
    var stopBtn = document.getElementById('memo-voice-stop');
    if (startBtn) startBtn.disabled = recording;
    if (stopBtn) stopBtn.disabled = !recording;
}

function refineKoreanSpeechText(text) {
    if (!text) return '';
    var t = text.replace(/\s+/g, ' ').trim();
    t = t.replace(/\s*([,.!?])/g, '$1');
    if (t && !/[.!?]$/.test(t)) t += '.';
    return t;
}

function startMemoVoiceInput() {
    if (memoVoiceState.isRecording) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('이 브라우저는 음성 녹음을 지원하지 않습니다.');
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        memoVoiceState.hasTranscript = false;
        checkMemoStoragePressure();
        memoVoiceState.stream = stream;
        memoVoiceState.chunks = [];
        memoVoiceState.recorder = new MediaRecorder(stream);
        memoVoiceState.recorder.ondataavailable = function(ev) {
            if (ev.data && ev.data.size > 0) memoVoiceState.chunks.push(ev.data);
        };
        memoVoiceState.recorder.onstop = function() {
            var blob = new Blob(memoVoiceState.chunks, { type: memoVoiceState.recorder.mimeType || 'audio/webm' });
            var reader = new FileReader();
            reader.onloadend = function() {
                memoVoiceState.lastAudioDataUrl = typeof reader.result === 'string' ? reader.result : '';
                if (memoVoiceState.lastAudioDataUrl) {
                    setMemoVoiceStatus('음성 녹음이 완료되었습니다. 메모 저장 시 원본 음성이 함께 저장됩니다.');
                    var notesEl = document.getElementById('notes');
                    var hasText = notesEl && notesEl.value.trim().length > 0;
                    if (!memoVoiceState.hasTranscript && !hasText) {
                        autoSaveMemoFromVoice({
                            allowAudioOnly: true,
                            statusText: '텍스트 변환 없이 음성 메모로 자동 저장했습니다.'
                        });
                    }
                }
            };
            reader.readAsDataURL(blob);
        };

        memoVoiceState.recorder.start();
        memoVoiceState.isRecording = true;
        setMemoVoiceUi(true);
        setMemoVoiceStatus('음성 입력 중... 완료 후 중지 버튼을 눌러주세요.');
        startSpeechRecognitionForMemo();
    }).catch(function(err) {
        var code = err && err.name ? err.name : '';
        if (code === 'NotAllowedError' || code === 'PermissionDeniedError') {
            setMemoVoiceStatus('마이크 권한이 거부되었습니다. 브라우저 권한을 허용해주세요.');
            return;
        }
        if (code === 'NotFoundError' || code === 'DevicesNotFoundError') {
            setMemoVoiceStatus('사용 가능한 마이크를 찾을 수 없습니다.');
            return;
        }
        if (code === 'NotReadableError' || code === 'TrackStartError') {
            setMemoVoiceStatus('마이크가 다른 앱에서 사용 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }
        setMemoVoiceStatus('마이크 초기화에 실패했습니다. 다시 시도해주세요.');
    });
}

function startSpeechRecognitionForMemo() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        memoVoiceState.recognitionSupported = false;
        setMemoVoiceStatus('이 브라우저는 음성 텍스트 변환을 지원하지 않습니다. 녹음 종료 시 음성 메모로 자동 저장됩니다.');
        return;
    }

    memoVoiceState.recognitionSupported = true;

    var recognition = new SR();
    memoVoiceState.recognition = recognition;
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = function(ev) {
        if (!ev.results || !ev.results[0] || !ev.results[0][0]) return;
        memoVoiceState.hasTranscript = true;
        var transcript = ev.results[0][0].transcript || '';
        var refined = refineKoreanSpeechText(transcript);
        var notesEl = document.getElementById('notes');
        if (!notesEl) return;

        notesEl.value = refined;
        notesEl.dispatchEvent(new Event('input', { bubbles: true }));
        notesEl.dispatchEvent(new Event('change', { bubbles: true }));
        setMemoVoiceStatus('음성 인식 완료: 자동 저장 중입니다...');

        if (memoVoiceState.autoSaveTimer) {
            clearTimeout(memoVoiceState.autoSaveTimer);
        }
        memoVoiceState.autoSaveTimer = setTimeout(function() {
            autoSaveMemoFromVoice();
            memoVoiceState.autoSaveTimer = null;
        }, 250);
    };

    recognition.onerror = function(ev) {
        var code = ev && ev.error ? ev.error : '';
        if (code === 'no-speech') {
            setMemoVoiceStatus('음성을 감지하지 못했습니다. 다시 시도해주세요.');
            return;
        }
        if (code === 'network') {
            setMemoVoiceStatus('네트워크 문제로 음성 인식이 중단되었습니다. 연결 후 다시 시도해주세요.');
            return;
        }
        if (code === 'not-allowed' || code === 'service-not-allowed') {
            setMemoVoiceStatus('음성 인식 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.');
            return;
        }
        setMemoVoiceStatus('음성 인식 중 오류가 발생했습니다. 텍스트를 직접 수정해 저장해주세요.');
    };

    recognition.onend = function() {
        if (memoVoiceState.isRecording && memoVoiceState.recognitionSupported && !memoVoiceState.hasTranscript) {
            setMemoVoiceStatus('음성 인식이 종료되었습니다. 필요하면 다시 시작해주세요.');
        }
    };

    try {
        recognition.start();
    } catch (err) {
        setMemoVoiceStatus('음성 인식을 시작하지 못했습니다. 다시 시도해주세요.');
    }
}

function stopMemoVoiceInput(reason) {
    if (!memoVoiceState.isRecording) return;

    memoVoiceState.isRecording = false;
    setMemoVoiceUi(false);

    if (memoVoiceState.autoSaveTimer) {
        clearTimeout(memoVoiceState.autoSaveTimer);
        memoVoiceState.autoSaveTimer = null;
        autoSaveMemoFromVoice();
    }

    if (memoVoiceState.recognition) {
        try { memoVoiceState.recognition.stop(); } catch (e) {}
        memoVoiceState.recognition = null;
    }
    if (memoVoiceState.recorder && memoVoiceState.recorder.state !== 'inactive') {
        memoVoiceState.recorder.stop();
    }
    if (memoVoiceState.stream) {
        memoVoiceState.stream.getTracks().forEach(function(track) { track.stop(); });
        memoVoiceState.stream = null;
    }

    if (reason !== 'hidden' && !memoVoiceState.lastAudioDataUrl) {
        setMemoVoiceStatus('음성 입력이 종료되었습니다.');
    }
}

function loadNews() {
    const list = document.getElementById('news-feed');
    const fallback = [
        '가계 물가 동향, 생활비 절약 팁 집중 보도',
        '주요 은행 금리 변동, 대출 전략 점검 필요',
        'AI 생활도구 트렌드, 가정 자동화 서비스 확대',
        '지역 행사 소식, 주말 가족 프로그램 다수 진행',
        '오늘의 건강 뉴스, 균형 식단 관리 중요성 강조'
    ];

    fetch('https://newsapi.org/v2/top-headlines?country=kr&pageSize=5&apiKey=YOUR_API_KEY')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (!data.articles || !data.articles.length) {
                renderNews(fallback);
                return;
            }
            const headlines = data.articles.slice(0, 5).map(function(article) {
                return article.title;
            });
            renderNews(headlines);
        })
        .catch(function() {
            renderNews(fallback);
        });

    function renderNews(headlines) {
        list.innerHTML = headlines.map(function(headline) {
            return '<li><i class="fas fa-rss"></i><span>' + headline + '</span></li>';
        }).join('');
    }
}

function saveAssets() {
    const total = Number(document.getElementById('input-total').value || 0);
    const loan = Number(document.getElementById('input-loan').value || 0);
    const payload = { total: total, loan: loan };
    localStorage.setItem(getScopedKey('assetSummary'), JSON.stringify(payload));
    renderAssets(payload);
}

function loadAssets() {
    const stored = JSON.parse(localStorage.getItem(getScopedKey('assetSummary')) || '{"total":0,"loan":0}');
    document.getElementById('input-total').value = stored.total || '';
    document.getElementById('input-loan').value = stored.loan || '';
    renderAssets(stored);
}

function renderAssets(data) {
    const total = Number(data.total || 0);
    const loan = Number(data.loan || 0);
    const net = total - loan;

    document.getElementById('asset-total').textContent = formatWon(total);
    document.getElementById('asset-loan').textContent = formatWon(loan);
    document.getElementById('asset-net').textContent = formatWon(net);

    const base = Math.max(total, loan, Math.abs(net), 1);
    document.getElementById('bar-total').style.width = Math.max((total / base) * 100, 4) + '%';
    document.getElementById('bar-loan').style.width = Math.max((loan / base) * 100, 4) + '%';
    document.getElementById('bar-net').style.width = Math.max((Math.abs(net) / base) * 100, 4) + '%';
}

function formatWon(value) {
    return Number(value).toLocaleString('ko-KR') + '원';
}

function loadDashboardData() {
    renderUserContext();
    renderInputMemberOptions();
    loadNotes();
    loadNews();
    loadAssets();
    initCalendar();
    initDashboardTabs();
}

var dashboardTabState = {
    current: 'schedule',
    initialized: false
};

function initDashboardTabs() {
    var tabButtons = document.querySelectorAll('.portal-tab-btn');
    if (!tabButtons.length) return;

    if (!dashboardTabState.initialized) {
        tabButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                setDashboardTab(btn.getAttribute('data-tab'));
            });
        });
        dashboardTabState.initialized = true;
    }

    setDashboardTab(dashboardTabState.current || 'schedule');
}

function setDashboardTab(tabKey) {
    dashboardTabState.current = tabKey;

    var calendarWidget = document.getElementById('calendar-widget');
    var memoWidget = document.getElementById('memo-widget');
    var newsWidget = document.getElementById('news-widget');
    var assetWidget = document.getElementById('asset-widget');
    var allWidgets = [calendarWidget, memoWidget, newsWidget, assetWidget];
    var grid = document.querySelector('.widgets-grid');

    var visibleWidgets;
    if (tabKey === 'asset') {
        visibleWidgets = [assetWidget];
    } else if (tabKey === 'report') {
        visibleWidgets = [newsWidget];
    } else {
        visibleWidgets = [calendarWidget, memoWidget];
    }

    allWidgets.forEach(function(widget) {
        if (!widget) return;
        widget.classList.toggle('widget-hidden', visibleWidgets.indexOf(widget) < 0);
    });

    if (grid) {
        grid.classList.remove('tab-schedule', 'tab-asset', 'tab-report');
        if (tabKey === 'asset') grid.classList.add('tab-asset');
        else if (tabKey === 'report') grid.classList.add('tab-report');
        else grid.classList.add('tab-schedule');
    }

    document.querySelectorAll('.portal-tab-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
    });
}

// ===== 달력 위젯 =====
var calState = {
    view: 'calendar',
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    events: []
};

var calModalState = {
    mode: 'edit',
    eventId: ''
};

function initCalendar() {
    var storedEvents = (JSON.parse(localStorage.getItem(getScopedKey('calEvents')) || '[]') || []);
    calState.events = storedEvents.map(normalizeCalEvent).filter(function(ev) { return !!ev; });
    localStorage.setItem(getScopedKey('calEvents'), JSON.stringify(calState.events));
    calState.year = new Date().getFullYear();
    calState.month = new Date().getMonth();

    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('cal-date-start').value = yyyy + '-' + mm + '-' + dd;
    document.getElementById('cal-date-end').value = yyyy + '-' + mm + '-' + dd;
    document.getElementById('cal-date-end').min = yyyy + '-' + mm + '-' + dd;
    document.getElementById('cal-all-day').checked = false;

    document.getElementById('cal-prev').addEventListener('click', function() {
        calState.month--;
        if (calState.month < 0) { calState.month = 11; calState.year--; }
        renderCalendarView();
    });
    document.getElementById('cal-next').addEventListener('click', function() {
        calState.month++;
        if (calState.month > 11) { calState.month = 0; calState.year++; }
        renderCalendarView();
    });
    document.getElementById('btn-cal-view').addEventListener('click', function() { setCalView('calendar'); });
    document.getElementById('btn-list-view').addEventListener('click', function() { setCalView('list'); });
    document.getElementById('cal-type').addEventListener('change', syncMemberByType);
    document.getElementById('cal-date-start').addEventListener('change', syncInputEndDateMin);
    document.getElementById('cal-add-btn').addEventListener('click', addCalEvent);
    document.getElementById('cal-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addCalEvent();
    });
    initInputMemberPicker();
    renderInputMemberOptions();

    syncInputEndDateMin();
    syncMemberByType();

    renderCalendarView();
}

function setCalView(view) {
    calState.view = view;
    document.getElementById('cal-calendar-view').style.display = view === 'calendar' ? '' : 'none';
    document.getElementById('cal-list-view').style.display = view === 'list' ? '' : 'none';
    document.getElementById('btn-cal-view').classList.toggle('active', view === 'calendar');
    document.getElementById('btn-list-view').classList.toggle('active', view === 'list');
    document.getElementById('cal-mode-label').textContent = view === 'calendar' ? '달력' : '리스트';
    if (view === 'list') renderListView();
    else renderCalendarView();
}

function renderCalendarView() {
    var y = calState.year, m = calState.month;
    document.getElementById('cal-month-title').textContent = y + '년 ' + (m + 1) + '월';

    var today = new Date();
    var firstDay = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var tbody = document.getElementById('cal-body');
    tbody.innerHTML = '';

    var day = 1 - firstDay;
    for (var row = 0; row < 6; row++) {
        var tr = document.createElement('tr');
        var hasDay = false;
        for (var col = 0; col < 7; col++) {
            var td = document.createElement('td');
            if (day > 0 && day <= daysInMonth) {
                hasDay = true;
                var isToday = (today.getFullYear() === y && today.getMonth() === m && today.getDate() === day);
                if (isToday) td.classList.add('cal-today');
                if (col === 0) td.classList.add('sun');
                if (col === 6) td.classList.add('sat');

                var dateStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                var dayEvents = calState.events.filter(function(e) { return eventOccursOnDate(e, dateStr); });
                var hasConflict = detectConflicts(dayEvents, dateStr).length > 0;

                var numEl = document.createElement('span');
                numEl.className = 'cal-day-num';
                numEl.textContent = day;
                if (hasConflict) {
                    var warn = document.createElement('span');
                    warn.className = 'cal-warn';
                    warn.textContent = '⚠';
                    numEl.appendChild(warn);
                }
                td.appendChild(numEl);

                dayEvents.slice(0, 2).forEach(function(ev, idx) {
                    var evEl = document.createElement('div');
                    evEl.className = 'cal-ev ' + (ev.type === 'family' ? 'cal-ev-family' : 'cal-ev-personal');
                    evEl.textContent = getEventEmoji(ev) + ' ' + ev.title;
                    var memberText = '';
                    if (Array.isArray(ev.member) && ev.member.length > 0) {
                        memberText = ev.member.join(', ');
                    } else if (typeof ev.member === 'string' && ev.member) {
                        memberText = ev.member;
                    }
                    evEl.title = getEventDateLabel(ev) + (memberText ? ' · ' + memberText : '') + ' · ' + getEventTimeLabel(ev);
                    evEl.style.cursor = 'pointer';
                    evEl.addEventListener('click', function() {
                        openCalendarEventActions(ev.id);
                    });
                    td.appendChild(evEl);
                });
                if (dayEvents.length > 2) {
                    var more = document.createElement('div');
                    more.className = 'cal-ev-more';
                    more.textContent = '+' + (dayEvents.length - 2);
                    td.appendChild(more);
                }
            }
            tr.appendChild(td);
            day++;
        }
        if (!hasDay && row > 0) break;
        tbody.appendChild(tr);
    }
    renderCalSummary();
}

function renderListView() {
    var today = new Date();
    var todayStr = fmtDate(today);
    var tomorrowStr = fmtDate(new Date(today.getTime() + 86400000));
    var weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + (7 - today.getDay()));
    var weekEndStr = fmtDate(weekEnd);

    var todayEvs = calState.events.filter(function(e) { return eventOccursOnDate(e, todayStr); });
    var tomorrowEvs = calState.events.filter(function(e) { return eventOccursOnDate(e, tomorrowStr); });
    var weekEvs = calState.events.filter(function(e) { return e.type === 'family' && eventRangeOverlaps(e, tomorrowStr, weekEndStr); });
    var conflicts = detectConflicts(calState.events);

    var actions = generateActions(todayEvs, tomorrowEvs, weekEvs);

    function evLine(ev) {
        var memberText = '';
        if (Array.isArray(ev.member)) {
            memberText = ev.member.length > 0 ? ' [' + ev.member.join(', ') + ']' : '';
        } else if (typeof ev.member === 'string' && ev.member) {
            memberText = ' [' + ev.member + ']';
        }
        return '<li>' + getEventDateLabel(ev) + ' · ' + getListStartTimeLabel(ev) +
            memberText +
            ' ' + (ev.type === 'family' ? '[가족]' : '[개인]') +
            ' ' + ev.title + '</li>';
    }

    var html = '';
    html += '<div class="cal-list-section"><div class="cal-list-title">오늘 일정</div><ul>' + (todayEvs.length ? todayEvs.map(evLine).join('') : '<li class="cal-empty">일정 없음</li>') + '</ul></div>';
    html += '<div class="cal-list-section"><div class="cal-list-title">내일 일정</div><ul>' + (tomorrowEvs.length ? tomorrowEvs.map(evLine).join('') : '<li class="cal-empty">일정 없음</li>') + '</ul></div>';
    html += '<div class="cal-list-section"><div class="cal-list-title">이번 주 가족 행사</div><ul>' + (weekEvs.length ? weekEvs.map(evLine).join('') : '<li class="cal-empty">행사 없음</li>') + '</ul></div>';
    html += '<div class="cal-list-section cal-conflict"><div class="cal-list-title">⚠ 중복 일정 확인</div><ul>' + (conflicts.length ? conflicts.map(function(c) { return '<li>' + c.date + ' ' + c.title + ' ↔ ' + c.with + '</li>'; }).join('') : '<li class="cal-empty">없음</li>') + '</ul></div>';
    html += '<div class="cal-list-section cal-actions"><div class="cal-list-title">추천 액션</div><ul>' + actions.map(function(a) { return '<li>' + a + '</li>'; }).join('') + '</ul></div>';

    document.getElementById('cal-list-body').innerHTML = html;
}

function renderCalSummary() {
    var y = calState.year, m = calState.month;
    var monthStart = y + '-' + String(m + 1).padStart(2, '0') + '-01';
    var monthEnd = fmtDate(new Date(y, m + 1, 0));
    var monthEvs = calState.events.filter(function(e) { return eventRangeOverlaps(e, monthStart, monthEnd); });
    var familyCount = monthEvs.filter(function(e) { return e.type === 'family'; }).length;
    var personalCount = monthEvs.filter(function(e) { return e.type === 'personal'; }).length;
    var conflictCount = detectConflicts(monthEvs).length;
    var lines = [];
    if (familyCount > 0) lines.push('가족 행사 ' + familyCount + '건');
    if (personalCount > 0) lines.push('개인 일정 ' + personalCount + '건');
    if (conflictCount > 0) lines.push('⚠ 중복 ' + conflictCount + '건');
    if (lines.length === 0) lines.push('이번 달 등록된 일정이 없습니다.');
    document.getElementById('cal-summary').textContent = lines.slice(0, 3).join(' · ');
}

function detectConflicts(events, targetDate) {
    var conflicts = [];
    var seen = {};
    for (var i = 0; i < events.length; i++) {
        for (var j = i + 1; j < events.length; j++) {
            var a = events[i], b = events[j];
            if (!eventRangesOverlap(a, b.startDate, b.endDate)) continue;
            var overlapDate = compareDateStr(a.startDate, b.startDate) >= 0 ? a.startDate : b.startDate;
            if (targetDate && !(eventOccursOnDate(a, targetDate) && eventOccursOnDate(b, targetDate))) continue;
            if (!(eventsShareMember(a, b) || a.type === 'family' || b.type === 'family')) continue;

            var conflictKey = (targetDate || overlapDate) + '|' + a.title + '|' + b.title;
            if (seen[conflictKey]) continue;

            if (a.isAllDay || b.isAllDay) {
                conflicts.push({ date: targetDate || overlapDate, title: a.title, with: b.title });
                seen[conflictKey] = true;
                continue;
            }
            if (!a.time || !b.time) continue;
            var aS = timeToMin(a.time), bS = timeToMin(b.time);
            var aE = aS + (a.duration || 60), bE = bS + (b.duration || 60);
            if (aS < bE && bS < aE) {
                conflicts.push({ date: targetDate || overlapDate, title: a.title, with: b.title });
                seen[conflictKey] = true;
            }
        }
    }
    return conflicts;
}

function timeToMin(t) {
    var p = t.split(':');
    return parseInt(p[0]) * 60 + parseInt(p[1]);
}

function generateActions(todayEvs, tomorrowEvs, weekEvs) {
    var actions = [];
    if (tomorrowEvs.length > 0) actions.push('내일 일정 알림 확인: ' + tomorrowEvs[0].title);
    if (weekEvs.length > 0) actions.push('이번 주 가족 행사 준비: ' + weekEvs[0].title);
    var unassigned = calState.events.filter(function(e) { return e.endDate >= fmtDate(new Date()) && !hasMembers(e.member); });
    if (unassigned.length > 0) actions.push('참여자 미지정 일정 ' + unassigned.length + '건 확인 필요');
    if (actions.length === 0) actions.push('오늘 새 일정을 추가해보세요.');
    return actions.slice(0, 3);
}

function addCalEvent() {
    var title = document.getElementById('cal-input').value.trim();
    var startDate = normalizeDateString(document.getElementById('cal-date-start').value);
    var endDate = normalizeDateString(document.getElementById('cal-date-end').value);
    var time = document.getElementById('cal-time-start').value;
    var isAllDay = document.getElementById('cal-all-day').checked;
    var type = document.getElementById('cal-type').value;
    var members = type === 'personal' ? getInputCheckedMembers() : [];
    var member = members.length > 0 ? members : '';

    if (!title || !startDate) { alert('제목과 시작일을 입력해주세요.'); return; }
    if (!endDate) endDate = startDate;
    if (compareDateStr(endDate, startDate) < 0) { alert('종료일은 시작일보다 빠를 수 없습니다.'); return; }

    var newEvent = {
        id: createEventId(),
        title: title,
        startDate: startDate,
        endDate: endDate,
        isAllDay: isAllDay,
        time: time,
        member: member,
        type: type,
        duration: 60
    };
    var conflicts = detectConflictsWithEvent(newEvent, calState.events);
    if (conflicts.length > 0) {
        if (!confirm('겹치는 일정이 있습니다.\n' + conflicts[0].title + ' ↔ ' + conflicts[0].with + '\n이 일정을 추가하시겠어요?')) return;
    }

    calState.events.push(newEvent);
    saveCalendarEvents();
    document.getElementById('cal-input').value = '';

    if (calState.view === 'calendar') renderCalendarView();
    else renderListView();
}

function fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function normalizeCalEvent(ev) {
    var legacyDate = normalizeDateString(ev.date || '');
    var startDate = normalizeDateString(ev.startDate || '') || legacyDate;
    var endDate = normalizeDateString(ev.endDate || '') || legacyDate || startDate;
    if (!endDate) endDate = startDate;
    if (!startDate) startDate = endDate;
    if (!startDate || !endDate) return null;
    if (compareDateStr(endDate, startDate) < 0) endDate = startDate;

    var member = ev.member || '';
    if (typeof member === 'string' && member.length > 0) {
        member = [member];
    } else if (Array.isArray(member)) {
        member = member.filter(function(m) { return m && m.length > 0; });
    } else {
        member = '';
    }

    return {
        id: ev.id || createEventId(),
        title: ev.title || '',
        startDate: startDate,
        endDate: endDate,
        isAllDay: !!ev.isAllDay,
        time: ev.time || '',
        member: member,
        type: ev.type === 'personal' ? 'personal' : 'family',
        duration: ev.duration || 60
    };
}

function eventOccursOnDate(ev, dateStr) {
    if (!ev || !ev.startDate || !ev.endDate || !dateStr) return false;
    return compareDateStr(ev.startDate, dateStr) <= 0 && compareDateStr(ev.endDate, dateStr) >= 0;
}

function eventRangeOverlaps(ev, startDate, endDate) {
    if (!ev || !ev.startDate || !ev.endDate || !startDate || !endDate) return false;
    return compareDateStr(ev.startDate, endDate) <= 0 && compareDateStr(ev.endDate, startDate) >= 0;
}

function getEventDateLabel(ev) {
    if (ev.startDate === ev.endDate) return ev.startDate;
    return ev.startDate + ' ~ ' + ev.endDate;
}

function getEventTimeLabel(ev) {
    if (ev.isAllDay) return '종일';
    return ev.time || '--:--';
}

function getListStartTimeLabel(ev) {
    if (ev.isAllDay) return '종일';
    return '시작 ' + (ev.time || '--:--');
}

function syncMemberByType() {
    var typeEl = document.getElementById('cal-type');
    var picker = document.getElementById('cal-member-picker');
    var toggleBtn = document.getElementById('cal-member-toggle');
    var menu = document.getElementById('cal-member-menu');
    var checks = document.querySelectorAll('.cal-input-member-check');
    var isFamily = typeEl.value === 'family';

    if (isFamily) {
        checks.forEach(function(chk) { chk.checked = false; chk.disabled = true; });
        picker.classList.add('disabled');
        toggleBtn.disabled = true;
        toggleBtn.title = '가족 행사는 참여자 선택이 필요하지 않습니다.';
        menu.style.display = 'none';
        toggleBtn.textContent = '참여자 선택';
    } else {
        checks.forEach(function(chk) { chk.disabled = false; });
        picker.classList.remove('disabled');
        toggleBtn.disabled = false;
        toggleBtn.title = '';
        updateInputMemberToggleText();
    }
}

function detectConflictsWithEvent(targetEvent, events) {
    var conflicts = [];
    var seen = {};
    events.forEach(function(ev) {
        if (!eventRangeOverlaps(ev, targetEvent.startDate, targetEvent.endDate)) return;
        if (!(eventsShareMember(targetEvent, ev) || targetEvent.type === 'family' || ev.type === 'family')) return;

        var overlapDate = compareDateStr(targetEvent.startDate, ev.startDate) >= 0 ? targetEvent.startDate : ev.startDate;
        var conflictKey = overlapDate + '|' + targetEvent.title + '|' + ev.title;
        if (seen[conflictKey]) return;
        if (targetEvent.isAllDay || ev.isAllDay) {
            conflicts.push({ date: overlapDate, title: targetEvent.title, with: ev.title });
            seen[conflictKey] = true;
            return;
        }
        if (!targetEvent.time || !ev.time) return;

        var tS = timeToMin(targetEvent.time), eS = timeToMin(ev.time);
        var tE = tS + (targetEvent.duration || 60), eE = eS + (ev.duration || 60);
        if (tS < eE && eS < tE) {
            conflicts.push({ date: overlapDate, title: targetEvent.title, with: ev.title });
            seen[conflictKey] = true;
        }
    });
    return conflicts;
}

function eventRangesOverlap(ev, startDate, endDate) {
    return eventRangeOverlaps(ev, startDate, endDate);
}

function compareDateStr(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

function normalizeDateString(value) {
    if (!value || typeof value !== 'string') return '';
    var text = value.trim();
    var m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return '';
    var y = parseInt(m[1], 10);
    var mm = parseInt(m[2], 10);
    var dd = parseInt(m[3], 10);
    var d = new Date(y, mm - 1, dd);
    if (d.getFullYear() !== y || d.getMonth() !== mm - 1 || d.getDate() !== dd) return '';
    return y + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
}

function getEventEmoji(ev) {
    if (ev.type === 'family') return '👨‍👩‍👧‍👦';
    if (!Array.isArray(ev.member) || ev.member.length === 0) return '🙂';
    if (ev.member.length > 1) return '👥';
    var emojis = ['🙂', '🧑', '👩', '👨', '👧', '👦', '🧒', '🧑‍💻'];
    var name = String(ev.member[0] || '');
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
        hash += name.charCodeAt(i);
    }
    return emojis[hash % emojis.length];
}

function hasMembers(member) {
    return Array.isArray(member) && member.length > 0;
}

function eventsShareMember(a, b) {
    if (!Array.isArray(a.member) || !Array.isArray(b.member)) return false;
    for (var i = 0; i < a.member.length; i++) {
        if (b.member.indexOf(a.member[i]) >= 0) return true;
    }
    return false;
}

function createEventId() {
    return 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function saveCalendarEvents() {
    localStorage.setItem(getScopedKey('calEvents'), JSON.stringify(calState.events));
}

function refreshCalendarCurrentView() {
    if (calState.view === 'calendar') renderCalendarView();
    else renderListView();
}

function findEventById(eventId) {
    return calState.events.find(function(e) { return e.id === eventId; }) || null;
}

function findEventIndexById(eventId) {
    for (var i = 0; i < calState.events.length; i++) {
        if (calState.events[i].id === eventId) return i;
    }
    return -1;
}

function getMemberText(ev) {
    if (Array.isArray(ev.member) && ev.member.length > 0) return ev.member.join(', ');
    if (typeof ev.member === 'string' && ev.member) return ev.member;
    return '';
}

function parseMemberInput(text) {
    if (!text) return [];
    var allow = getCurrentParticipants();
    return text.split(',').map(function(v) { return v.trim(); }).filter(function(v) {
        return allow.indexOf(v) >= 0;
    });
}

function openCalendarEventActions(eventId) {
    var ev = findEventById(eventId);
    if (!ev) return;
    calModalState.eventId = eventId;
    showEventActionPanel(ev);
    showCalendarEventModal();
}

function editCalendarEvent(eventId) {
    var ev = findEventById(eventId);
    if (!ev) return;
    openEventEditorModal('edit', ev);
}

function copyCalendarEvent(eventId) {
    var ev = findEventById(eventId);
    if (!ev) return;
    openEventEditorModal('copy', ev);
}

function deleteCalendarEvent(eventId) {
    var idx = findEventIndexById(eventId);
    if (idx < 0) return;
    if (!confirm('이 일정을 삭제하시겠어요?')) return;
    calState.events.splice(idx, 1);
    saveCalendarEvents();
    refreshCalendarCurrentView();
}

function initCalendarEventModal() {
    if (document.getElementById('cal-event-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'cal-event-modal';
    modal.className = 'cal-event-modal';
    modal.innerHTML =
        '<div class="cal-event-modal-backdrop"></div>' +
        '<div class="cal-event-modal-panel" role="dialog" aria-modal="true">' +
            '<div class="cal-event-modal-head">' +
                '<h4 id="cal-event-modal-title">일정 관리</h4>' +
                '<button type="button" id="cal-event-modal-close" class="cal-event-modal-close">닫기</button>' +
            '</div>' +
            '<div id="cal-event-action-panel" class="cal-event-action-panel">' +
                '<p id="cal-event-summary" class="cal-event-summary"></p>' +
                '<div class="cal-event-action-buttons">' +
                    '<button type="button" id="cal-action-edit">일정 수정</button>' +
                    '<button type="button" id="cal-action-copy">일정 복사</button>' +
                    '<button type="button" id="cal-action-delete" class="danger">일정 삭제</button>' +
                '</div>' +
            '</div>' +
            '<form id="cal-event-editor" class="cal-event-editor" style="display:none;">' +
                '<label>제목<input type="text" id="cal-modal-title-input" required></label>' +
                '<label>시작일<input type="date" id="cal-modal-start-input" required></label>' +
                '<label>종료일<input type="date" id="cal-modal-end-input" required></label>' +
                '<label>타입<select id="cal-modal-type-input"><option value="family">가족 행사</option><option value="personal">개인 일정</option></select></label>' +
                '<label>시간<input type="time" id="cal-modal-time-input"></label>' +
                '<label class="cal-modal-all-day"><input type="checkbox" id="cal-modal-all-day-input">종일</label>' +
                '<fieldset id="cal-modal-members-wrap" class="cal-modal-members-group">' +
                    '<legend>참여자(개인 일정)</legend>' +
                    '<div id="cal-modal-members-list"></div>' +
                '</fieldset>' +
                '<div class="cal-event-action-buttons">' +
                    '<button type="submit" id="cal-modal-save">저장</button>' +
                    '<button type="button" id="cal-modal-cancel">취소</button>' +
                '</div>' +
            '</form>' +
        '</div>';

    document.body.appendChild(modal);

    modal.querySelector('.cal-event-modal-backdrop').addEventListener('click', hideCalendarEventModal);
    document.getElementById('cal-event-modal-close').addEventListener('click', hideCalendarEventModal);
    document.getElementById('cal-action-edit').addEventListener('click', function() { editCalendarEvent(calModalState.eventId); });
    document.getElementById('cal-action-copy').addEventListener('click', function() { copyCalendarEvent(calModalState.eventId); });
    document.getElementById('cal-action-delete').addEventListener('click', function() {
        deleteCalendarEvent(calModalState.eventId);
        hideCalendarEventModal();
    });
    document.getElementById('cal-modal-cancel').addEventListener('click', function() { showEventActionPanel(findEventById(calModalState.eventId)); });
    document.getElementById('cal-modal-type-input').addEventListener('change', syncModalMembersEnabled);
    document.getElementById('cal-modal-all-day-input').addEventListener('change', syncModalTimeEnabled);
    document.getElementById('cal-modal-start-input').addEventListener('change', syncModalEndDateMin);
    document.getElementById('cal-event-editor').addEventListener('submit', handleCalendarEventEditorSubmit);
}

function showCalendarEventModal() {
    var modal = document.getElementById('cal-event-modal');
    if (modal) modal.classList.add('open');
}

function hideCalendarEventModal() {
    var modal = document.getElementById('cal-event-modal');
    if (modal) modal.classList.remove('open');
}

function showEventActionPanel(ev) {
    if (!ev) return;
    document.getElementById('cal-event-modal-title').textContent = '일정 관리';
    document.getElementById('cal-event-action-panel').style.display = '';
    document.getElementById('cal-event-editor').style.display = 'none';
    document.getElementById('cal-event-summary').textContent =
        ev.title + ' · ' + getEventDateLabel(ev) + ' · ' + getEventTimeLabel(ev) +
        (getMemberText(ev) ? ' · 참여자: ' + getMemberText(ev) : '');
}

function openEventEditorModal(mode, ev) {
    calModalState.mode = mode;
    calModalState.eventId = ev.id;

    document.getElementById('cal-event-modal-title').textContent = mode === 'copy' ? '일정 복사' : '일정 수정';
    document.getElementById('cal-event-action-panel').style.display = 'none';
    document.getElementById('cal-event-editor').style.display = '';

    document.getElementById('cal-modal-title-input').value = ev.title;
    document.getElementById('cal-modal-start-input').value = ev.startDate;
    document.getElementById('cal-modal-end-input').value = ev.endDate;
    syncModalEndDateMin();
    document.getElementById('cal-modal-type-input').value = ev.type;
    document.getElementById('cal-modal-time-input').value = ev.time || '';
    document.getElementById('cal-modal-all-day-input').checked = !!ev.isAllDay;
    renderModalMemberOptions(ev.member);
    setModalMemberChecks(ev.member);

    syncModalMembersEnabled();
    syncModalTimeEnabled();
    showCalendarEventModal();
}

function syncModalMembersEnabled() {
    var type = document.getElementById('cal-modal-type-input').value;
    var membersWrap = document.getElementById('cal-modal-members-wrap');
    var checks = document.querySelectorAll('.cal-modal-member-check');
    var isPersonal = type === 'personal';
    membersWrap.disabled = !isPersonal;
    checks.forEach(function(chk) {
        chk.disabled = !isPersonal;
        if (!isPersonal) chk.checked = false;
    });
}

function syncModalTimeEnabled() {
    var allDay = document.getElementById('cal-modal-all-day-input').checked;
    var timeInput = document.getElementById('cal-modal-time-input');
    timeInput.disabled = allDay;
    if (allDay) timeInput.value = '';
}

function syncModalEndDateMin() {
    var startInput = document.getElementById('cal-modal-start-input');
    var endInput = document.getElementById('cal-modal-end-input');
    if (!startInput || !endInput) return;
    var start = normalizeDateString(startInput.value);
    if (!start) return;
    endInput.min = start;
    if (!endInput.value || compareDateStr(endInput.value, start) < 0) {
        endInput.value = start;
    }
}

function handleCalendarEventEditorSubmit(e) {
    e.preventDefault();

    var baseEvent = findEventById(calModalState.eventId);
    if (!baseEvent) return;

    var title = document.getElementById('cal-modal-title-input').value.trim();
    var startDate = normalizeDateString(document.getElementById('cal-modal-start-input').value);
    var endDate = normalizeDateString(document.getElementById('cal-modal-end-input').value);
    var type = document.getElementById('cal-modal-type-input').value;
    var isAllDay = document.getElementById('cal-modal-all-day-input').checked;
    var time = document.getElementById('cal-modal-time-input').value;
    var members = getModalCheckedMembers();

    if (!title || !startDate || !endDate) { alert('제목/시작일/종료일을 입력해주세요.'); return; }
    if (compareDateStr(endDate, startDate) < 0) { alert('종료일은 시작일보다 빠를 수 없습니다.'); return; }

    var newEvent = {
        id: calModalState.mode === 'copy' ? createEventId() : baseEvent.id,
        title: title,
        startDate: startDate,
        endDate: endDate,
        isAllDay: isAllDay,
        time: isAllDay ? '' : (time || ''),
        member: type === 'personal' ? (members.length > 0 ? members : '') : '',
        type: type,
        duration: baseEvent.duration || 60
    };

    var compareEvents = calState.events.filter(function(ev) {
        return ev.id !== baseEvent.id || calModalState.mode === 'copy';
    });
    var conflicts = detectConflictsWithEvent(newEvent, compareEvents);
    if (conflicts.length > 0) {
        if (!confirm('겹치는 일정이 있습니다.\n' + conflicts[0].title + ' ↔ ' + conflicts[0].with + '\n이대로 저장할까요?')) return;
    }

    if (calModalState.mode === 'copy') {
        calState.events.push(newEvent);
    } else {
        var idx = findEventIndexById(baseEvent.id);
        if (idx >= 0) calState.events[idx] = newEvent;
    }

    saveCalendarEvents();
    refreshCalendarCurrentView();
    hideCalendarEventModal();
}

function setModalMemberChecks(memberValue) {
    var selected = [];
    if (Array.isArray(memberValue)) selected = memberValue.slice();
    else if (typeof memberValue === 'string' && memberValue) selected = [memberValue];

    var checks = document.querySelectorAll('.cal-modal-member-check');
    checks.forEach(function(chk) {
        chk.checked = selected.indexOf(chk.value) >= 0;
    });
}

function getModalCheckedMembers() {
    var checks = document.querySelectorAll('.cal-modal-member-check');
    var members = [];
    checks.forEach(function(chk) {
        if (chk.checked) members.push(chk.value);
    });
    return members;
}

function syncInputEndDateMin() {
    var startInput = document.getElementById('cal-date-start');
    var endInput = document.getElementById('cal-date-end');
    var start = normalizeDateString(startInput.value);
    if (!start) return;
    endInput.min = start;
    if (!endInput.value || compareDateStr(endInput.value, start) < 0) {
        endInput.value = start;
    }
}

function initInputMemberPicker() {
    var toggleBtn = document.getElementById('cal-member-toggle');
    var menu = document.getElementById('cal-member-menu');
    var picker = document.getElementById('cal-member-picker');
    if (!toggleBtn || !menu || !picker) return;

    if (!toggleBtn.dataset.bound) {
        toggleBtn.addEventListener('click', function() {
            if (toggleBtn.disabled) return;
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', function(e) {
            if (!picker.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
        toggleBtn.dataset.bound = '1';
    }

    updateInputMemberToggleText();
}

function renderInputMemberOptions() {
    var menu = document.getElementById('cal-member-menu');
    if (!menu) return;

    var selected = getInputCheckedMembers();
    var participants = getCurrentParticipants();
    if (!participants.length) {
        menu.innerHTML = '<div class="cal-empty">참여자 없음</div>';
        return;
    }

    menu.innerHTML = participants.map(function(name) {
        var checked = selected.indexOf(name) >= 0 ? ' checked' : '';
        return '<label><input type="checkbox" class="cal-input-member-check" value="' + escapeHtml(name) + '"' + checked + '>' + escapeHtml(name) + '</label>';
    }).join('');

    menu.querySelectorAll('.cal-input-member-check').forEach(function(chk) {
        chk.addEventListener('change', updateInputMemberToggleText);
    });
    updateInputMemberToggleText();
}

function renderModalMemberOptions(selectedMembers) {
    var list = document.getElementById('cal-modal-members-list');
    if (!list) return;

    var selected = [];
    if (Array.isArray(selectedMembers)) selected = selectedMembers.slice();
    else if (typeof selectedMembers === 'string' && selectedMembers) selected = [selectedMembers];

    var participants = getCurrentParticipants();
    list.innerHTML = participants.map(function(name) {
        var checked = selected.indexOf(name) >= 0 ? ' checked' : '';
        return '<label><input type="checkbox" class="cal-modal-member-check" value="' + escapeHtml(name) + '"' + checked + '>' + escapeHtml(name) + '</label>';
    }).join('');
}

function getInputCheckedMembers() {
    var members = [];
    document.querySelectorAll('.cal-input-member-check').forEach(function(chk) {
        if (chk.checked) members.push(chk.value);
    });
    return members;
}

function updateInputMemberToggleText() {
    var toggleBtn = document.getElementById('cal-member-toggle');
    if (!toggleBtn) return;
    var members = getInputCheckedMembers();
    if (members.length === 0) {
        toggleBtn.textContent = '참여자 선택';
    } else if (members.length === 1) {
        toggleBtn.textContent = members[0];
    } else {
        toggleBtn.textContent = members[0] + ' 외 ' + (members.length - 1) + '명';
    }
}

function renderUserContext() {
    var user = getCurrentUser();
    if (!user) return;

    var participants = sanitizeParticipants(user.participants);
    currentUserState.participants = participants;
    var greeting = document.getElementById('greeting');
    if (greeting) {
        greeting.textContent = user.id + ' 계정 · 참여자: ' + participants.join(', ');
    }
}

function parseParticipantsByLines(text) {
    if (!text) return [];
    return sanitizeParticipants(String(text).split(/\r?\n/));
}

function initAccountModals() {
    var signupModal = document.getElementById('signup-modal');
    var accountEditModal = document.getElementById('account-edit-modal');
    if (!signupModal || !accountEditModal) return;

    document.getElementById('signup-close-btn').addEventListener('click', closeSignupModal);
    document.getElementById('signup-cancel-btn').addEventListener('click', closeSignupModal);
    document.getElementById('signup-submit-btn').addEventListener('click', handleSignupSubmit);
    document.getElementById('account-edit-close-btn').addEventListener('click', closeAccountEditModal);
    document.getElementById('account-edit-cancel-btn').addEventListener('click', closeAccountEditModal);
    document.getElementById('account-edit-save-btn').addEventListener('click', handleAccountEditSave);

    document.querySelectorAll('.account-modal-backdrop').forEach(function(backdrop) {
        backdrop.addEventListener('click', function() {
            var key = backdrop.getAttribute('data-close');
            if (key === 'signup') closeSignupModal();
            if (key === 'account-edit') closeAccountEditModal();
        });
    });
}

function openSignupModal() {
    document.getElementById('signup-id').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('signup-password-confirm').value = '';
    document.getElementById('signup-participants').value = '';
    document.getElementById('signup-modal').style.display = 'block';
}

function closeSignupModal() {
    document.getElementById('signup-modal').style.display = 'none';
}

function handleSignupSubmit() {
    var id = document.getElementById('signup-id').value.trim();
    var password = document.getElementById('signup-password').value;
    var confirmPassword = document.getElementById('signup-password-confirm').value;
    var participants = parseParticipantsByLines(document.getElementById('signup-participants').value);

    if (!id || !password || !confirmPassword) {
        alert('ID, Password, Password 확인을 모두 입력해주세요.');
        return;
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(id)) {
        alert('ID는 3~20자의 영문/숫자/언더스코어/하이픈만 사용할 수 있습니다.');
        return;
    }
    if (password !== confirmPassword) {
        alert('비밀번호 확인이 일치하지 않습니다.');
        return;
    }
    if (password.length < 4) {
        alert('비밀번호는 4자 이상 입력해주세요.');
        return;
    }
    if (!participants.length) {
        alert('참여자를 한 명 이상 입력해주세요.');
        return;
    }

    var users = getUsers();
    if (users.some(function(user) { return user.id === id; })) {
        alert('이미 사용 중인 ID입니다. 다른 ID를 입력해주세요.');
        return;
    }

    users.push(normalizeUserRecord({
        id: id,
        hash: CryptoJS.MD5(password).toString(),
        participants: participants,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));
    saveUsers(users);
    closeSignupModal();
    alert('계정이 추가되었습니다. 새 계정으로 로그인해주세요.');
}

function openAccountEditModal() {
    var user = getCurrentUser();
    if (!user) return;

    document.getElementById('account-edit-password').value = '';
    document.getElementById('account-edit-password-confirm').value = '';
    document.getElementById('account-edit-participants').value = sanitizeParticipants(user.participants).join('\n');
    document.getElementById('account-edit-modal').style.display = 'block';
}

function closeAccountEditModal() {
    document.getElementById('account-edit-modal').style.display = 'none';
}

function handleAccountEditSave() {
    var userId = getCurrentUserId();
    if (!userId) return;

    var password = document.getElementById('account-edit-password').value;
    var confirmPassword = document.getElementById('account-edit-password-confirm').value;
    var participants = parseParticipantsByLines(document.getElementById('account-edit-participants').value);
    if (!participants.length) {
        alert('참여자를 한 명 이상 입력해주세요.');
        return;
    }
    if (password || confirmPassword) {
        if (password !== confirmPassword) {
            alert('새 비밀번호 확인이 일치하지 않습니다.');
            return;
        }
        if (password.length < 4) {
            alert('비밀번호는 4자 이상 입력해주세요.');
            return;
        }
    }

    var users = getUsers();
    var idx = users.findIndex(function(user) { return user.id === userId; });
    if (idx < 0) {
        alert('계정 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
        return;
    }

    users[idx].participants = participants;
    users[idx].updatedAt = new Date().toISOString();
    if (password) {
        users[idx].hash = CryptoJS.MD5(password).toString();
    }
    users[idx] = normalizeUserRecord(users[idx]);
    saveUsers(users);

    applyCurrentUser(users[idx]);
    renderUserContext();
    renderInputMemberOptions();
    renderModalMemberOptions(getModalCheckedMembers());
    syncMemberByType();
    refreshCalendarCurrentView();
    closeAccountEditModal();
    alert('계정 정보가 저장되었습니다.');
}