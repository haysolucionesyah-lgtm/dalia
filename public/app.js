// ========================================================
// CENTRO DE MANDO EJECUTIVO - DALIA IA
// Hector Samuel & Yonaiker Marcano
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos del DOM
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const btnLogoutPanel = document.getElementById('btn-logout-panel');

    const qrImage = document.getElementById('qr-image');
    const qrLoading = document.getElementById('qr-loading');
    const qrConnected = document.getElementById('qr-connected');
    const btnRegenerateQr = document.getElementById('btn-regenerate-qr');
    const connectedPhoneDisplay = document.getElementById('connected-phone-display');

    const globalStatusPill = document.getElementById('global-status-pill');
    const globalStatusText = document.getElementById('global-status-text');
    const botStatusBadge = document.getElementById('bot-status-badge');

    // KPI Badges
    const kpiAgenda = document.getElementById('kpi-agenda');
    const kpiTasks = document.getElementById('kpi-tasks');
    const kpiProjects = document.getElementById('kpi-projects');
    const kpiClients = document.getElementById('kpi-clients');

    // Tablas y Contenedores
    const agendaTbody = document.getElementById('agenda-tbody');
    const tasksListContainer = document.getElementById('tasks-list-container');
    const projectsTbody = document.getElementById('projects-tbody');
    const clientsTbody = document.getElementById('clients-tbody');
    const filterClientsInput = document.getElementById('filter-clients-input');
    const filterBriefingSelect = document.getElementById('filter-briefing-select');
    const btnRefreshClients = document.getElementById('btn-refresh-clients');
    const knowledgeEditor = document.getElementById('knowledge-editor');
    const btnSaveKnowledge = document.getElementById('btn-save-knowledge');

    // Configuración
    const cfgBusinessName = document.getElementById('cfg-business-name');
    const cfgBotName = document.getElementById('cfg-bot-name');
    const cfgTimezone = document.getElementById('cfg-timezone');
    const cfgCurrency = document.getElementById('cfg-currency');
    const btnSaveConfig = document.getElementById('btn-save-config');

    let currentStatus = 'loading';
    let allTasks = [];
    let currentTaskFilter = 'all';

    // 2. Control de Autenticación
    const authToken = localStorage.getItem('dalia_admin_token') || localStorage.getItem('sofia_admin_token');
    if (!authToken) {
        if (loginOverlay) loginOverlay.classList.remove('hidden');
    } else {
        if (loginOverlay) loginOverlay.classList.add('hidden');
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            loginError.classList.add('hidden');

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('dalia_admin_token', data.token);
                    loginOverlay.classList.add('hidden');
                    initDashboard();
                } else {
                    loginError.textContent = data.error || 'Credenciales inválidas.';
                    loginError.classList.remove('hidden');
                }
            } catch (err) {
                loginError.textContent = 'Error conectando con el servidor.';
                loginError.classList.remove('hidden');
            }
        });
    }

    if (btnLogoutPanel) {
        btnLogoutPanel.addEventListener('click', () => {
            if (confirm('¿Deseas salir del Centro de Mando?')) {
                localStorage.removeItem('dalia_admin_token');
                localStorage.removeItem('sofia_admin_token');
                window.location.reload();
            }
        });
    }

    // 3. Navegación entre Pestañas
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    function switchTab(targetTab) {
        navButtons.forEach(b => {
            if (b.getAttribute('data-tab') === targetTab) b.classList.add('active');
            else b.classList.remove('active');
        });
        tabContents.forEach(t => {
            if (t.id === targetTab) {
                t.classList.remove('hidden');
                t.classList.add('active');
            } else {
                t.classList.remove('active');
                t.classList.add('hidden');
            }
        });

        // Recargar datos frescos automáticamente al seleccionar cada pestaña
        if (targetTab === 'tab-knowledge') loadKnowledge();
        if (targetTab === 'tab-config') loadConfig();
        if (targetTab === 'tab-finances') loadFinances();
        if (targetTab === 'tab-clients') loadClients();
        if (targetTab === 'tab-sofia') renderSofiaClients();
        if (targetTab === 'tab-projects') loadProjects();
        if (targetTab === 'tab-tasks') loadTasks();
        if (targetTab === 'tab-agenda') loadAgenda();
    }
    window.switchTab = switchTab;

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Enlazar los chips superiores de métricas con sus pestañas
    document.querySelector('.kpi-agenda')?.addEventListener('click', () => switchTab('tab-agenda'));
    document.querySelector('.kpi-tasks')?.addEventListener('click', () => switchTab('tab-tasks'));
    document.querySelector('.kpi-clients')?.addEventListener('click', () => switchTab('tab-clients'));
    document.querySelector('.kpi-projects')?.addEventListener('click', () => switchTab('tab-projects'));

    // 4. Modales
    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('hidden');
    }
    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('hidden');
    }

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            closeModal(modalId);
        });
    });

    // Botones para abrir modales
    document.getElementById('btn-open-modal-agenda')?.addEventListener('click', () => openModal('modal-agenda'));
    document.getElementById('btn-open-modal-task')?.addEventListener('click', () => openModal('modal-task'));
    document.getElementById('btn-open-modal-project')?.addEventListener('click', () => openModal('modal-project'));
    document.getElementById('btn-open-modal-finance')?.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('fin-input-date');
        if (dateInput) dateInput.value = today;
        openModal('modal-finance');
    });

    // 5. Polling de Estado y Código QR
    async function checkStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            updateStatusUI(data.status, data.connectedPhone);
        } catch (err) {
            updateStatusUI('offline', '');
        }
    }

    function updateStatusUI(status, connectedPhone = '') {
        currentStatus = status;
        const dot = globalStatusPill ? globalStatusPill.querySelector('.status-dot-indicator') : null;

        if (status === 'ready' || status === 'authenticated') {
            if (dot) dot.className = 'status-dot-indicator online';
            if (globalStatusText) globalStatusText.textContent = 'Dalia en Línea';
            if (botStatusBadge) botStatusBadge.innerHTML = '<span class="dot" style="background: #10b981;"></span> Conectada 24/7';

            if (qrLoading) qrLoading.classList.add('hidden');
            if (qrImage) {
                qrImage.classList.add('hidden');
                qrImage.dataset.loadedStatus = '';
            }
            if (qrConnected) qrConnected.classList.remove('hidden');

            const phoneClean = (connectedPhone || '').replace(/\D/g, '');
            const phoneText = phoneClean ? `+${phoneClean}` : 'Conectada';
            if (connectedPhoneDisplay) connectedPhoneDisplay.textContent = phoneText;
        } else if (status === 'qr') {
            if (dot) dot.className = 'status-dot-indicator';
            if (globalStatusText) globalStatusText.textContent = 'Escanear QR';
            if (botStatusBadge) botStatusBadge.innerHTML = '<span class="dot" style="background: #f59e0b;"></span> Esperando Escaneo';

            if (qrConnected) qrConnected.classList.add('hidden');

            const now = Date.now();
            const transitioned = !qrImage || qrImage.dataset.loadedStatus !== 'qr';
            const expired = (now - (window._lastQrLoadTime || 0)) > 15000;

            if ((transitioned || expired) && !window._isQrLoading) {
                window._isQrLoading = true;
                window._lastQrLoadTime = now;

                const preloader = new Image();
                preloader.onload = () => {
                    if (qrImage) {
                        qrImage.dataset.loadedStatus = 'qr';
                        qrImage.src = preloader.src;
                        qrImage.classList.remove('hidden');
                    }
                    if (qrLoading) qrLoading.classList.add('hidden');
                    window._isQrLoading = false;
                };
                preloader.onerror = () => {
                    window._isQrLoading = false;
                };
                preloader.src = `/api/qr-code?t=${now}`;
            }
        } else {
            if (dot) dot.className = 'status-dot-indicator offline';
            if (globalStatusText) globalStatusText.textContent = status === 'loading' ? 'Iniciando...' : 'Desconectada';
            if (botStatusBadge) botStatusBadge.innerHTML = '<span class="dot" style="background: #ef4444;"></span> Desconectada';

            if (qrConnected) qrConnected.classList.add('hidden');
            if (qrImage) {
                qrImage.classList.add('hidden');
                qrImage.dataset.loadedStatus = '';
            }
            if (qrLoading) qrLoading.classList.remove('hidden');
        }
    }

    if (btnRegenerateQr) {
        btnRegenerateQr.addEventListener('click', async () => {
            if (!confirm('¿Deseas cerrar la sesión de WhatsApp para generar un nuevo código QR?')) return;
            btnRegenerateQr.disabled = true;
            btnRegenerateQr.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Regenerando QR...';
            updateStatusUI('loading');

            try {
                await fetch('/api/regenerate-qr', { method: 'POST' });
                setTimeout(() => window.location.reload(), 3000);
            } catch (e) {
                alert('Error al reiniciar sesión.');
                btnRegenerateQr.disabled = false;
            }
        });
    }

    // 6. Carga de Métricas y KPIs
    async function loadStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            if (kpiAgenda) kpiAgenda.textContent = data.agendaCount || 0;
            if (kpiTasks) kpiTasks.textContent = data.tasksPendingCount || 0;
            if (kpiProjects) kpiProjects.textContent = data.projectsCount || 0;
            if (kpiClients) kpiClients.textContent = data.clientsCount || 0;
        } catch (e) {}
    }

    // 7. GESTIÓN DE AGENDA
    let allAgenda = [];

    async function loadAgenda() {
        if (!agendaTbody) return;
        try {
            const res = await fetch('/api/agenda');
            const data = await res.json();
            allAgenda = data.agenda || [];

            if (allAgenda.length === 0) {
                agendaTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay citas registradas en la agenda.</td></tr>`;
                return;
            }

            agendaTbody.innerHTML = allAgenda.map(item => {
                const statusBadge = item.status === 'confirmada'
                    ? '<span class="badge badge-success">Confirmada</span>'
                    : item.status === 'pendiente_evaluacion'
                    ? '<span class="badge badge-warning">Por Evaluar</span>'
                    : `<span class="badge badge-purple">${item.status}</span>`;

                const creatorTag = item.createdBy
                    ? `<br><small class="text-muted"><i class="fa-solid fa-user-tag font-xs"></i> ${item.createdBy}</small>`
                    : '';

                return `
                <tr>
                    <td><strong>${item.date}</strong></td>
                    <td class="font-mono">${item.time || '--'}</td>
                    <td>${item.title}${creatorTag}</td>
                    <td>${item.clientOrTopic || '--'}</td>
                    <td><small class="text-muted">${item.notes || '--'}</small></td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex;gap:0.35rem;">
                            <button class="btn btn-sm btn-secondary" onclick="window.editAgendaItem(${item.id})" title="Modificar cita">
                                <i class="fa-solid fa-pen text-primary"></i>
                            </button>
                            <button class="btn btn-sm btn-whatsapp" onclick="window.notifyAgendaItem(${item.id})" title="Enviar recordatorio por WhatsApp a los directores">
                                <i class="fa-brands fa-whatsapp"></i> Avisar
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="window.deleteAgendaItem(${item.id})" title="Eliminar cita">
                                <i class="fa-solid fa-trash text-danger"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        } catch (e) {
            console.error('Error cargando agenda:', e);
        }
    }

    window.editAgendaItem = function(id) {
        const item = allAgenda.find(a => a.id === id);
        if (!item) return;
        document.getElementById('edit-agenda-id').value = item.id;
        document.getElementById('edit-agenda-title').value = item.title || '';
        document.getElementById('edit-agenda-date').value = item.date || '';
        document.getElementById('edit-agenda-time').value = item.time || '';
        document.getElementById('edit-agenda-client').value = item.clientOrTopic || '';
        document.getElementById('edit-agenda-creator').value = (item.createdBy && item.createdBy.includes('Yonaiker')) ? 'Yonaiker Marcano' : ((item.createdBy && item.createdBy.includes('Adrian')) ? 'Adrian Hidalgo' : 'Hector Samuel');
        document.getElementById('edit-agenda-notes').value = item.notes || '';
        openModal('modal-edit-agenda');
    };

    document.getElementById('form-edit-agenda')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-agenda-id').value;
        const payload = {
            title: document.getElementById('edit-agenda-title').value.trim(),
            date: document.getElementById('edit-agenda-date').value,
            time: document.getElementById('edit-agenda-time').value.trim(),
            clientOrTopic: document.getElementById('edit-agenda-client').value.trim(),
            createdBy: document.getElementById('edit-agenda-creator').value,
            notes: document.getElementById('edit-agenda-notes').value.trim()
        };

        try {
            const res = await fetch(`/api/agenda/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal('modal-edit-agenda');
                loadAgenda();
                loadStats();
            }
        } catch (err) {
            alert('Error modificando la cita.');
        }
    });

    window.notifyAgendaItem = async function(id) {
        try {
            const res = await fetch(`/api/agenda/${id}/notify`, { method: 'POST' });
            const data = await res.json();
            alert(data.message || 'Recordatorio enviado por WhatsApp.');
        } catch (e) {
            alert('Error enviando recordatorio.');
        }
    };

    window.deleteAgendaItem = async function(id) {
        if (!confirm('¿Deseas eliminar esta cita de la agenda?')) return;
        try {
            await fetch(`/api/agenda/${id}`, { method: 'DELETE' });
            loadAgenda();
            loadStats();
        } catch (e) {
            alert('Error eliminando cita.');
        }
    };

    document.getElementById('form-new-agenda')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            title: document.getElementById('agenda-input-title').value.trim(),
            date: document.getElementById('agenda-input-date').value,
            time: document.getElementById('agenda-input-time').value.trim(),
            clientOrTopic: document.getElementById('agenda-input-client').value.trim(),
            createdBy: 'Hector Samuel',
            notes: document.getElementById('agenda-input-notes').value.trim(),
            status: 'confirmada'
        };

        try {
            const res = await fetch('/api/agenda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal('modal-agenda');
                e.target.reset();
                loadAgenda();
                loadStats();
            }
        } catch (err) {
            alert('Error guardando en agenda.');
        }
    });

    document.getElementById('btn-refresh-agenda')?.addEventListener('click', loadAgenda);

    // 8. GESTIÓN DE TAREAS Y RECORDATORIOS
    async function loadTasks() {
        if (!tasksListContainer) return;
        try {
            const res = await fetch('/api/tasks');
            const data = await res.json();
            allTasks = data.tasks || [];
            renderTasks();
        } catch (e) {
            console.error('Error cargando tareas:', e);
        }
    }

    function renderTasks() {
        if (!tasksListContainer) return;

        // Actualizar contadores de los filtros
        const cntAll = allTasks.length;
        const cntHector = allTasks.filter(t => (t.assignedTo || '').includes('Hector')).length;
        const cntYonaiker = allTasks.filter(t => (t.assignedTo || '').includes('Yonaiker')).length;
        const cntAdrian = allTasks.filter(t => (t.assignedTo || '').includes('Adrian') || (t.assignedTo || '').includes('Adrián')).length;
        const cntEquipo = allTasks.filter(t => (t.assignedTo || '') === 'Equipo' || (t.assignedTo || '').includes('Ambos')).length;
        const cntPending = allTasks.filter(t => !t.completed).length;

        const elCntAll = document.getElementById('task-cnt-all');
        const elCntHector = document.getElementById('task-cnt-hector');
        const elCntYonaiker = document.getElementById('task-cnt-yonaiker');
        const elCntAdrian = document.getElementById('task-cnt-adrian');
        const elCntEquipo = document.getElementById('task-cnt-equipo');
        const elCntPending = document.getElementById('task-cnt-pending');

        if (elCntAll) elCntAll.textContent = cntAll;
        if (elCntHector) elCntHector.textContent = cntHector;
        if (elCntYonaiker) elCntYonaiker.textContent = cntYonaiker;
        if (elCntAdrian) elCntAdrian.textContent = cntAdrian;
        if (elCntEquipo) elCntEquipo.textContent = cntEquipo;
        if (elCntPending) elCntPending.textContent = cntPending;

        let filtered = allTasks;
        if (currentTaskFilter === 'Hector Samuel') {
            filtered = allTasks.filter(t => (t.assignedTo || '').includes('Hector'));
        } else if (currentTaskFilter === 'Yonaiker Marcano') {
            filtered = allTasks.filter(t => (t.assignedTo || '').includes('Yonaiker'));
        } else if (currentTaskFilter === 'Adrian Hidalgo') {
            filtered = allTasks.filter(t => (t.assignedTo || '').includes('Adrian') || (t.assignedTo || '').includes('Adrián'));
        } else if (currentTaskFilter === 'Equipo') {
            filtered = allTasks.filter(t => (t.assignedTo || '') === 'Equipo' || (t.assignedTo || '').includes('Ambos'));
        } else if (currentTaskFilter === 'pending') {
            filtered = allTasks.filter(t => !t.completed);
        }

        if (filtered.length === 0) {
            tasksListContainer.innerHTML = `<p class="text-muted p-4 text-center">No hay tareas registradas con este filtro.</p>`;
            return;
        }

        tasksListContainer.innerHTML = filtered.map(t => {
            const isHector = (t.assignedTo || '').includes('Hector');
            const isYonaiker = (t.assignedTo || '').includes('Yonaiker');
            const isAdrian = (t.assignedTo || '').includes('Adrian') || (t.assignedTo || '').includes('Adrián');
            const itemClass = isHector ? 'assigned-hector' : (isYonaiker ? 'assigned-yonaiker' : (isAdrian ? 'assigned-adrian' : 'assigned-equipo'));

            const assignedBadge = isHector
                ? `<span class="badge-assigned-hector"><i class="fa-solid fa-crown text-warning"></i> Para: Hector Samuel</span>`
                : (isYonaiker
                    ? `<span class="badge-assigned-yonaiker"><i class="fa-solid fa-user-gear"></i> Para: Yonaiker Marcano</span>`
                    : (isAdrian
                        ? `<span class="badge-assigned-adrian"><i class="fa-solid fa-user-shield"></i> Para: Adrian Hidalgo</span>`
                        : `<span class="badge-assigned-equipo"><i class="fa-solid fa-users"></i> Para: Todos (Equipo)</span>`));

            const creatorText = (t.createdBy && t.createdBy !== t.assignedTo)
                ? `<span class="task-creator-pill"><i class="fa-solid fa-pen-nib"></i> Dictada por ${t.createdBy}</span>`
                : '';

            const alarmBadge = (t.reminderTimestamp && !t.reminded && !t.completed)
                ? `<span class="badge badge-warning font-xs" title="Tiene recordatorio automático programado"><i class="fa-solid fa-bell"></i> Alarma Activa</span>`
                : '';

            return `
            <div class="task-item ${itemClass}">
                <div class="task-left">
                    <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''} onchange="window.toggleTaskItem(${t.id})">
                    <div class="task-content ${t.completed ? 'completed' : ''}">
                        <h5>${escapeHtml(t.description)}</h5>
                        <div class="task-meta">
                            ${assignedBadge}
                            <span><i class="fa-solid fa-clock"></i> ${t.dueDate || 'Hoy'}</span>
                            ${alarmBadge}
                            ${creatorText}
                            ${t.completed ? '<span class="text-success"><i class="fa-solid fa-check"></i> Cumplida</span>' : ''}
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:0.4rem;align-items:center;">
                    <button class="btn btn-sm btn-secondary" onclick="window.editTaskItem(${t.id})" title="Modificar recordatorio">
                        <i class="fa-solid fa-pen text-primary"></i>
                    </button>
                    <button class="btn btn-sm btn-whatsapp" onclick="window.notifyTaskItem(${t.id})" title="Disparar recordatorio por WhatsApp de inmediato">
                        <i class="fa-brands fa-whatsapp"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.deleteTaskItem(${t.id})" title="Eliminar recordatorio">
                        <i class="fa-solid fa-trash text-danger"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    window.editTaskItem = function(id) {
        const task = allTasks.find(t => t.id === id);
        if (!task) return;
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-desc').value = task.description || '';
        document.getElementById('edit-task-assigned').value = (task.assignedTo && task.assignedTo.includes('Yonaiker')) ? 'Yonaiker Marcano' : ((task.assignedTo && (task.assignedTo.includes('Adrian') || task.assignedTo.includes('Adrián'))) ? 'Adrian Hidalgo' : ((task.assignedTo && task.assignedTo.includes('Hector')) ? 'Hector Samuel' : 'Equipo'));
        document.getElementById('edit-task-due').value = task.dueDate || 'Hoy';
        openModal('modal-edit-task');
    };

    document.getElementById('form-edit-task')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-task-id').value;
        const payload = {
            description: document.getElementById('edit-task-desc').value.trim(),
            assignedTo: document.getElementById('edit-task-assigned').value,
            dueDate: document.getElementById('edit-task-due').value.trim()
        };

        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal('modal-edit-task');
                loadTasks();
                loadStats();
            }
        } catch (err) {
            alert('Error modificando la tarea.');
        }
    });

    window.notifyTaskItem = async function(id) {
        try {
            const res = await fetch(`/api/tasks/${id}/notify`, { method: 'POST' });
            const data = await res.json();
            alert(data.message || 'Recordatorio enviado por WhatsApp.');
        } catch (e) {
            alert('Error enviando recordatorio.');
        }
    };

    window.toggleTaskItem = async function(id) {
        try {
            await fetch(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
            loadTasks();
            loadStats();
        } catch (e) {
            alert('Error actualizando tarea.');
        }
    };

    window.deleteTaskItem = async function(id) {
        if (!confirm('¿Deseas eliminar este recordatorio?')) return;
        try {
            await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
            loadTasks();
            loadStats();
        } catch (e) {
            alert('Error eliminando tarea.');
        }
    };

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTaskFilter = btn.getAttribute('data-filter');
            renderTasks();
        });
    });

    document.getElementById('form-new-task')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            description: document.getElementById('task-input-desc').value.trim(),
            assignedTo: document.getElementById('task-input-assigned').value,
            dueDate: document.getElementById('task-input-due').value.trim()
        };

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal('modal-task');
                e.target.reset();
                loadTasks();
                loadStats();
            }
        } catch (e) {
            alert('Error guardando tarea.');
        }
    });

    document.getElementById('btn-refresh-tasks')?.addEventListener('click', loadTasks);

    // 9. GESTIÓN DE PROYECTOS Y LEADS
    async function loadProjects() {
        if (!projectsTbody) return;
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            const list = data.projects || [];

            if (list.length === 0) {
                projectsTbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay proyectos registrados en el pipeline.</td></tr>`;
                return;
            }

            projectsTbody.innerHTML = list.map(p => {
                const dateFormatted = p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-ES') : '--';
                const statusBadge = p.status === 'Lead Nuevo'
                    ? '<span class="badge badge-warning">Lead Nuevo</span>'
                    : p.status === 'En Desarrollo'
                    ? '<span class="badge badge-info">En Desarrollo</span>'
                    : p.status === 'Finalizado'
                    ? '<span class="badge badge-success">Finalizado</span>'
                    : `<span class="badge badge-purple">${p.status || 'Activo'}</span>`;

                return `
                <tr>
                    <td>${dateFormatted}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.client || '--'}</td>
                    <td><small class="text-muted">${p.description || '--'}</small></td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="window.deleteProjectItem(${p.id})">
                            <i class="fa-solid fa-trash text-danger"></i>
                        </button>
                    </td>
                </tr>`;
            }).join('');
        } catch (e) {
            console.error('Error cargando proyectos:', e);
        }
    }

    window.deleteProjectItem = async function(id) {
        if (!confirm('¿Deseas eliminar este proyecto del pipeline?')) return;
        try {
            await fetch(`/api/projects/${id}`, { method: 'DELETE' });
            loadProjects();
            loadStats();
        } catch (e) {
            alert('Error eliminando proyecto.');
        }
    };

    document.getElementById('form-new-project')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('project-input-name').value.trim(),
            client: document.getElementById('project-input-client').value.trim(),
            description: document.getElementById('project-input-desc').value.trim(),
            status: document.getElementById('project-input-status').value
        };

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal('modal-project');
                e.target.reset();
                loadProjects();
                loadStats();
            }
        } catch (e) {
            alert('Error registrando proyecto.');
        }
    });

    document.getElementById('btn-refresh-projects')?.addEventListener('click', loadProjects);

    // ========================================================
    // 9.5. DIRECTORIO DE CLIENTES & CRM (PIPELINE VISUAL & BRIEFING)
    // ========================================================
    let allClients = [];
    let currentSelectedClientId = null;

    function formatRelativeTime(dateStr) {
        if (!dateStr) return '--';
        try {
            const diffMs = Date.now() - new Date(dateStr).getTime();
            const mins = Math.floor(diffMs / (1000 * 60));
            if (mins < 1) return 'Hace un momento';
            if (mins < 60) return `Hace ${mins} min`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `Hace ${hours} h`;
            const days = Math.floor(hours / 24);
            if (days === 1) return 'Ayer';
            if (days < 7) return `Hace ${days} días`;
            return new Date(dateStr).toLocaleDateString('es-ES');
        } catch (e) {
            return '--';
        }
    }

    function getStageBadgeClass(stage) {
        if (!stage) return 'badge-lead-nuevo';
        if (stage.includes('Caliente')) return 'badge-caliente';
        if (stage.includes('Conversación')) return 'badge-conversacion';
        if (stage.includes('Cita')) return 'badge-cita';
        if (stage.includes('Ganado')) return 'badge-ganado';
        if (stage.includes('Frío')) return 'badge-frio';
        return 'badge-lead-nuevo';
    }

    async function loadClients() {
        if (!clientsTbody && !document.getElementById('sofia-clients-container')) return;
        try {
            const res = await fetch('/api/clients');
            const data = await res.json();
            allClients = data.clients || [];
            renderClients();
            if (typeof renderSofiaClients === 'function') renderSofiaClients();
        } catch (e) {
            console.error('Error cargando clientes:', e);
        }
    }

    function renderClients() {
        if (!clientsTbody) return;

        const term = (filterClientsInput?.value || '').toLowerCase().trim();
        const filterStage = filterBriefingSelect?.value || 'all';

        let filtered = allClients.filter(c => {
            const matchesSearch = !term ||
                (c.name || '').toLowerCase().includes(term) ||
                (c.phone || '').includes(term) ||
                (c.company || '').toLowerCase().includes(term) ||
                (c.rubro || '').toLowerCase().includes(term) ||
                (c.summary || '').toLowerCase().includes(term) ||
                (c.notes || '').toLowerCase().includes(term);

            if (!matchesSearch) return false;

            if (filterStage === 'all') return true;
            if (filterStage === 'paused') return c.isPaused === true;
            if (filterStage === 'briefing_done') return c.briefing && c.briefing.completed;
            return c.stage === filterStage;
        });

        if (filtered.length === 0) {
            clientsTbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-4">No se encontraron prospectos o clientes con los filtros actuales.</td></tr>`;
            return;
        }

        clientsTbody.innerHTML = filtered.map(c => {
            const cleanPhone = (c.phone || '').replace(/\D/g, '');
            const phoneDisplay = `+${cleanPhone}`;
            const timeAgo = formatRelativeTime(c.lastActive || c.updatedAt);
            const stageClass = getStageBadgeClass(c.stage);
            const currentStage = c.stage || '🟡 Lead Nuevo';

            const stagesList = [
                '🟡 Lead Nuevo',
                '🔵 En Conversación',
                '🔥 Interesado Caliente',
                '📅 Cita Agendada',
                '🟢 Cliente Ganado',
                '⚪ Frío / Sin Respuesta'
            ];

            const optionsHtml = stagesList.map(st => 
                `<option value="${st}" ${st === currentStage ? 'selected' : ''}>${st}</option>`
            ).join('');

            return `
            <tr>
                <td>
                    <div class="user-avatar-cell">
                        <div class="avatar-circle"><i class="fa-solid fa-user"></i></div>
                        <div>
                            <strong>${c.name || 'Cliente'}</strong>
                            <div class="font-mono text-muted" style="font-size:0.78rem;">${phoneDisplay}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <strong>${c.company && c.company !== 'Por definir' ? c.company : (c.briefing?.nombreComercial || 'Empresa por definir')}</strong>
                    <small class="text-muted d-block">${c.rubro && c.rubro !== 'Por definir' ? c.rubro : (c.briefing?.sector || 'Rubro general')}</small>
                </td>
                <td>
                    <span class="badge badge-purple">${c.interest || 'Bot WhatsApp Sofía'}</span>
                    ${c.budget && c.budget !== 'Por definir' ? `<small class="text-muted d-block font-mono">Presupuesto: ${c.budget}</small>` : ''}
                </td>
                <td>
                    <select class="stage-select-sm" onchange="window.updateClientStage('${c.id}', this.value)" title="Cambiar etapa del pipeline">
                        ${optionsHtml}
                    </select>
                </td>
                <td>
                    <small class="text-muted d-block"><i class="fa-regular fa-clock"></i> ${timeAgo}</small>
                    ${c.isPaused ? '<span class="badge badge-danger font-xs">🛑 Silenciado</span>' : '<span class="badge badge-success font-xs">🟢 Dalia Activa</span>'}
                </td>
                <td>
                    <div class="btn-group-cell">
                        <button class="btn btn-sm btn-primary" onclick="window.openClientProfile('${c.id}')" title="Ver Ficha de Perfil 360°">
                            <i class="fa-solid fa-eye"></i> Ficha 360°
                        </button>
                        <a href="https://wa.me/${cleanPhone}" target="_blank" class="btn btn-sm btn-whatsapp-direct" title="Abrir chat en WhatsApp">
                            <i class="fa-brands fa-whatsapp"></i> Chat
                        </a>
                        <button class="btn btn-sm ${c.isPaused ? 'btn-success' : 'btn-warning'}" onclick="window.toggleClientPause('${c.id}')" title="${c.isPaused ? 'Reanudar Dalia' : 'Silenciar a Dalia'}">
                            <i class="fa-solid ${c.isPaused ? 'fa-play' : 'fa-hand'}"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="window.deleteClientItem('${c.id}')" title="Eliminar expediente">
                            <i class="fa-solid fa-trash text-danger"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // Actualizar etapa del Pipeline en vivo
    window.updateClientStage = async function(id, stage) {
        try {
            const res = await fetch(`/api/clients/${id}/stage`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage })
            });
            const data = await res.json();
            if (data.success) {
                loadClients();
                loadStats();
                if (currentSelectedClientId === id) {
                    const badge = document.getElementById('mc-pipeline-badge');
                    if (badge) {
                        badge.className = `badge ${getStageBadgeClass(stage)}`;
                        badge.textContent = stage;
                    }
                    const select = document.getElementById('mc-pipeline-select');
                    if (select) select.value = stage;
                }
            }
        } catch (e) {
            alert('Error actualizando etapa del pipeline.');
        }
    };

    // Tabs del modal de clientes
    const clientTabButtons = document.querySelectorAll('.client-tab-btn');
    clientTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-client-tab');
            clientTabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.client-subtab').forEach(t => {
                t.classList.remove('active');
                t.classList.add('hidden');
            });
            btn.classList.add('active');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.classList.remove('hidden');
                targetEl.classList.add('active');
            }
        });
    });

    window.openClientProfile = async function(id) {
        currentSelectedClientId = id;
        try {
            // Activar por defecto la pestaña principal de Chat & Inteligencia Split-View
            document.querySelectorAll('.client-tab-btn').forEach(b => {
                if (b.getAttribute('data-client-tab') === 'tab-client-chat') {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            document.querySelectorAll('.client-subtab').forEach(t => {
                if (t.id === 'tab-client-chat') {
                    t.classList.remove('hidden');
                    t.classList.add('active');
                } else {
                    t.classList.remove('active');
                    t.classList.add('hidden');
                }
            });

            const res = await fetch(`/api/clients/${id}`);
            const data = await res.json();
            const client = data.client;
            if (!client) return alert('Cliente no encontrado.');

            const cleanPhone = (client.phone || '').replace(/\D/g, '');
            const phoneDisplay = `+${cleanPhone}`;
            const timeAgo = formatRelativeTime(client.lastActive || client.updatedAt);

            // Header info
            document.getElementById('mc-client-name').innerHTML = `<i class="fa-solid fa-user-tie text-primary"></i> ${client.name || 'Cliente'} <small class="text-muted font-mono">(${client.company || 'Empresa por definir'})</small>`;
            document.getElementById('mc-client-subtitle').textContent = `WhatsApp: ${phoneDisplay} • Última actividad: ${timeAgo} • Registrado: ${new Date(client.createdAt).toLocaleDateString('es-ES')}`;

            // Botón directo a WhatsApp
            const linkWa = document.getElementById('mc-link-whatsapp');
            if (linkWa) linkWa.href = `https://wa.me/${cleanPhone}`;

            // Pipeline Badge & Selector
            const pipelineBadge = document.getElementById('mc-pipeline-badge');
            if (pipelineBadge) {
                pipelineBadge.className = `badge ${getStageBadgeClass(client.stage)}`;
                pipelineBadge.textContent = client.stage || '🟡 Lead Nuevo';
            }
            const pipelineSelect = document.getElementById('mc-pipeline-select');
            if (pipelineSelect) {
                pipelineSelect.value = client.stage || '🟡 Lead Nuevo';
            }

            // Pause status
            const pauseBadge = document.getElementById('mc-pause-badge');
            const btnPause = document.getElementById('btn-toggle-pause-client');
            if (client.isPaused) {
                pauseBadge.className = 'badge badge-danger';
                pauseBadge.innerHTML = '<i class="fa-solid fa-hand"></i> Dalia Silenciada (Control Humano)';
                btnPause.className = 'btn btn-sm btn-success';
                btnPause.innerHTML = '<i class="fa-solid fa-play"></i> Reactivar a Dalia';
            } else {
                pauseBadge.className = 'badge badge-success';
                pauseBadge.innerHTML = '<i class="fa-solid fa-robot"></i> Dalia Activa (IA)';
                btnPause.className = 'btn btn-sm btn-outline-warning';
                btnPause.innerHTML = '<i class="fa-solid fa-hand"></i> Silenciar a Dalia';
            }

            // Resumen Ejecutivo por IA
            const summaryEl = document.getElementById('mc-ai-summary');
            if (summaryEl) {
                summaryEl.textContent = client.summary || 'Aún no se ha generado un resumen ejecutivo de este prospecto.';
            }

            // Datos Auto-Extraídos por Dalia (Trabajo sucio)
            document.getElementById('mc-val-name').textContent = client.name || 'Pendiente por detectar';
            document.getElementById('mc-val-company').textContent = client.company || 'Pendiente por detectar';
            document.getElementById('mc-val-rubro').textContent = client.rubro || 'Pendiente por detectar';
            document.getElementById('mc-val-budget').textContent = client.budget || 'Por definir';
            document.getElementById('mc-val-urgency').textContent = client.urgency || 'Media';
            document.getElementById('mc-val-interest').textContent = client.interest || 'Bot WhatsApp Sofía';

            // Rellenar los 5 bloques del Briefing Sofía
            const bf = client.briefing || {};
            document.getElementById('bf-nombre-eslogan').textContent = bf.nombreComercial || 'Pendiente por responder...';
            document.getElementById('bf-sector').textContent = bf.sector || 'Pendiente por responder...';
            document.getElementById('bf-web-redes').textContent = bf.webRedes || 'Pendiente por responder...';
            document.getElementById('bf-descripcion').textContent = bf.descripcionValor || 'Pendiente por responder...';

            document.getElementById('bf-funcion-principal').textContent = bf.funcionPrincipal || 'Pendiente por responder...';
            document.getElementById('bf-accion-final').textContent = bf.accionFinal || 'Pendiente por responder...';

            document.getElementById('bf-estilo').textContent = bf.estiloVoz || 'Pendiente por responder...';
            document.getElementById('bf-emojis').textContent = bf.emojis || 'Pendiente por responder...';
            document.getElementById('bf-trato').textContent = bf.trato || 'Pendiente por responder...';
            document.getElementById('bf-nombre-bot').textContent = bf.nombreBot || 'Pendiente por responder...';

            document.getElementById('bf-productos-precios').textContent = bf.productosPrecios || 'Pendiente por responder...';
            document.getElementById('bf-faqs').textContent = bf.faqs || 'Pendiente por responder...';
            document.getElementById('bf-politicas').textContent = bf.politicas || 'Pendiente por responder...';

            document.getElementById('bf-prohibidos').textContent = bf.temasProhibidos || 'Pendiente por responder...';
            document.getElementById('bf-derivacion').textContent = bf.derivacionHumana || 'Pendiente por responder...';

            // Rellenar Historial de Chat (Transcripción Completa)
            const chatStream = document.getElementById('mc-chat-stream');
            const chatCount = document.getElementById('mc-chat-count');
            const history = client.chatHistory || [];
            if (chatCount) chatCount.textContent = history.length;

            if (history.length === 0) {
                chatStream.innerHTML = '<p class="text-muted text-center p-4">No hay mensajes registrados aún en el historial con este cliente.</p>';
            } else {
                chatStream.innerHTML = history.map(turn => {
                    const isModel = turn.role === 'model';
                    const isDirector = turn.role === 'director';
                    const roleClass = isDirector ? 'director' : (isModel ? 'model' : 'user');
                    const senderLabel = isDirector ? '👔 Director (Humano)' : (isModel ? '🤖 Dalia' : '👤 ' + (client.name || 'Cliente'));
                    const cleanText = stripSystemTags(turn.text || turn.parts?.[0]?.text || '');
                    const timeTurn = turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
                    return `
                    <div class="chat-bubble ${roleClass}">
                        <div class="bubble-header">
                            <span class="bubble-sender">${senderLabel}</span>
                        </div>
                        <div class="bubble-body">${escapeHtml(cleanText)}</div>
                        ${timeTurn ? `<span class="bubble-meta">${timeTurn}</span>` : ''}
                    </div>`;
                }).join('');
                chatStream.scrollTop = chatStream.scrollHeight;
            }

            // Rellenar Notas Privadas de los Jefes
            document.getElementById('mc-notes-textarea').value = client.notes || '';

            openModal('modal-client');
        } catch (e) {
            console.error('Error abriendo perfil de cliente:', e);
            alert('Error cargando los detalles del cliente.');
        }
    };

    // Cambio de estado en el modal
    document.getElementById('mc-pipeline-select')?.addEventListener('change', (e) => {
        if (currentSelectedClientId) {
            window.updateClientStage(currentSelectedClientId, e.target.value);
        }
    });

    window.toggleClientPause = async function(id) {
        try {
            const res = await fetch(`/api/clients/${id}/toggle-pause`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                loadClients();
                if (currentSelectedClientId === id && !document.getElementById('modal-client').classList.contains('hidden')) {
                    window.openClientProfile(id);
                }
            }
        } catch (e) {
            alert('Error modificando estado del bot.');
        }
    };

    window.deleteClientItem = async function(id) {
        if (!confirm('¿Deseas eliminar este registro de cliente y todo su historial?')) return;
        try {
            await fetch(`/api/clients/${id}`, { method: 'DELETE' });
            loadClients();
            loadStats();
        } catch (e) {
            alert('Error eliminando cliente.');
        }
    };

    document.getElementById('btn-toggle-pause-client')?.addEventListener('click', () => {
        if (currentSelectedClientId) {
            window.toggleClientPause(currentSelectedClientId);
        }
    });

    // Enviar Seguimiento Manual desde la ficha
    document.getElementById('btn-send-followup-now')?.addEventListener('click', async () => {
        if (!currentSelectedClientId) return;
        if (!confirm('¿Deseas enviar el mensaje cordial de seguimiento a este cliente por WhatsApp ahora mismo?')) return;
        try {
            const res = await fetch(`/api/clients/${currentSelectedClientId}/send-followup`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('✅ Mensaje de seguimiento enviado con éxito.');
                window.openClientProfile(currentSelectedClientId);
            } else {
                alert('Aviso: ' + (data.error || 'No se pudo enviar'));
            }
        } catch (e) {
            alert('Error enviando seguimiento.');
        }
    });

    document.getElementById('btn-save-client-notes')?.addEventListener('click', async () => {
        if (!currentSelectedClientId) return;
        const notes = document.getElementById('mc-notes-textarea').value;
        try {
            const res = await fetch(`/api/clients/${currentSelectedClientId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes })
            });
            if (res.ok) {
                alert('✅ Notas privadas guardadas con éxito.');
                loadClients();
            }
        } catch (e) {
            alert('Error guardando notas.');
        }
    });

    filterClientsInput?.addEventListener('input', renderClients);
    filterBriefingSelect?.addEventListener('change', renderClients);
    btnRefreshClients?.addEventListener('click', loadClients);

    // ========================================================
    // 9.8. MÓDULO EXCLUSIVO: CLIENTES QUE PIDEN SOFÍA
    // ========================================================
    const counterSofiaNav = document.getElementById('counter-sofia-nav');
    const kpiSofiaTotalCount = document.getElementById('kpi-sofia-total-count');
    const kpiSofiaProgressCount = document.getElementById('kpi-sofia-progress-count');
    const kpiSofiaDoneCount = document.getElementById('kpi-sofia-done-count');
    const sofiaClientsContainer = document.getElementById('sofia-clients-container');
    const filterSofiaInput = document.getElementById('filter-sofia-input');
    const filterSofiaStatus = document.getElementById('filter-sofia-status');
    const btnRefreshSofia = document.getElementById('btn-refresh-sofia');

    const SOFIA_QUESTION_CATALOG = [
        {
            blockNum: 1,
            blockTitle: 'Bloque 1: Información Básica del Negocio',
            questions: [
                { step: 1, field: 'nombreComercial', label: '1. Nombre Comercial y Eslogan' },
                { step: 2, field: 'sector', label: '2. Sector o Industria' },
                { step: 3, field: 'webRedes', label: '3. Sitio Web y Redes Sociales' },
                { step: 4, field: 'descripcionValor', label: '4. Breve Descripción y Propuesta de Valor' }
            ]
        },
        {
            blockNum: 2,
            blockTitle: 'Bloque 2: Propósito y Objetivos del Bot',
            questions: [
                { step: 5, field: 'funcionPrincipal', label: '5. Función Principal de Sofía en WhatsApp' },
                { step: 6, field: 'accionFinal', label: '6. Acción Esperada al Final de la Conversación' }
            ]
        },
        {
            blockNum: 3,
            blockTitle: 'Bloque 3: Tono de Voz y Personalidad',
            questions: [
                { step: 7, field: 'estiloVoz', label: '7. Estilo de Comunicación e Identidad' },
                { step: 8, field: 'emojis', label: '8. Uso de Emojis (Libre / Moderado / Sin emojis)' },
                { step: 9, field: 'trato', label: '9. Trato al Cliente (Tú o Usted)' },
                { step: 10, field: 'nombreBot', label: '10. Nombre Asignado al Bot' }
            ]
        },
        {
            blockNum: 4,
            blockTitle: 'Bloque 4: Base de Conocimiento y Oferta (El Cerebro del Bot)',
            questions: [
                { step: 11, field: 'productosPrecios', label: '11. Productos o Servicios Principales y Precios' },
                { step: 12, field: 'faqs', label: '12. Preguntas Más Frecuentes (FAQs)' },
                { step: 13, field: 'politicas', label: '13. Políticas Comerciales (Envíos, Pagos, Reservas)' }
            ]
        },
        {
            blockNum: 5,
            blockTitle: 'Bloque 5: Límites y Casos Especiales (Guardrails)',
            questions: [
                { step: 14, field: 'temasProhibidos', label: '14. Temas Prohibidos o Límites que NUNCA debe tocar' },
                { step: 15, field: 'derivacionHumana', label: '15. Criterio de Derivación a Asesor Humano' }
            ]
        }
    ];

    function calculateSofiaProgress(client) {
        const b = client.briefing || {};
        const fields = [
            'nombreComercial', 'sector', 'webRedes', 'descripcionValor',
            'funcionPrincipal', 'accionFinal',
            'estiloVoz', 'emojis', 'trato', 'nombreBot',
            'productosPrecios', 'faqs', 'politicas',
            'temasProhibidos', 'derivacionHumana'
        ];

        let answeredCount = 0;
        let nextStepNumber = 16;
        let nextStepInfo = null;

        fields.forEach((f, idx) => {
            const val = b[f];
            const isAnswered = typeof val === 'string' && val.trim().length > 0 && val !== 'Por definir' && val !== 'Pendiente por responder...';
            if (isAnswered) {
                answeredCount++;
            } else if (nextStepNumber === 16) {
                nextStepNumber = idx + 1;
                for (const blk of SOFIA_QUESTION_CATALOG) {
                    const q = blk.questions.find(item => item.step === nextStepNumber);
                    if (q) {
                        nextStepInfo = q;
                        break;
                    }
                }
            }
        });

        const isCompleted = b.completed === true || answeredCount === 15;
        const percentage = Math.round((answeredCount / 15) * 100);

        return {
            answeredCount,
            total: 15,
            percentage,
            isCompleted,
            nextStepNumber: isCompleted ? 16 : nextStepNumber,
            nextStepInfo
        };
    }

    
    function loadSofiaDashboard() {
        renderSofiaClients();
    }

    function renderSofiaClients() {
        if (!sofiaClientsContainer) return;

        // Filtrar clientes asociados a Sofía
        const sofiaClients = allClients.filter(c => {
            const int = (c.interest || '').toLowerCase();
            const hasBriefing = c.briefing && Object.keys(c.briefing).length > 0;
            return int.includes('sofia') || hasBriefing || true;
        });

        if (counterSofiaNav) {
            counterSofiaNav.textContent = sofiaClients.length;
        }

        let completedCount = 0;
        let inProgressCount = 0;

        sofiaClients.forEach(c => {
            const prog = calculateSofiaProgress(c);
            if (prog.isCompleted) completedCount++;
            else inProgressCount++;
        });

        if (kpiSofiaTotalCount) kpiSofiaTotalCount.textContent = sofiaClients.length;
        if (kpiSofiaProgressCount) kpiSofiaProgressCount.textContent = inProgressCount;
        if (kpiSofiaDoneCount) kpiSofiaDoneCount.textContent = completedCount;

        const term = (filterSofiaInput?.value || '').toLowerCase().trim();
        const statusFilter = filterSofiaStatus?.value || 'all';

        const filtered = sofiaClients.filter(c => {
            const matchesSearch = !term ||
                (c.name || '').toLowerCase().includes(term) ||
                (c.phone || '').includes(term) ||
                (c.company || '').toLowerCase().includes(term) ||
                (c.rubro || '').toLowerCase().includes(term) ||
                (c.summary || '').toLowerCase().includes(term);

            if (!matchesSearch) return false;

            const prog = calculateSofiaProgress(c);
            if (statusFilter === 'in_progress') return !prog.isCompleted;
            if (statusFilter === 'completed') return prog.isCompleted;
            return true;
        });

        if (filtered.length === 0) {
            sofiaClientsContainer.innerHTML = `
                <div class="p-5 text-center text-muted">
                    <i class="fa-solid fa-robot font-lg mb-2" style="font-size:2.5rem; opacity:0.35;"></i>
                    <p class="font-md">No se encontraron clientes solicitantes de Sofía con los criterios actuales.</p>
                </div>
            `;
            return;
        }

        sofiaClientsContainer.innerHTML = filtered.map(c => {
            const cleanPhone = (c.phone || '').replace(/\D/g, '');
            const phoneDisplay = `+${cleanPhone}`;
            const prog = calculateSofiaProgress(c);
            const timeAgo = formatRelativeTime(c.lastActive || c.updatedAt);
            const stageClass = getStageBadgeClass(c.stage);
            const b = c.briefing || {};

            const companyName = (c.company && c.company !== 'Por definir') ? c.company : (b.nombreComercial || 'Empresa por definir');
            const rubroName = (c.rubro && c.rubro !== 'Por definir') ? c.rubro : (b.sector || 'Rubro por definir');

            // Renderizar los 5 bloques
            const blocksHtml = SOFIA_QUESTION_CATALOG.map(blk => {
                let blkAnswered = 0;
                const questionsHtml = blk.questions.map(q => {
                    const ans = b[q.field];
                    const hasAnswer = typeof ans === 'string' && ans.trim().length > 0 && ans !== 'Por definir' && ans !== 'Pendiente por responder...';
                    if (hasAnswer) blkAnswered++;

                    return `
                    <div class="sofia-q-card ${hasAnswer ? 'answered' : 'pending'}">
                        <div class="sofia-q-header">
                            <i class="fa-solid ${hasAnswer ? 'fa-circle-check text-success' : 'fa-clock text-warning'}"></i>
                            <span>${q.label}</span>
                        </div>
                        <div class="sofia-q-answer">
                            ${hasAnswer ? escapeHtml(ans) : '<span class="sofia-q-pending-text">⏳ Pendiente por responder...</span>'}
                        </div>
                    </div>
                    `;
                }).join('');

                const isBlkComplete = blkAnswered === blk.questions.length;
                const badgeClass = isBlkComplete ? 'badge-success' : (blkAnswered > 0 ? 'badge-info' : 'badge-warning');

                return `
                <div class="sofia-block-box">
                    <div class="sofia-block-bar">
                        <h4><i class="fa-solid fa-layer-group text-primary"></i> ${blk.blockTitle}</h4>
                        <span class="badge ${badgeClass} sofia-block-badge">${blkAnswered}/${blk.questions.length} Respondidas</span>
                    </div>
                    <div class="sofia-questions-grid">
                        ${questionsHtml}
                    </div>
                </div>
                `;
            }).join('');

            return `
            <div class="sofia-card">
                <!-- CABECERA -->
                <div class="sofia-card-header">
                    <div class="sofia-card-client-info">
                        <div class="sofia-avatar">
                            <i class="fa-solid fa-robot"></i>
                        </div>
                        <div class="sofia-card-name-box">
                            <h3>
                                ${c.name || 'Cliente'} 
                                <span class="sofia-company-tag"><i class="fa-solid fa-building"></i> ${companyName}</span>
                            </h3>
                            <div class="sofia-card-subtitle">
                                <span><i class="fa-brands fa-whatsapp text-success"></i> ${phoneDisplay}</span>
                                <span>•</span>
                                <span><i class="fa-solid fa-tag"></i> ${rubroName}</span>
                                <span>•</span>
                                <span><i class="fa-regular fa-clock"></i> Última interacción: ${timeAgo}</span>
                            </div>
                        </div>
                    </div>
                    <div class="sofia-card-header-actions">
                        <span class="badge ${stageClass}">${c.stage || '🟡 Lead Nuevo'}</span>
                        ${c.isPaused 
                            ? '<span class="badge badge-danger"><i class="fa-solid fa-hand"></i> Dalia Silenciada</span>' 
                            : '<span class="badge badge-success"><i class="fa-solid fa-circle-dot text-white"></i> Dalia Activa</span>'}
                    </div>
                </div>

                <!-- CUERPO -->
                <div class="sofia-card-body">
                    <!-- BARRA DE PROGRESO DE LOS 15 PASOS -->
                    <div class="sofia-progress-container">
                        <div class="sofia-progress-header">
                            <div class="sofia-progress-title">
                                <i class="fa-solid fa-list-ol text-primary"></i>
                                <span>Progreso del Cuestionario Oficial de Sofía: <strong>${prog.answeredCount} de 15 Preguntas</strong></span>
                            </div>
                            <span class="sofia-progress-pct">${prog.percentage}%</span>
                        </div>
                        <div class="sofia-progress-track">
                            <div class="sofia-progress-bar ${prog.isCompleted ? 'done' : ''}" style="width: ${prog.percentage}%;"></div>
                        </div>
                        <div class="sofia-progress-status-pill">
                            ${prog.isCompleted 
                                ? '<i class="fa-solid fa-circle-check text-success font-md"></i> <strong class="text-success">¡Cuestionario 100% Completado! Toda la información del negocio fue recaudada satisfactoriamente.</strong>' 
                                : `<i class="fa-solid fa-circle-info text-warning font-md"></i> <span>Próxima pregunta a recaudar: <strong>Paso #${prog.nextStepNumber} - ${prog.nextStepInfo ? prog.nextStepInfo.label : ''}</strong> (Dalia no avanzará hasta que el cliente responda).</span>`}
                        </div>
                    </div>

                    <!-- RESUMEN EJECUTIVO IA SI EXISTE -->
                    ${c.summary ? `
                    <div class="sofia-summary-quote">
                        <i class="fa-solid fa-quote-left text-muted mr-1"></i> ${escapeHtml(c.summary)}
                    </div>
                    ` : ''}

                    <!-- LOS 5 BLOQUES Y 15 PREGUNTAS -->
                    <div class="sofia-blocks-container">
                        ${blocksHtml}
                    </div>
                </div>

                <!-- FOOTER CON ACCIONES -->
                <div class="sofia-card-footer">
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-dna-export" onclick="window.copySofiaDNA('${c.id}')" title="Copiar todo el ADN del bot al portapapeles">
                            <i class="fa-solid fa-copy"></i> Copiar ADN de Sofía
                        </button>
                        <a href="https://wa.me/${cleanPhone}" target="_blank" class="btn btn-sm btn-whatsapp-direct" title="Abrir chat en WhatsApp">
                            <i class="fa-brands fa-whatsapp"></i> WhatsApp Directo
                        </a>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-primary" onclick="window.openClientProfile('${c.id}')" title="Ver chat completo y ficha 360°">
                            <i class="fa-solid fa-comments"></i> Transcripción Completa
                        </button>
                        <button class="btn btn-sm ${c.isPaused ? 'btn-success' : 'btn-outline-warning'}" onclick="window.toggleClientPause('${c.id}')" title="${c.isPaused ? 'Reanudar bot' : 'Pausar bot'}">
                            <i class="fa-solid ${c.isPaused ? 'fa-play' : 'fa-hand'}"></i> ${c.isPaused ? 'Reactivar' : 'Silenciar'}
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    // Copiar ADN de Sofía al portapapeles
    window.copySofiaDNA = function(clientId) {
        const client = allClients.find(c => c.id === clientId || c.phone === clientId);
        if (!client) return alert('Cliente no encontrado');

        const b = client.briefing || {};
        const cleanPhone = (client.phone || '').replace(/\D/g, '');
        const company = client.company || b.nombreComercial || 'Empresa';
        const prog = calculateSofiaProgress(client);

        const dnaText = 
`# ========================================================
# ADN ESTRUCTURADO Y CONFIGURACIÓN DE SOFÍA
# Negocio: ${company}
# Cliente: ${client.name || 'Cliente'} (WhatsApp: +${cleanPhone})
# Estado: ${prog.isCompleted ? '100% COMPLETADO (LISTO PARA PRODUCCIÓN)' : `EN PROGRESO (${prog.answeredCount}/15 preguntas)`}
# ========================================================

## 1. IDENTIDAD Y TONO DE VOZ DEL BOT
• Nombre Oficial del Bot: ${b.nombreBot || 'Sofía'}
• Estilo de Comunicación: ${b.estiloVoz || 'Por definir'}
• Uso de Emojis: ${b.emojis || 'Moderado'}
• Trato al Cliente: ${b.trato || 'Usted'}

## 2. INFORMACIÓN DEL NEGOCIO & PROPUESTA DE VALOR
• Nombre Comercial y Eslogan: ${b.nombreComercial || company}
• Sector / Industria: ${b.sector || client.rubro || 'General'}
• Presencia Web / Redes: ${b.webRedes || 'No especificado'}
• Propuesta de Valor y Actividad:
${b.descripcionValor || 'Venta de productos/servicios'}

## 3. PROPÓSITO, OBJETIVOS Y ACCIÓN FINAL
• Función Principal en WhatsApp:
${b.funcionPrincipal || 'Atención comercial y asesoría'}
• Acción Final Esperada (Call to Action):
${b.accionFinal || 'Guiar a cierre o derivación humana'}

## 4. BASE DE CONOCIMIENTO (OFERTA, PRECIOS & FAQs)
• Productos, Categorías y Precios:
${b.productosPrecios || 'Pendiente por definir'}

• Preguntas Frecuentes (FAQs):
${b.faqs || 'Pendiente por definir'}

• Políticas Comerciales (Envíos, Pagos, Reservas):
${b.politicas || 'Pendiente por definir'}

## 5. LÍMITES Y GUARDRAILS (REGLAS DE SEGURIDAD)
• Temas Prohibidos / Lo que NUNCA debe decir:
${b.temasProhibidos || 'No prometer nada fuera de catálogo ni inventar precios'}

• Criterio de Derivación a Humano:
${b.derivacionHumana || 'Transferir cuando el cliente solicite hablar con un humano o confirmación de pago'}

# ========================================================
# PROMPT DEL SISTEMA SUGERIDO PARA EL BOT DEL CLIENTE:
# ========================================================
Eres ${b.nombreBot || 'Sofía'}, la asistente virtual comercial de ${company}.
Tu objetivo es atender a los clientes en WhatsApp de forma ${b.estiloVoz || 'amable y profesional'}, tratándolos de ${b.trato || 'usted'} y usando emojis de manera ${b.emojis || 'moderada'}.
Tu función principal es ${b.funcionPrincipal || 'asesorar y tomar pedidos'}. Al finalizar, guía a los clientes a ${b.accionFinal || 'concretar su solicitud'}.
Nunca inventes datos no autorizados ni toques estos temas: ${b.temasProhibidos || 'temas no autorizados'}.`;

        navigator.clipboard.writeText(dnaText).then(() => {
            alert(`✅ ¡ADN de Sofía de "${company}" copiado al portapapeles!\nPuedes pegarlo directamente en cualquier motor o documentación.`);
        }).catch(err => {
            prompt('Copia el ADN de Sofía manualmente:', dnaText);
        });
    };

    filterSofiaInput?.addEventListener('input', renderSofiaClients);
    filterSofiaStatus?.addEventListener('change', renderSofiaClients);
    btnRefreshSofia?.addEventListener('click', loadClients);

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>");
    }

    function stripSystemTags(text) {
        if (!text) return '';
        return String(text)
            .replace(/\[BRIEFING_DATO:[^\]]+\]/gi, '')
            .replace(/\[ACTUALIZAR_CLIENTE:[^\]]+\]/gi, '')
            .replace(/\[BRIEFING_COMPLETO:[^\]]+\]/gi, '')
            .replace(/\[BRIEFING_COMPLETADO:[^\]]+\]/gi, '')
            .replace(/\[SOFIA_PASO:[^\]]+\]/gi, '')
            .replace(/\[SOFIA_BRIEFING_COMPLETO:[^\]]+\]/gi, '')
            .replace(/\[EXTRAER_DATO:[^\]]+\]/gi, '')
            .replace(/\[RESUMEN_EJECUTIVO:[^\]]+\]/gi, '')
            .replace(/\[PIPELINE_ESTADO:[^\]]+\]/gi, '')
            .replace(/\[ALERTA_CALIENTE:[^\]]+\]/gi, '')
            .replace(/\[SOLICITAR_CITA:[^\]]+\]/gi, '')
            .replace(/\[NUEVO_LEAD:[^\]]+\]/gi, '')
            .replace(/\[CREAR_CITA:[^\]]+\]/gi, '')
            .replace(/\[CANCELAR_CITA:[^\]]+\]/gi, '')
            .replace(/\[MODIFICAR_CITA:[^\]]+\]/gi, '')
            .replace(/\[CREAR_TAREA:[^\]]+\]/gi, '')
            .replace(/\[BORRAR_TAREA:[^\]]+\]/gi, '')
            .replace(/\[MODIFICAR_TAREA:[^\]]+\]/gi, '')
            .replace(/\[CREAR_PROYECTO:[^\]]+\]/gi, '')
            .replace(/\[SILENCIAR_CLIENTE:[^\]]+\]/gi, '')
            .replace(/\[REACTIVAR_CLIENTE:[^\]]+\]/gi, '')
            .trim();
    }

    // 10. GESTIÓN DEL MANUAL DE DALIA (KNOWLEDGE)
    async function loadKnowledge() {
        const editor = document.getElementById('knowledge-editor');
        if (!editor) return;
        try {
            const res = await fetch('/api/knowledge');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            editor.value = data.content || '';
            editor.placeholder = 'Escribe aquí las reglas y conocimientos de Dalia...';
            console.log('[Knowledge Loaded]:', (data.content || '').length, 'caracteres cargados en el editor.');
        } catch (e) {
            console.error('Error cargando manual:', e);
            editor.placeholder = 'Error cargando manual. Haz clic en guardar para intentar reconectar.';
        }
    }

    if (btnSaveKnowledge) {
        btnSaveKnowledge.addEventListener('click', async () => {
            btnSaveKnowledge.disabled = true;
            btnSaveKnowledge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

            try {
                const res = await fetch('/api/knowledge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: knowledgeEditor.value })
                });
                if (res.ok) {
                    alert('✅ Manual de Dalia actualizado con éxito.');
                }
            } catch (e) {
                alert('Error guardando manual.');
            } finally {
                btnSaveKnowledge.disabled = false;
                btnSaveKnowledge.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
            }
        });
    }

    // 11. GESTIÓN DE CONFIGURACIÓN
    async function loadConfig() {
        try {
            const res = await fetch('/api/config');
            const cfg = await res.json();
            if (cfgBusinessName) cfgBusinessName.value = cfg.businessName || '';
            if (cfgBotName) cfgBotName.value = cfg.botName || 'Dalia';
            if (cfgTimezone) cfgTimezone.value = cfg.timezone || 'America/Caracas';
            if (cfgCurrency) cfgCurrency.value = cfg.currency || 'USD';
        } catch (e) {}
    }

    if (btnSaveConfig) {
        btnSaveConfig.addEventListener('click', async () => {
            btnSaveConfig.disabled = true;
            btnSaveConfig.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

            const payload = {
                businessName: cfgBusinessName?.value.trim(),
                botName: cfgBotName?.value.trim(),
                timezone: cfgTimezone?.value.trim(),
                currency: cfgCurrency?.value.trim()
            };

            try {
                const res = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert('✅ Ajustes guardados correctamente.');
                }
            } catch (e) {
                alert('Error guardando ajustes.');
            } finally {
                btnSaveConfig.disabled = false;
                btnSaveConfig.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Ajustes';
            }
        });
    }

    // ========================================================
    // 11.5. MÓDULO DE FINANZAS & FLUJO DE CAJA
    // ========================================================
    let allFinances = [];
    let currentFinanceFilter = 'all';

    const financesTbody = document.getElementById('finances-tbody');
    const financeKpiIncome = document.getElementById('finance-kpi-income');
    const financeKpiExpense = document.getElementById('finance-kpi-expense');
    const financeKpiBalance = document.getElementById('finance-kpi-balance');
    const counterFinancesNav = document.getElementById('counter-finances-nav');
    const formNewFinance = document.getElementById('form-new-finance');

    async function loadFinances() {
        try {
            const res = await fetch('/api/finances');
            const data = await res.json();
            allFinances = data.finances || [];
            const stats = data.stats || {};

            const incTotal = stats.totalIncome || 0;
            const expTotal = stats.totalExpense || 0;
            const bal = stats.netBalance || 0;

            if (financeKpiIncome) financeKpiIncome.textContent = `$${incTotal.toFixed(2)}`;
            if (financeKpiExpense) financeKpiExpense.textContent = `$${expTotal.toFixed(2)}`;
            if (financeKpiBalance) {
                financeKpiBalance.textContent = `$${bal.toFixed(2)}`;
                financeKpiBalance.style.color = bal >= 0 ? '#059669' : '#e11d48';
            }
            if (counterFinancesNav) {
                counterFinancesNav.textContent = `$${bal.toFixed(0)}`;
            }

            // Actualizar contadores en filtros
            const incCount = allFinances.filter(f => f.type === 'ingreso').length;
            const expCount = allFinances.filter(f => f.type === 'gasto').length;
            const cntAll = document.getElementById('fin-cnt-all');
            const cntInc = document.getElementById('fin-cnt-income');
            const cntExp = document.getElementById('fin-cnt-expense');
            if (cntAll) cntAll.textContent = allFinances.length;
            if (cntInc) cntInc.textContent = incCount;
            if (cntExp) cntExp.textContent = expCount;

            const finIncSub = document.getElementById('finance-kpi-income-sub');
            const finExpSub = document.getElementById('finance-kpi-expense-sub');
            const finBalSub = document.getElementById('finance-kpi-balance-sub');
            if (finIncSub) finIncSub.textContent = `${incCount} cobro${incCount === 1 ? '' : 's'} registrado${incCount === 1 ? '' : 's'}`;
            if (finExpSub) finExpSub.textContent = `${expCount} egreso${expCount === 1 ? '' : 's'} registrado${expCount === 1 ? '' : 's'}`;
            if (finBalSub) finBalSub.textContent = bal >= 0 ? 'Margen positivo disponible' : 'Déficit operativo actual';

            renderFinances();
        } catch (err) {
            console.error('Error cargando finanzas:', err);
        }
    }

    function renderFinances() {
        if (!financesTbody) return;
        let filtered = allFinances;
        if (currentFinanceFilter !== 'all') {
            filtered = allFinances.filter(f => f.type === currentFinanceFilter);
        }

        if (filtered.length === 0) {
            const filterName = currentFinanceFilter === 'ingreso' ? 'ingresos' : (currentFinanceFilter === 'gasto' ? 'gastos' : 'movimientos');
            financesTbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="fin-empty-box">
                            <div class="fin-empty-icon">
                                <i class="fa-solid fa-receipt"></i>
                            </div>
                            <h4 class="fin-empty-title">Sin ${filterName} registrados aún</h4>
                            <p class="fin-empty-desc">
                                Los cobros por bots Sofía y egresos operativos anotados por WhatsApp o mediante el botón de arriba se reflejarán aquí en tiempo real.
                            </p>
                            <button class="btn btn-primary btn-sm" onclick="openModal('modal-finance')">
                                <i class="fa-solid fa-plus-circle"></i> Registrar Movimiento Ahora
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        financesTbody.innerHTML = filtered.map(f => {
            const isInc = f.type === 'ingreso';
            const badgeClass = isInc ? 'fin-badge-income' : 'fin-badge-expense';
            const badgeIcon = isInc ? '<i class="fa-solid fa-arrow-trend-up"></i> Ingreso' : '<i class="fa-solid fa-arrow-trend-down"></i> Gasto';
            const amountText = f.currency === 'VES' ? `Bs ${parseFloat(f.amount || 0).toFixed(2)}` : `$${parseFloat(f.amount || 0).toFixed(2)} USD`;
            const amountClass = isInc ? 'fin-amount-income' : 'fin-amount-expense';
            const dirIcon = (f.recordedBy || '').includes('Hector') ? '👑' : ((f.recordedBy || '').includes('Yonaiker') ? '⚙️' : ((f.recordedBy || '').includes('Adrian') || (f.recordedBy || '').includes('Adrián') ? '🛡️' : '👤'));

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 7px; font-weight: 600; color: #475569;">
                            <i class="fa-regular fa-calendar-check text-muted font-sm"></i>
                            <span>${f.date || 'Hoy'}</span>
                        </div>
                    </td>
                    <td><span class="${badgeClass}">${badgeIcon}</span></td>
                    <td>
                        <span style="font-weight: 700; color: #1e293b; font-size: 0.92rem;">${escapeHtml(f.concept || 'Movimiento')}</span>
                    </td>
                    <td><span class="badge badge-secondary" style="font-size: 0.76rem; border-radius: 6px;">${escapeHtml(f.category || 'General')}</span></td>
                    <td>
                        <span class="badge badge-light" style="font-size: 0.78rem; font-weight: 600;">
                            ${dirIcon} ${escapeHtml(f.recordedBy || 'Director')}
                        </span>
                    </td>
                    <td class="text-right ${amountClass}">
                        ${isInc ? '+' : '-'}${amountText}
                    </td>
                    <td class="text-center">
                        <button class="btn-fin-delete" onclick="window.deleteFinance(${f.id})" title="Eliminar registro">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.deleteFinance = async function(id) {
        if (!confirm('¿Deseas eliminar este registro de movimiento?')) return;
        try {
            const res = await fetch(`/api/finances/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadFinances();
            }
        } catch (e) {
            alert('Error eliminando movimiento.');
        }
    };

    // Botón refrescar Finanzas
    document.getElementById('btn-refresh-finances')?.addEventListener('click', loadFinances);

    // Filtros de Finanzas
    document.querySelectorAll('[data-finance-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-finance-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFinanceFilter = btn.getAttribute('data-finance-filter');
            renderFinances();
        });
    });

    // Formulario de Nuevo Movimiento
    if (formNewFinance) {
        formNewFinance.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('fin-input-type').value;
            const amount = document.getElementById('fin-input-amount').value;
            const currency = document.getElementById('fin-input-currency').value;
            const concept = document.getElementById('fin-input-concept').value.trim();
            const category = document.getElementById('fin-input-category').value;
            const recordedBy = document.getElementById('fin-input-recorded-by').value;
            const date = document.getElementById('fin-input-date').value;

            try {
                const res = await fetch('/api/finances', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, amount, currency, concept, category, recordedBy, date })
                });
                if (res.ok) {
                    closeModal('modal-finance');
                    formNewFinance.reset();
                    loadFinances();
                } else {
                    const err = await res.json();
                    alert(err.error || 'Error registrando movimiento.');
                }
            } catch (err) {
                alert('Error al conectar con el servidor.');
            }
        });
    }

    // 12. Inicialización General
    
    // ========================================================================
    // GESTIÓN DEL MODO DEMOSTRACIÓN SOFÍA PARA CLIENTES
    // ========================================================================
    const btnOpenDemoModal = document.getElementById('btn-open-demo-modal');
    const modalDemoSofia = document.getElementById('modal-demo-sofia');
    const demoTopbarStatus = document.getElementById('demo-topbar-status');
    const demoModalStatusBox = document.getElementById('demo-modal-status-box');
    const demoStatusDot = document.getElementById('demo-status-dot');
    const demoStatusTitle = document.getElementById('demo-status-title');
    const demoStatusDesc = document.getElementById('demo-status-desc');
    const formDemoSofia = document.getElementById('form-demo-sofia');
    const demoCustomNiche = document.getElementById('demo-custom-niche');
    const btnActivateDemo = document.getElementById('btn-activate-demo');
    const btnStopDemo = document.getElementById('btn-stop-demo');
    const presetButtons = document.querySelectorAll('.btn-demo-preset');

    async function loadDemoStatus() {
        try {
            const res = await fetch('/api/demo');
            if (!res.ok) return;
            const state = await res.json();
            updateDemoUI(state);
        } catch (e) {}
    }

    function updateDemoUI(state) {
        if (!state) return;
        if (state.isActive) {
            if (btnOpenDemoModal) {
                btnOpenDemoModal.classList.add('active');
            }
            if (demoTopbarStatus) {
                demoTopbarStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Demo: <strong>${state.niche}</strong>`;
            }
            if (demoModalStatusBox) {
                demoModalStatusBox.classList.add('active');
            }
            if (demoStatusDot) {
                demoStatusDot.style.background = '#22c55e';
                demoStatusDot.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.6)';
            }
            if (demoStatusTitle) {
                demoStatusTitle.innerHTML = `🎭 Demostración Activa: <span class="text-primary">${state.niche}</span>`;
            }
            if (demoStatusDesc) {
                demoStatusDesc.innerHTML = 'Dalia está respondiendo en WhatsApp 100% como <strong>Sofía</strong> para este negocio. Para terminar la muestra, haz clic en el botón rojo de abajo o escribe <em>"Fin demo"</em> en WhatsApp.';
            }
            if (btnActivateDemo) btnActivateDemo.classList.add('hidden');
            if (btnStopDemo) btnStopDemo.classList.remove('hidden');
        } else {
            if (btnOpenDemoModal) {
                btnOpenDemoModal.classList.remove('active');
            }
            if (demoTopbarStatus) {
                demoTopbarStatus.textContent = 'Demo Sofía: Inactivo';
            }
            if (demoModalStatusBox) {
                demoModalStatusBox.classList.remove('active');
            }
            if (demoStatusDot) {
                demoStatusDot.style.background = '#94a3b8';
                demoStatusDot.style.boxShadow = 'none';
            }
            if (demoStatusTitle) {
                demoStatusTitle.textContent = 'Modo Demo: Inactivo';
            }
            if (demoStatusDesc) {
                demoStatusDesc.innerHTML = 'Transforma a Dalia temporalmente en <strong>Sofía</strong> adaptada al negocio de tu cliente para hacerle una demostración en vivo de ventas directamente en WhatsApp.';
            }
            if (btnActivateDemo) btnActivateDemo.classList.remove('hidden');
            if (btnStopDemo) btnStopDemo.classList.add('hidden');
        }
    }

    if (btnOpenDemoModal && modalDemoSofia) {
        btnOpenDemoModal.addEventListener('click', () => {
            modalDemoSofia.classList.remove('hidden');
            loadDemoStatus();
        });
    }

    if (presetButtons) {
        presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const niche = btn.getAttribute('data-niche');
                if (demoCustomNiche && niche) {
                    demoCustomNiche.value = niche;
                    demoCustomNiche.focus();
                }
            });
        });
    }

    if (formDemoSofia) {
        formDemoSofia.addEventListener('submit', async (e) => {
            e.preventDefault();
            const niche = demoCustomNiche.value.trim();
            if (!niche) return;

            btnActivateDemo.disabled = true;
            btnActivateDemo.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Activando...';

            try {
                const res = await fetch('/api/demo/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: true, niche })
                });
                const data = await res.json();
                if (data.success) {
                    updateDemoUI(data.state);
                    alert(`🎉 ¡Modo Demostración Activado!\n\nDalia ahora hablará en WhatsApp como Sofía para: "${niche}".\n\nYa puedes hacer la demostración en vivo frente a tu cliente.`);
                    modalDemoSofia.classList.add('hidden');
                }
            } catch (err) {
                alert('Error al activar modo demostración.');
            } finally {
                btnActivateDemo.disabled = false;
                btnActivateDemo.innerHTML = '<i class="fa-solid fa-play"></i> Activar Demostración en WhatsApp';
            }
        });
    }

    if (btnStopDemo) {
        btnStopDemo.addEventListener('click', async () => {
            btnStopDemo.disabled = true;
            btnStopDemo.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finalizando...';

            try {
                const res = await fetch('/api/demo/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: false })
                });
                const data = await res.json();
                if (data.success) {
                    updateDemoUI(data.state);
                    alert('🛑 Demostración finalizada. Dalia ha regresado a su modo normal como tu asistente ejecutiva.');
                    modalDemoSofia.classList.add('hidden');
                }
            } catch (err) {
                alert('Error al desactivar modo demostración.');
            } finally {
                btnStopDemo.disabled = false;
                btnStopDemo.innerHTML = '<i class="fa-solid fa-stop"></i> Finalizar Demostración (Volver a Dalia)';
            }
        });
    }

    function initDashboard() {
        checkStatus();
        loadStats();
        loadAgenda();
        loadTasks();
        loadClients();
        loadSofiaDashboard();
        loadFinances();
        loadProjects();
        loadKnowledge();
        loadConfig();

        setInterval(checkStatus, 3000);
        setInterval(loadStats, 5000);
        setInterval(loadAgenda, 8000);
        setInterval(loadTasks, 8000);
        setInterval(loadClients, 8000);
        setInterval(loadSofiaDashboard, 8000);
        setInterval(loadFinances, 8000);
        setInterval(loadProjects, 10000);
        loadDemoStatus();
        setInterval(loadDemoStatus, 5000);
    }
    
    // Ejecutar verificación de estado de WhatsApp siempre para mantener la UI sincronizada
    checkStatus();
    setInterval(checkStatus, 3000);

    if (authToken) {
        initDashboard();
    }
});
