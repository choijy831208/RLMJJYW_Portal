// 간단한 비밀번호 해시 (실제로는 더 강력한 해시 사용 권장)

// 기본 사용자 초기화
const defaultUsers = [{ id: 'JJYW', hash: CryptoJS.MD5('wlsduddl*70').toString() }];
if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify(defaultUsers));
}

document.getElementById('login-btn').addEventListener('click', function() {
    const enteredId = document.getElementById('username').value;
    const enteredPassword = document.getElementById('password').value;
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === enteredId);
    
    if (user && CryptoJS.MD5(enteredPassword).toString() === user.hash) {
        document.getElementById('greeting').textContent = `환영합니다, ${enteredId}! AI 어시스턴트가 준비되었습니다.`;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadData();
    } else {
        document.getElementById('error-msg').textContent = '잘못된 ID 또는 비밀번호입니다.';
    }
});

document.getElementById('logout-btn').addEventListener('click', function() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('password').value = '';
    document.getElementById('username').value = '';
    document.getElementById('error-msg').textContent = '';
});

document.getElementById('save-notes').addEventListener('click', function() {
    const notes = document.getElementById('notes').value;
    localStorage.setItem('notes', notes);
    alert('노트가 저장되었습니다.');
});

document.getElementById('add-link').addEventListener('click', function() {
    const link = document.getElementById('link-input').value;
    if (link) {
        let links = JSON.parse(localStorage.getItem('links') || '[]');
        links.push(link);
        localStorage.setItem('links', JSON.stringify(links));
        document.getElementById('link-input').value = '';
        loadLinks();
    }
});

function loadData() {
    const notes = localStorage.getItem('notes');
    if (notes) {
        document.getElementById('notes').value = notes;
    }
    loadLinks();
}

function loadLinks() {
    const links = JSON.parse(localStorage.getItem('links') || '[]');
    const list = document.getElementById('links-list');
    list.innerHTML = '';
    links.forEach(link => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${link}" target="_blank">${link}</a>`;
        list.appendChild(li);
    });
}