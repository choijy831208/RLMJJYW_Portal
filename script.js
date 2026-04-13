const defaultUsers = [{ id: 'JJYW', hash: CryptoJS.MD5('wlsduddl*70').toString() }];
if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify(defaultUsers));
}

document.addEventListener('DOMContentLoaded', function() {
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (darkModeBtn) {
        darkModeBtn.addEventListener('click', function() {
            document.body.classList.toggle('dark');
        });
    }

    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('save-notes').addEventListener('click', saveNotes);
    document.getElementById('save-assets').addEventListener('click', saveAssets);
});

function handleLogin() {
    const enteredId = document.getElementById('username').value.trim();
    const enteredPassword = document.getElementById('password').value;
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(function(u) { return u.id === enteredId; });

    if (user && CryptoJS.MD5(enteredPassword).toString() === user.hash) {
        document.getElementById('greeting').textContent = '환영합니다, ' + enteredId + '님. 오늘도 함께 정리해볼까요?';
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('browser-window').style.display = 'block';
        loadDashboardData();
        return;
    }

    document.getElementById('error-msg').textContent = '잘못된 ID 또는 비밀번호입니다.';
}

function handleLogout() {
    document.getElementById('browser-window').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('password').value = '';
    document.getElementById('username').value = '';
    document.getElementById('error-msg').textContent = '';
}

function saveNotes() {
    const notes = document.getElementById('notes').value;
    localStorage.setItem('notes', notes);
}

function loadNotes() {
    document.getElementById('notes').value = localStorage.getItem('notes') || '';
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
    localStorage.setItem('assetSummary', JSON.stringify(payload));
    renderAssets(payload);
}

function loadAssets() {
    const stored = JSON.parse(localStorage.getItem('assetSummary') || '{"total":0,"loan":0}');
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
    loadNotes();
    loadNews();
    loadAssets();
    initCalendar();
}

// ===== 달력 위젯 =====
var calState = {
    view: 'calendar',
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    events: []
};

