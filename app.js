(function () {
  "use strict";

  const STORE = {
    auth: "teamstudy.family.auth",
    profile: "teamstudy.family.profile",
    session: "teamstudy.family.session",
    schedule: "teamstudy.family.schedule",
    assets: "teamstudy.family.assets",
    news: "teamstudy.family.news",
    tasks: "teamstudy.family.tasks",
    agents: "teamstudy.family.agents"
  };

  const VIEW_TITLES = {
    main: "메인 포털",
    schedule: "스케줄 포털",
    assets: "자산 포트폴리오 포털",
    news: "뉴스 포털",
    tasks: "가족 할일 포털",
    agents: "에이전트 회의",
    settings: "설정"
  };

  const state = {
    view: "main",
    auth: null,
    profile: null,
    session: null,
    schedule: [],
    assets: [],
    news: [],
    tasks: [],
    agentLog: []
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindEvents();
    updateTodayLabel();
    state.auth = readJson(STORE.auth, null);
    state.session = readJson(STORE.session, null);

    if (sessionMatchesAuth(state.session, state.auth)) {
      loadState();
      ensureInitialAgentDecision();
      showPortal();
    } else {
      localStorage.removeItem(STORE.session);
      state.session = null;
      showLogin();
    }
  }

  function bindEvents() {
    $("#login-form").addEventListener("submit", handleLogin);
    $("#login-reset-button").addEventListener("click", resetData);
    $("#logout-button").addEventListener("click", handleLogout);
    $("#seed-demo-button").addEventListener("click", seedDemoData);
    $("#schedule-form").addEventListener("submit", handleScheduleSubmit);
    $("#asset-form").addEventListener("submit", handleAssetSubmit);
    $("#news-form").addEventListener("submit", handleNewsSubmit);
    $("#task-form").addEventListener("submit", handleTaskSubmit);
    $("#profile-form").addEventListener("submit", handleProfileSubmit);
    $("#run-agents-button").addEventListener("click", () => runAgentCouncil("manual"));
    $("#export-button").addEventListener("click", exportData);
    $("#import-button").addEventListener("click", importData);
    $("#reset-button").addEventListener("click", resetData);

    $("#schedule-filter").addEventListener("change", renderSchedule);
    $("#news-filter").addEventListener("change", renderNews);
    $("#task-filter").addEventListener("change", renderTasks);

    $$(".nav-button").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.view));
    });

    document.body.addEventListener("click", handleDelegatedClick);
  }

  function handleLogin(event) {
    event.preventDefault();

    const inputFamilyName = $("#family-name-input").value.trim();
    const inputMemberName = $("#member-name-input").value.trim();
    const role = $("#member-role-input").value;
    const code = normalizeFamilyCode($("#family-code-input").value);
    const password = $("#family-password-input").value;

    if (!code) {
      window.alert("가족 코드를 입력해주세요.");
      return;
    }

    if (password.length < 4) {
      window.alert("비밀번호는 4자 이상으로 입력해주세요.");
      return;
    }

    const passwordHash = hashPassword(code, password);
    const existingAuth = readJson(STORE.auth, null);
    const existingProfile = readJson(STORE.profile, null);
    let auth = existingAuth;
    const familyName = inputFamilyName || existingProfile?.familyName || code;
    const memberName = inputMemberName || existingAuth?.lastMemberName || existingProfile?.ownerName || "가족";

    if (!existingAuth) {
      auth = {
        version: 1,
        familyCode: code,
        passwordHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMemberName: memberName
      };
    } else if (existingAuth.familyCode !== code || existingAuth.passwordHash !== passwordHash) {
      window.alert("가족 코드 또는 비밀번호가 올바르지 않습니다.");
      return;
    } else {
      auth = {
        ...existingAuth,
        updatedAt: new Date().toISOString(),
        lastMemberName: memberName
      };
    }

    const profile = existingProfile || {
      familyName,
      familyCode: code,
      ownerName: memberName,
      currency: "KRW",
      members: []
    };

    profile.familyName = familyName;
    profile.familyCode = code;
    profile.ownerName = profile.ownerName || memberName;
    profile.currency = profile.currency || "KRW";
    profile.members = profile.members || [];

    if (!profile.members.some((member) => member.name === memberName)) {
      profile.members.push({
        id: createId("member"),
        name: memberName,
        role,
        joinedAt: new Date().toISOString()
      });
    }

    state.session = {
      familyCode: code,
      familyName: profile.familyName,
      memberName,
      role,
      loginAt: new Date().toISOString()
    };

    state.auth = auth;
    writeJson(STORE.auth, auth);
    writeJson(STORE.profile, profile);
    writeJson(STORE.session, state.session);
    $("#family-password-input").value = "";
    loadState();
    ensureInitialAgentDecision();
    showPortal();
  }

  function handleLogout() {
    localStorage.removeItem(STORE.session);
    state.session = null;
    showLogin();
  }

  function handleScheduleSubmit(event) {
    event.preventDefault();

    state.schedule.push({
      id: createId("schedule"),
      title: $("#schedule-title").value.trim(),
      date: $("#schedule-date").value,
      time: $("#schedule-time").value,
      owner: $("#schedule-owner").value.trim() || "전체",
      type: $("#schedule-type").value,
      createdAt: new Date().toISOString()
    });

    writeJson(STORE.schedule, state.schedule);
    event.currentTarget.reset();
    setDefaultDates();
    renderAll();
  }

  function handleAssetSubmit(event) {
    event.preventDefault();

    state.assets.push({
      id: createId("asset"),
      type: $("#asset-type").value,
      name: $("#asset-name").value.trim(),
      category: $("#asset-category").value.trim(),
      amount: Math.max(0, Number($("#asset-amount").value || 0)),
      createdAt: new Date().toISOString()
    });

    writeJson(STORE.assets, state.assets);
    event.currentTarget.reset();
    renderAll();
  }

  function handleNewsSubmit(event) {
    event.preventDefault();

    state.news.push({
      id: createId("news"),
      title: $("#news-title").value.trim(),
      source: $("#news-source").value.trim() || "직접 기록",
      category: $("#news-category").value,
      link: normalizeUrl($("#news-link").value),
      summary: $("#news-summary").value.trim(),
      createdAt: new Date().toISOString()
    });

    writeJson(STORE.news, state.news);
    event.currentTarget.reset();
    renderAll();
  }

  function handleTaskSubmit(event) {
    event.preventDefault();

    state.tasks.push({
      id: createId("task"),
      title: $("#task-title").value.trim(),
      owner: $("#task-owner").value.trim() || "전체",
      due: $("#task-due").value,
      priority: $("#task-priority").value,
      done: false,
      createdAt: new Date().toISOString()
    });

    writeJson(STORE.tasks, state.tasks);
    event.currentTarget.reset();
    setDefaultDates();
    renderAll();
  }

  function handleProfileSubmit(event) {
    event.preventDefault();

    state.profile.familyName = $("#profile-family-name").value.trim();
    state.profile.ownerName = $("#profile-owner-name").value.trim();
    state.profile.currency = $("#profile-currency").value;
    state.profile.familyCode = state.auth?.familyCode || state.profile.familyCode;

    const newPassword = $("#profile-new-password").value;
    if (newPassword) {
      if (newPassword.length < 4) {
        window.alert("새 비밀번호는 4자 이상으로 입력해주세요.");
        return;
      }

      state.auth = {
        ...(state.auth || {}),
        version: 1,
        familyCode: state.profile.familyCode,
        passwordHash: hashPassword(state.profile.familyCode, newPassword),
        updatedAt: new Date().toISOString()
      };
      writeJson(STORE.auth, state.auth);
      $("#profile-new-password").value = "";
    }

    writeJson(STORE.profile, state.profile);
    if (state.session) {
      state.session.familyName = state.profile.familyName;
      state.session.familyCode = state.profile.familyCode;
      writeJson(STORE.session, state.session);
    }
    renderAll();
  }

  function handleDelegatedClick(event) {
    const jump = event.target.closest("[data-jump]");
    if (jump) {
      setView(jump.dataset.jump);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const id = actionButton.dataset.id;
    const action = actionButton.dataset.action;

    if (action === "delete-schedule") {
      state.schedule = state.schedule.filter((item) => item.id !== id);
      writeJson(STORE.schedule, state.schedule);
    }

    if (action === "delete-asset") {
      state.assets = state.assets.filter((item) => item.id !== id);
      writeJson(STORE.assets, state.assets);
    }

    if (action === "delete-news") {
      state.news = state.news.filter((item) => item.id !== id);
      writeJson(STORE.news, state.news);
    }

    if (action === "toggle-task") {
      state.tasks = state.tasks.map((item) => {
        if (item.id !== id) {
          return item;
        }
        return {
          ...item,
          done: !item.done,
          completedAt: item.done ? null : new Date().toISOString()
        };
      });
      writeJson(STORE.tasks, state.tasks);
    }

    if (action === "delete-task") {
      state.tasks = state.tasks.filter((item) => item.id !== id);
      writeJson(STORE.tasks, state.tasks);
    }

    renderAll();
  }

  function showLogin() {
    $("#login-view").classList.remove("hidden");
    $("#portal-view").classList.add("hidden");
    prefillLogin();
  }

  function prefillLogin() {
    const auth = readJson(STORE.auth, null);
    const profile = readJson(STORE.profile, null);

    $("#family-code-input").value = auth?.familyCode || profile?.familyCode || "";
    $("#family-password-input").value = "";
    $("#family-name-input").value = profile?.familyName || "";
    $("#member-name-input").value = auth?.lastMemberName || profile?.ownerName || "";
  }

  function showPortal() {
    $("#login-view").classList.add("hidden");
    $("#portal-view").classList.remove("hidden");
    setDefaultDates();
    setView(state.view || "main");
    renderAll();
  }

  function setView(view) {
    state.view = view;
    $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
    $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $("#view-title").textContent = VIEW_TITLES[view] || "메인 포털";
  }

  function loadState() {
    state.auth = readJson(STORE.auth, null);
    const fallbackProfile = {
      familyName: state.session?.familyName || "우리집",
      familyCode: state.session?.familyCode || state.auth?.familyCode || "",
      ownerName: state.session?.memberName || "가족",
      currency: "KRW",
      members: []
    };

    state.profile = readJson(STORE.profile, fallbackProfile);
    state.schedule = readJson(STORE.schedule, []);
    state.assets = readJson(STORE.assets, []);
    state.news = readJson(STORE.news, []);
    state.tasks = readJson(STORE.tasks, []);
    state.agentLog = readJson(STORE.agents, []);
  }

  function renderAll() {
    renderProfile();
    renderDashboard();
    renderSchedule();
    renderAssets();
    renderNews();
    renderTasks();
    renderAgents();
  }

  function renderProfile() {
    const profile = state.profile || {};
    const session = state.session || {};
    const familyName = profile.familyName || session.familyName || "우리집";
    const memberName = session.memberName || profile.ownerName || "가족";
    const familyCode = state.auth?.familyCode || profile.familyCode || session.familyCode || "";

    $("#sidebar-family").textContent = familyName;
    $("#sidebar-member").textContent = memberName;
    $("#dashboard-family").textContent = familyName;
    $("#profile-family-code").value = familyCode;
    $("#profile-family-name").value = familyName;
    $("#profile-owner-name").value = profile.ownerName || memberName;
    $("#profile-currency").value = profile.currency || "KRW";
    $("#storage-status").textContent = `${getStorageCount()}개 항목 저장 중`;
  }

  function renderDashboard() {
    const facts = getFacts();
    $("#metric-grid").innerHTML = [
      metricTemplate("오늘 일정", facts.todayEvents, "오늘 날짜와 일치하는 일정"),
      metricTemplate("순자산", formatCurrency(facts.netWorth), "자산에서 부채를 제외한 금액"),
      metricTemplate("뉴스", facts.newsCount, "저장된 뉴스 클립"),
      metricTemplate("진행 할일", facts.openTasks, "아직 완료되지 않은 가족 할일")
    ].join("");

    const upcoming = getUpcomingSchedules().slice(0, 4);
    $("#dashboard-schedules").innerHTML = upcoming.length
      ? upcoming.map((item) => compactScheduleTemplate(item)).join("")
      : emptyTemplate("다가오는 일정이 없습니다.");

    $("#dashboard-assets").innerHTML = [
      financeLineTemplate("총 자산", facts.assetTotal),
      financeLineTemplate("총 부채", facts.liabilityTotal),
      financeLineTemplate("순자산", facts.netWorth)
    ].join("");

    const recentNews = [...state.news]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);
    $("#dashboard-news").innerHTML = recentNews.length
      ? recentNews.map((item) => compactNewsTemplate(item)).join("")
      : emptyTemplate("저장된 뉴스가 없습니다.");

    const openTasks = state.tasks
      .filter((item) => !item.done)
      .sort(compareTasks)
      .slice(0, 4);
    $("#dashboard-tasks").innerHTML = openTasks.length
      ? openTasks.map((item) => compactTaskTemplate(item)).join("")
      : emptyTemplate("진행 중인 할일이 없습니다.");
  }

  function renderSchedule() {
    const filter = $("#schedule-filter").value;
    const today = todayKey();
    let items = [...state.schedule];

    if (filter === "future") {
      items = items.filter((item) => item.date >= today);
    }

    if (filter === "today") {
      items = items.filter((item) => item.date === today);
    }

    items.sort(compareSchedules);

    $("#schedule-list").innerHTML = items.length
      ? items.map((item) => scheduleItemTemplate(item)).join("")
      : emptyTemplate("표시할 일정이 없습니다.");
  }

  function renderAssets() {
    const facts = getFacts();
    $("#asset-summary").innerHTML = [
      assetSummaryBoxTemplate("총 자산", facts.assetTotal),
      assetSummaryBoxTemplate("총 부채", facts.liabilityTotal),
      assetSummaryBoxTemplate("순자산", facts.netWorth)
    ].join("");

    $("#allocation-bars").innerHTML = renderAllocationBars();

    const items = [...state.assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    $("#asset-list").innerHTML = items.length
      ? items.map((item) => assetItemTemplate(item)).join("")
      : emptyTemplate("등록된 자산 항목이 없습니다.");
  }

  function renderNews() {
    const filter = $("#news-filter").value;
    let items = [...state.news];

    if (filter !== "all") {
      items = items.filter((item) => item.category === filter);
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    $("#news-list").innerHTML = items.length
      ? items.map((item) => newsItemTemplate(item)).join("")
      : emptyTemplate("표시할 뉴스가 없습니다.");
  }

  function renderTasks() {
    const filter = $("#task-filter").value;
    let items = [...state.tasks];

    if (filter === "open") {
      items = items.filter((item) => !item.done);
    }

    if (filter === "done") {
      items = items.filter((item) => item.done);
    }

    items.sort(compareTasks);

    $("#task-list").innerHTML = items.length
      ? items.map((item) => taskItemTemplate(item)).join("")
      : emptyTemplate("표시할 할일이 없습니다.");
  }

  function renderAgents() {
    const latest = state.agentLog[0];

    if (latest) {
      $("#planning-agent-copy").textContent = latest.discussion.planning;
      $("#development-agent-copy").textContent = latest.discussion.development;
      $("#verification-agent-copy").textContent = latest.discussion.verification;
    } else {
      $("#planning-agent-copy").textContent = "기본 포털 구성을 기준으로 가족 할일 포털을 추가 후보로 유지합니다.";
      $("#development-agent-copy").textContent = "HTML, CSS, JavaScript와 localStorage만으로 실행됩니다.";
      $("#verification-agent-copy").textContent = "로그인 후 입력 데이터가 브라우저 저장소에 남는지 확인합니다.";
    }

    $("#agent-log").innerHTML = state.agentLog.length
      ? state.agentLog.map((log) => agentLogTemplate(log)).join("")
      : emptyTemplate("회의 기록이 없습니다.");
  }

  function runAgentCouncil(trigger) {
    const facts = getFacts();
    const missing = [];

    if (!state.schedule.length) {
      missing.push("스케줄");
    }
    if (!state.assets.length) {
      missing.push("자산");
    }
    if (!state.news.length) {
      missing.push("뉴스");
    }
    if (!state.tasks.length) {
      missing.push("가족 할일");
    }

    const discussion = {
      planning: `기본 4개 포털은 유지하고, 가족 운영 공백을 줄이기 위해 가족 할일 포털을 추가 포털로 둡니다. 현재 우선 보강 영역은 ${missing.length ? missing.join(", ") : "없음"}입니다.`,
      development: `가족 코드와 비밀번호 해시는 localStorage 인증 키에 저장하고, 포털 데이터는 ${Object.keys(STORE).length}개 키로 분리합니다. 현재 저장 항목은 ${getStorageCount()}개이며 화면 갱신은 단일 렌더 루프로 처리합니다.`,
      verification: missing.length
        ? `검증 결과 ${missing.length}개 영역에 입력 데이터가 부족합니다. 샘플 또는 실제 데이터를 추가한 뒤 다시 회의를 실행하세요.`
        : "검증 결과 핵심 포털에 데이터가 있으며, 메인 포털 집계와 개별 포털 목록이 함께 갱신됩니다."
    };

    const decision = missing.includes("가족 할일")
      ? "가족 할일 포털을 활성 상태로 유지하고 첫 할일 등록을 권장합니다."
      : "가족 할일 포털은 추가 포털로 확정하고, 다음 후보는 가족 문서 보관함입니다.";

    const log = {
      id: createId("agent"),
      trigger,
      at: new Date().toISOString(),
      discussion,
      decision,
      snapshot: facts
    };

    state.agentLog = [log, ...state.agentLog].slice(0, 24);
    writeJson(STORE.agents, state.agentLog);
    renderAll();
  }

  function ensureInitialAgentDecision() {
    if (!state.agentLog.length) {
      runAgentCouncil("initial");
    }
  }

  function seedDemoData() {
    const shouldAdd = window.confirm("현재 데이터를 유지하고 샘플 데이터를 추가할까요?");
    if (!shouldAdd) {
      return;
    }

    const today = todayKey();
    const tomorrow = addDaysKey(1);
    const nextWeek = addDaysKey(7);

    state.schedule.push(
      {
        id: createId("schedule"),
        title: "가족 저녁 식사",
        date: today,
        time: "19:00",
        owner: "전체",
        type: "가족",
        createdAt: new Date().toISOString()
      },
      {
        id: createId("schedule"),
        title: "건강검진 예약",
        date: tomorrow,
        time: "10:30",
        owner: "부모",
        type: "건강",
        createdAt: new Date().toISOString()
      }
    );

    state.assets.push(
      {
        id: createId("asset"),
        type: "asset",
        name: "생활비 통장",
        category: "현금",
        amount: 3200000,
        createdAt: new Date().toISOString()
      },
      {
        id: createId("asset"),
        type: "asset",
        name: "장기 투자",
        category: "투자",
        amount: 12500000,
        createdAt: new Date().toISOString()
      },
      {
        id: createId("asset"),
        type: "liability",
        name: "신용카드 예정금",
        category: "카드",
        amount: 850000,
        createdAt: new Date().toISOString()
      }
    );

    state.news.push(
      {
        id: createId("news"),
        title: "지역 도서관 주말 프로그램",
        source: "지역 소식",
        category: "교육",
        link: "",
        summary: "다음 달 가족 참여 프로그램 신청이 시작됩니다.",
        createdAt: new Date().toISOString()
      },
      {
        id: createId("news"),
        title: "금리 인하 가능성 점검",
        source: "경제 메모",
        category: "경제",
        link: "",
        summary: "대출 상환 계획과 예금 만기 일정을 함께 검토합니다.",
        createdAt: new Date().toISOString()
      }
    );

    state.tasks.push(
      {
        id: createId("task"),
        title: "이번 주 장보기 목록 정리",
        owner: "전체",
        due: tomorrow,
        priority: "보통",
        done: false,
        createdAt: new Date().toISOString()
      },
      {
        id: createId("task"),
        title: "보험 증권 파일 확인",
        owner: "부모",
        due: nextWeek,
        priority: "높음",
        done: false,
        createdAt: new Date().toISOString()
      }
    );

    writeJson(STORE.schedule, state.schedule);
    writeJson(STORE.assets, state.assets);
    writeJson(STORE.news, state.news);
    writeJson(STORE.tasks, state.tasks);
    runAgentCouncil("sample-data");
    setView("main");
  }

  function exportData() {
    $("#data-port").value = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        auth: state.auth,
        profile: state.profile,
        schedule: state.schedule,
        assets: state.assets,
        news: state.news,
        tasks: state.tasks,
        agentLog: state.agentLog
      },
      null,
      2
    );
  }

  function importData() {
    let payload;

    try {
      payload = JSON.parse($("#data-port").value);
    } catch (error) {
      window.alert("JSON 형식이 올바르지 않습니다.");
      return;
    }

    if (!payload || typeof payload !== "object") {
      window.alert("가져올 데이터가 없습니다.");
      return;
    }

    state.profile = payload.profile || state.profile;
    state.auth = payload.auth || state.auth;
    state.schedule = Array.isArray(payload.schedule) ? payload.schedule : [];
    state.assets = Array.isArray(payload.assets) ? payload.assets : [];
    state.news = Array.isArray(payload.news) ? payload.news : [];
    state.tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    state.agentLog = Array.isArray(payload.agentLog) ? payload.agentLog : [];

    if (state.auth?.familyCode) {
      state.profile.familyCode = state.auth.familyCode;
      if (state.session) {
        state.session.familyCode = state.auth.familyCode;
        state.session.familyName = state.profile.familyName;
        writeJson(STORE.session, state.session);
      }
      writeJson(STORE.auth, state.auth);
    }
    writeJson(STORE.profile, state.profile);
    writeJson(STORE.schedule, state.schedule);
    writeJson(STORE.assets, state.assets);
    writeJson(STORE.news, state.news);
    writeJson(STORE.tasks, state.tasks);
    writeJson(STORE.agents, state.agentLog);
    renderAll();
    window.alert("가져오기가 완료되었습니다.");
  }

  function resetData() {
    const ok = window.confirm("이 브라우저에 저장된 가족 포털 데이터를 모두 삭제할까요?");
    if (!ok) {
      return;
    }

    Object.values(STORE).forEach((key) => localStorage.removeItem(key));
    state.view = "main";
    state.auth = null;
    state.profile = null;
    state.session = null;
    state.schedule = [];
    state.assets = [];
    state.news = [];
    state.tasks = [];
    state.agentLog = [];
    showLogin();
  }

  function getFacts() {
    const today = todayKey();
    const assetTotal = state.assets
      .filter((item) => item.type === "asset")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const liabilityTotal = state.assets
      .filter((item) => item.type === "liability")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      todayEvents: state.schedule.filter((item) => item.date === today).length,
      scheduleCount: state.schedule.length,
      assetCount: state.assets.length,
      assetTotal,
      liabilityTotal,
      netWorth: assetTotal - liabilityTotal,
      newsCount: state.news.length,
      taskCount: state.tasks.length,
      openTasks: state.tasks.filter((item) => !item.done).length
    };
  }

  function getStorageCount() {
    return state.schedule.length + state.assets.length + state.news.length + state.tasks.length + state.agentLog.length;
  }

  function getUpcomingSchedules() {
    const today = todayKey();
    return state.schedule
      .filter((item) => item.date >= today)
      .sort(compareSchedules);
  }

  function renderAllocationBars() {
    const categoryTotals = new Map();
    const assetItems = state.assets.filter((item) => item.type === "asset");
    const total = assetItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const colors = ["#3d72a4", "#1e8f82", "#bb8428", "#7357a7", "#d7634f"];

    assetItems.forEach((item) => {
      const category = item.category || "기타";
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + Number(item.amount || 0));
    });

    if (!total) {
      return emptyTemplate("자산 배분 데이터가 없습니다.");
    }

    return Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount], index) => {
        const percent = Math.round((amount / total) * 100);
        const color = colors[index % colors.length];
        return `
          <div class="bar-row">
            <div class="bar-row-top">
              <span>${escapeHtml(category)}</span>
              <span>${formatCurrency(amount)} · ${percent}%</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width: ${percent}%; background: ${color}"></div></div>
          </div>
        `;
      })
      .join("");
  }

  function metricTemplate(label, value, caption) {
    return `
      <article class="metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(caption)}</span>
      </article>
    `;
  }

  function financeLineTemplate(label, value) {
    return `
      <div class="finance-line">
        <span>${escapeHtml(label)}</span>
        <strong>${formatCurrency(value)}</strong>
      </div>
    `;
  }

  function assetSummaryBoxTemplate(label, value) {
    return `
      <div class="asset-summary-box">
        <span>${escapeHtml(label)}</span>
        <strong>${formatCurrency(value)}</strong>
      </div>
    `;
  }

  function compactScheduleTemplate(item) {
    return `
      <div class="list-item">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <div class="item-meta">
            <span>${formatDate(item.date, item.time)}</span>
            <span>${escapeHtml(item.owner)}</span>
            <span>${escapeHtml(item.type)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function compactNewsTemplate(item) {
    return `
      <div class="list-item">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <div class="item-meta">
            <span>${escapeHtml(item.category)}</span>
            <span>${escapeHtml(item.source)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function compactTaskTemplate(item) {
    return `
      <div class="list-item">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <div class="item-meta">
            <span>${escapeHtml(item.owner)}</span>
            <span>${escapeHtml(item.priority)}</span>
            <span>${item.due ? formatDate(item.due) : "마감일 없음"}</span>
          </div>
        </div>
      </div>
    `;
  }

  function scheduleItemTemplate(item) {
    return `
      <article class="list-item">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <div class="item-meta">
            <span>${formatDate(item.date, item.time)}</span>
            <span>${escapeHtml(item.owner)}</span>
            <span>${escapeHtml(item.type)}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="small-action danger" type="button" title="삭제" aria-label="일정 삭제" data-action="delete-schedule" data-id="${escapeHtml(item.id)}">×</button>
        </div>
      </article>
    `;
  }

  function assetItemTemplate(item) {
    const typeLabel = item.type === "asset" ? "자산" : "부채";
    const tagClass = item.type === "asset" ? "asset" : "liability";

    return `
      <article class="list-item">
        <div>
          <h4>${escapeHtml(item.name)}</h4>
          <div class="item-meta">
            <span class="tag ${tagClass}">${typeLabel}</span>
            <span>${escapeHtml(item.category)}</span>
            <span>${formatCurrency(item.amount)}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="small-action danger" type="button" title="삭제" aria-label="자산 항목 삭제" data-action="delete-asset" data-id="${escapeHtml(item.id)}">×</button>
        </div>
      </article>
    `;
  }

  function newsItemTemplate(item) {
    const link = item.link
      ? `<a class="text-action" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">열기</a>`
      : "";

    return `
      <article class="list-item">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <div class="item-meta">
            <span>${escapeHtml(item.category)}</span>
            <span>${escapeHtml(item.source)}</span>
            <span>${formatDate(item.createdAt)}</span>
          </div>
          ${item.summary ? `<p class="item-summary">${escapeHtml(item.summary)}</p>` : ""}
        </div>
        <div class="item-actions">
          ${link}
          <button class="small-action danger" type="button" title="삭제" aria-label="뉴스 삭제" data-action="delete-news" data-id="${escapeHtml(item.id)}">×</button>
        </div>
      </article>
    `;
  }

  function taskItemTemplate(item) {
    return `
      <article class="list-item ${item.done ? "done" : ""}">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <div class="item-meta">
            <span>${escapeHtml(item.owner)}</span>
            <span>${escapeHtml(item.priority)}</span>
            <span>${item.due ? formatDate(item.due) : "마감일 없음"}</span>
            <span>${item.done ? "완료" : "진행 중"}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="small-action" type="button" title="상태 변경" aria-label="할일 상태 변경" data-action="toggle-task" data-id="${escapeHtml(item.id)}">${item.done ? "↺" : "✓"}</button>
          <button class="small-action danger" type="button" title="삭제" aria-label="할일 삭제" data-action="delete-task" data-id="${escapeHtml(item.id)}">×</button>
        </div>
      </article>
    `;
  }

  function agentLogTemplate(log) {
    return `
      <article class="list-item">
        <div>
          <h4>${escapeHtml(log.decision)}</h4>
          <div class="item-meta">
            <span>${formatDate(log.at)}</span>
            <span>${escapeHtml(log.trigger)}</span>
            <span>일정 ${log.snapshot.scheduleCount}</span>
            <span>뉴스 ${log.snapshot.newsCount}</span>
            <span>할일 ${log.snapshot.openTasks}</span>
          </div>
        </div>
      </article>
    `;
  }

  function emptyTemplate(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function setDefaultDates() {
    const today = todayKey();
    if ($("#schedule-date") && !$("#schedule-date").value) {
      $("#schedule-date").value = today;
    }
    if ($("#task-due") && !$("#task-due").value) {
      $("#task-due").value = today;
    }
  }

  function updateTodayLabel() {
    const formatted = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    }).format(new Date());
    $("#today-label").textContent = formatted;
  }

  function compareSchedules(a, b) {
    return `${a.date || ""}T${a.time || "00:00"}`.localeCompare(`${b.date || ""}T${b.time || "00:00"}`);
  }

  function compareTasks(a, b) {
    if (a.done !== b.done) {
      return Number(a.done) - Number(b.done);
    }
    return (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31");
  }

  function formatCurrency(value) {
    const currency = state.profile?.currency || "KRW";
    try {
      return new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency,
        maximumFractionDigits: 0
      }).format(Number(value || 0));
    } catch (error) {
      return `${Number(value || 0).toLocaleString("ko-KR")} ${currency}`;
    }
  }

  function formatDate(dateValue, timeValue) {
    if (!dateValue) {
      return "날짜 없음";
    }

    const source = dateValue.includes("T") ? dateValue : `${dateValue}T${timeValue || "00:00"}`;
    const date = new Date(source);

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    const options = dateValue.includes("T")
      ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
      : { month: "short", day: "numeric", weekday: "short" };

    const formatted = new Intl.DateTimeFormat("ko-KR", options).format(date);
    return timeValue && !dateValue.includes("T") ? `${formatted} ${timeValue}` : formatted;
  }

  function todayKey() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function addDaysKey(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function normalizeUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      return "";
    }

    try {
      const url = new URL(trimmed);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function normalizeFamilyCode(value) {
    return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
  }

  function sessionMatchesAuth(session, auth) {
    return Boolean(session && auth && session.familyCode === auth.familyCode && auth.passwordHash);
  }

  function hashPassword(code, password) {
    const input = `${code}:${password}`;
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let index = 0; index < input.length; index += 1) {
      const codePoint = input.charCodeAt(index);
      h1 = Math.imul(h1 ^ codePoint, 2654435761);
      h2 = Math.imul(h2 ^ codePoint, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (match) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      return entities[match];
    });
  }
})();
