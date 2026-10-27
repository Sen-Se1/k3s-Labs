const API_BASE = '/api';

const taskList = document.getElementById('taskList');
const taskTitle = document.getElementById('taskTitle');
const taskDesc = document.getElementById('taskDesc');
const taskStatus = document.getElementById('taskStatus');
const addTaskBtn = document.getElementById('addTaskBtn');
const refreshBtn = document.getElementById('refreshBtn');
const backendStatus = document.getElementById('backendStatus');

async function checkHealth() {
    try {
        const res = await fetch('/health');
        if (res.ok) {
            backendStatus.textContent = 'ONLINE';
            backendStatus.classList.add('online');
        } else {
            throw new Error();
        }
    } catch (e) {
        backendStatus.textContent = 'OFFLINE';
        backendStatus.classList.remove('online');
    }
}

async function fetchTasks() {
    refreshBtn.classList.add('refreshing');
    try {
        const res = await fetch(`${API_BASE}/tasks`);
        const data = await res.json();
        renderTasks(data);
    } catch (e) {
        console.error('Error fetching tasks:', e);
        taskList.innerHTML = '<div class="error">Failed to load tasks.</div>';
    } finally {
        refreshBtn.classList.remove('refreshing');
    }
}

function renderTasks(tasks) {
    if (tasks.length === 0) {
        taskList.innerHTML = '<div class="empty">No tasks yet.</div>';
        return;
    }

    taskList.innerHTML = tasks.map(task => `
        <div class="task-card">
            <h3>${task.title}</h3>
            <p>${task.description || 'No description'}</p>
            <div class="task-badge">${task.status}</div>
            <button class="delete-btn" onclick="deleteTask(${task.id})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
        </div>
    `).join('');
}

async function addTask() {
    const title = taskTitle.value;
    const description = taskDesc.value;
    const status = taskStatus.value;

    if (!title) return alert('Title is required');

    try {
        const res = await fetch(`${API_BASE}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, status })
        });

        if (res.ok) {
            taskTitle.value = '';
            taskDesc.value = '';
            fetchTasks();
        }
    } catch (e) {
        console.error('Error adding task:', e);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure?')) return;
    try {
        await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
        fetchTasks();
    } catch (e) {
        console.error('Error deleting task:', e);
    }
}

addTaskBtn.addEventListener('click', addTask);
refreshBtn.addEventListener('click', () => {
    checkHealth();
    fetchTasks();
});

checkHealth();
fetchTasks();
setInterval(checkHealth, 10000);