function initCalendar() {
    calState.events = JSON.parse(localStorage.getItem('calEvents') || '[]');
    calState.year = new Date().getFullYear();
    calState.month = new Date().getMonth();

    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('cal-date').value = yyyy + '-' + mm + '-' + dd;

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
    document.getElementById('cal-add-btn').addEventListener('click', addCalEvent);
    document.getElementById('cal-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addCalEvent();
    });

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
                var dayEvents = calState.events.filter(function(e) { return e.date === dateStr; });
                var hasConflict = detectConflicts(dayEvents).length > 0;

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

                dayEvents.slice(0, 2).forEach(function(ev) {
                    var evEl = document.createElement('div');
                    evEl.className = 'cal-ev ' + (ev.type === 'family' ? 'cal-ev-family' : 'cal-ev-personal');
                    evEl.textContent = (ev.type === 'family' ? '[가족] ' : '[개인] ') + ev.title;
                    evEl.title = ev.title + (ev.member ? ' · ' + ev.member : '') + (ev.time ? ' ' + ev.time : '');
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

    var todayEvs = calState.events.filter(function(e) { return e.date === todayStr; });
    var tomorrowEvs = calState.events.filter(function(e) { return e.date === tomorrowStr; });
    var weekEvs = calState.events.filter(function(e) { return e.date > todayStr && e.date <= weekEndStr && e.type === 'family'; });

    var conflicts = [];
    var seenDates = {};
    calState.events.forEach(function(ev) {
        if (seenDates[ev.date]) return;
        seenDates[ev.date] = true;
        var dayEvs = calState.events.filter(function(e) { return e.date === ev.date; });
        detectConflicts(dayEvs).forEach(function(c) { conflicts.push(c); });
    });

    var actions = generateActions(todayEvs, tomorrowEvs, weekEvs);

    function evLine(ev) {
        return '<li>' + ev.date + ' ' + (ev.time || '--:--') +
            (ev.member ? ' [' + ev.member + ']' : '') +
            ' ' + (ev.type === 'family' ? '[가족]' : '[개인]') +
            ' ' + ev.title + '</li>';
    }

    var html = '';
    html += '<div class="cal-list-section"><div class="cal-list-title">오늘 일정</div><ul>' + (todayEvs.length ? todayEvs.map(evLine).join('') : '<li class="cal-empty">일정 없음</li>') + '</ul></div>';
    html += '<div class="cal-list-section"><div class="cal-list-title">내일 일정</div><ul>' + (tomorrowEvs.length ? tomorrowEvs.map(evLine).join('') : '<li class="cal-empty">일정 없음</li>') + '</ul></div>';
    html += '<div class="cal-list-section"><div class="cal-list-title">이번 주 가족 행사</div><ul>' + (weekEvs.length ? weekEvs.map(evLine).join('') : '<li class="cal-empty">행사 없음</li>') + '</ul></div>';
    html += '<div class="cal-list-section cal-conflict"><div class="cal-list-title">⚠ 충돌/확인 필요</div><ul>' + (conflicts.length ? conflicts.map(function(c) { return '<li>' + c.date + ' ' + c.title + ' ↔ ' + c.with + '</li>'; }).join('') : '<li class="cal-empty">없음</li>') + '</ul></div>';
    html += '<div class="cal-list-section cal-actions"><div class="cal-list-title">추천 액션</div><ul>' + actions.map(function(a) { return '<li>' + a + '</li>'; }).join('') + '</ul></div>';

    document.getElementById('cal-list-body').innerHTML = html;
}

function renderCalSummary() {
    var y = calState.year, m = calState.month;
    var monthStr = y + '-' + String(m + 1).padStart(2, '0');
    var monthEvs = calState.events.filter(function(e) { return e.date.startsWith(monthStr); });
    var familyCount = monthEvs.filter(function(e) { return e.type === 'family'; }).length;
    var personalCount = monthEvs.filter(function(e) { return e.type === 'personal'; }).length;
    var conflictCount = 0;
    var seenDates = {};
    monthEvs.forEach(function(ev) {
        if (seenDates[ev.date]) return;
        seenDates[ev.date] = true;
        conflictCount += detectConflicts(monthEvs.filter(function(e) { return e.date === ev.date; })).length;
    });
    var lines = [];
    if (familyCount > 0) lines.push('가족 행사 ' + familyCount + '건');
    if (personalCount > 0) lines.push('개인 일정 ' + personalCount + '건');
    if (conflictCount > 0) lines.push('⚠ 충돌 ' + conflictCount + '건');
    if (lines.length === 0) lines.push('이번 달 등록된 일정이 없습니다.');
    document.getElementById('cal-summary').textContent = lines.slice(0, 3).join(' · ');
}

function detectConflicts(dayEvents) {
    var conflicts = [];
    for (var i = 0; i < dayEvents.length; i++) {
        for (var j = i + 1; j < dayEvents.length; j++) {
            var a = dayEvents[i], b = dayEvents[j];
            if (!a.time || !b.time) continue;
            var aS = timeToMin(a.time), bS = timeToMin(b.time);
            var aE = aS + (a.duration || 60), bE = bS + (b.duration || 60);
            if ((a.member === b.member || a.type === 'family' || b.type === 'family') && aS < bE && bS < aE) {
                conflicts.push({ date: a.date, title: a.title, with: b.title });
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
    var unassigned = calState.events.filter(function(e) { return e.date >= fmtDate(new Date()) && !e.member; });
    if (unassigned.length > 0) actions.push('참여자 미지정 일정 ' + unassigned.length + '건 확인 필요');
    if (actions.length === 0) actions.push('오늘 새 일정을 추가해보세요.');
    return actions.slice(0, 3);
}

function addCalEvent() {
    var title = document.getElementById('cal-input').value.trim();
    var date = document.getElementById('cal-date').value;
    var time = document.getElementById('cal-time-start').value;
    var member = document.getElementById('cal-member').value;
    var type = document.getElementById('cal-type').value;

    if (!title || !date) { alert('제목과 날짜를 입력해주세요.'); return; }

    var newEvent = { title: title, date: date, time: time, member: member, type: type, duration: 60 };
    var dayEvs = calState.events.filter(function(e) { return e.date === date; }).concat([newEvent]);
    var conflicts = detectConflicts(dayEvs);
    if (conflicts.length > 0) {
        if (!confirm('⚠ 일정 충돌 가능성\n' + conflicts[0].title + ' ↔ ' + conflicts[0].with + '\n그래도 추가하시겠어요?')) return;
    }

    calState.events.push(newEvent);
    localStorage.setItem('calEvents', JSON.stringify(calState.events));
    document.getElementById('cal-input').value = '';

    if (calState.view === 'calendar') renderCalendarView();
    else renderListView();
}

function fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}